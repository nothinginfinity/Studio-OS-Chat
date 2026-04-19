/**
 * chatExport.ts — v2 (Phase 1)
 *
 * Replaces the four-file ZIP bundle with:
 *   - one canonical *.osmd file per exported session
 *   - one local export registry (exports/index.json) persisted in IndexedDB
 *
 * Public API surface is unchanged for callers:
 *   exportChat()         — returns ChatExportBundle (new shape)
 *   downloadExportAsZip() — zips the .osmd + index.json files
 *   listArtifacts()      — backward-compat artifact listing
 *   updateArtifactRepoUrl() — backward-compat repo URL setter
 */

import { uid } from "./utils";
import {
  putSetting,
  getSetting,
  putExportIndex,
  getExportIndex,
  updateSessionExportRef,
} from "./db";
import type {
  ChatSession,
  ChatMessage,
  ArtifactRecord,
  ChatSettings,
  OSMDMeta,
  OSMDIndex,
  OSMDIndexEntry,
} from "./types";

// ── CDN dynamic import helper ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const cdnImport = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;

// ── Constants ─────────────────────────────────────────────────────────────────

const OSMD_INDEX_PATH = "exports/index.json";
const OSMD_EXPORTS_DIR = "exports/chats";
const OSMD_FORMAT = "osmd@1" as const;

// ── Bundle type ───────────────────────────────────────────────────────────────

export interface ChatExportBundle {
  slug: string;
  files: Record<string, string>;
  artifact: ArtifactRecord;
  osmdPath: string;
  indexPath: "exports/index.json";
}

// ── Slug generator ────────────────────────────────────────────────────────────

function toSlug(title: string, date: Date): string {
  const dateStr = date.toISOString().slice(0, 10);
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${dateStr}-${titleSlug}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

// ── File refs extractor ───────────────────────────────────────────────────────

function extractFileRefs(session: ChatSession): string[] {
  const refs = new Set<string>();
  for (const msg of session.messages) {
    if (msg.role === "tool" && msg.toolName === "file_search" && msg.toolData) {
      const data = msg.toolData as Record<string, unknown>;
      if (typeof data.filePath === "string") refs.add(data.filePath);
      if (typeof data.path === "string") refs.add(data.path);
      if (Array.isArray(data.results)) {
        for (const r of data.results as Record<string, unknown>[]) {
          if (typeof r.filePath === "string") refs.add(r.filePath);
          if (typeof r.path === "string") refs.add(r.path);
        }
      }
    }
  }
  return [...refs].sort();
}

// ── Tags deriver ──────────────────────────────────────────────────────────────

function deriveTags(session: ChatSession, settings?: Partial<ChatSettings>): string[] {
  const tags = new Set<string>(["chat-export"]);
  if (settings?.provider) tags.add(settings.provider);
  if (settings?.model) tags.add(settings.model);
  // top 3 lowercase words from title (>3 chars, not stop words)
  const stopWords = new Set(["the", "and", "for", "with", "from", "that", "this", "have"]);
  const titleWords = session.title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 3);
  for (const w of titleWords) tags.add(w);
  return [...tags];
}

// ── OSMDMeta builder ──────────────────────────────────────────────────────────

function buildOsmdMeta(
  session: ChatSession,
  settings: Partial<ChatSettings> | undefined,
  artifactId: string,
  osmdPath: string
): OSMDMeta {
  const now = new Date();
  const toolCallCount = session.messages.filter(
    (m) => m.toolCalls && m.toolCalls.length > 0
  ).length;

  return {
    id: artifactId,
    sessionId: session.id,
    title: session.title,
    sessionDate: new Date(session.createdAt).toISOString().slice(0, 10),
    createdAt: new Date(session.createdAt).toISOString(),
    updatedAt: new Date(session.updatedAt).toISOString(),
    exportedAt: now.toISOString(),
    provider: settings?.provider,
    model: settings?.model,
    messageCount: session.messages.length,
    toolCallCount,
    fileRefs: extractFileRefs(session),
    tags: deriveTags(session, settings),
    exportPath: osmdPath,
    format: OSMD_FORMAT,
  };
}

// ── Summary builder (non-LLM fallback) ───────────────────────────────────────

function buildOsmdSummary(session: ChatSession): string | null {
  const userMsgs = session.messages.filter((m) => m.role === "user");
  const assistantMsgs = session.messages.filter((m) => m.role === "assistant");
  const toolCallCount = session.messages.filter(
    (m) => m.toolCalls && m.toolCalls.length > 0
  ).length;

  const firstUser = userMsgs[0]?.content ?? null;
  const firstAssistant = assistantMsgs[0]?.content ?? null;

  const parts = [
    firstUser ? `Started with: ${truncate(firstUser, 140)}` : null,
    firstAssistant ? `Assistant focused on: ${truncate(firstAssistant, 140)}` : null,
    toolCallCount ? `Included ${toolCallCount} tool-assisted step(s).` : null,
  ].filter(Boolean) as string[];

  return parts.length ? parts.join(" ") : null;
}

// ── Transcript builder ────────────────────────────────────────────────────────

function formatTranscriptRole(role: ChatMessage["role"]): string {
  switch (role) {
    case "user":      return "user";
    case "assistant": return "assistant";
    case "tool":      return "tool";
    case "system":    return "system";
    default:          return String(role);
  }
}

function buildOsmdTranscript(session: ChatSession): string {
  return session.messages
    .filter((m) => m.role !== "system")
    .map((msg) => {
      const ts = new Date(msg.createdAt).toISOString();
      let body = msg.content ?? "";

      if (msg.toolCalls?.length) {
        const renderedCalls = msg.toolCalls
          .map((tc) => {
            const args = JSON.stringify(tc.function.arguments ?? {}, null, 2);
            return `[tool-call:${tc.function.name}]\n\`\`\`json\n${args}\n\`\`\``;
          })
          .join("\n\n");
        body = body ? `${body}\n\n${renderedCalls}` : renderedCalls;
      }

      if (msg.role === "tool" && msg.toolData !== undefined) {
        body = `\`\`\`json\n${JSON.stringify(msg.toolData, null, 2)}\n\`\`\``;
      }

      return `[${formatTranscriptRole(msg.role)}] ${ts}\n${body}`.trim();
    })
    .join("\n\n---\n\n");
}

// ── .osmd renderer ────────────────────────────────────────────────────────────

function yamlList(items: string[]): string {
  if (!items.length) return "  - (none)";
  return items.map((item) => `  - ${JSON.stringify(item)}`).join("\n");
}

function renderOsmd(meta: OSMDMeta, summary: string | null, transcript: string): string {
  return [
    "---osmd-meta---",
    `id: ${meta.id}`,
    `sessionId: ${meta.sessionId}`,
    `title: ${JSON.stringify(meta.title)}`,
    `sessionDate: ${meta.sessionDate}`,
    `createdAt: ${meta.createdAt}`,
    `updatedAt: ${meta.updatedAt}`,
    `exportedAt: ${meta.exportedAt}`,
    `provider: ${meta.provider ?? ""}`,
    `model: ${meta.model ?? ""}`,
    `messageCount: ${meta.messageCount}`,
    `toolCallCount: ${meta.toolCallCount}`,
    `fileRefs:\n${yamlList(meta.fileRefs)}`,
    `tags:\n${yamlList(meta.tags)}`,
    `exportPath: ${meta.exportPath}`,
    `format: ${meta.format}`,
    "---",
    "",
    "---osmd-summary---",
    summary ?? "(none)",
    "---",
    "",
    "---osmd-transcript---",
    transcript,
    "",
  ].join("\n");
}

// ── Index helpers ─────────────────────────────────────────────────────────────

function buildIndexEntry(meta: OSMDMeta, summary: string | null): OSMDIndexEntry {
  return {
    id: meta.id,
    sessionId: meta.sessionId,
    title: meta.title,
    date: meta.sessionDate,
    path: meta.exportPath,
    summary,
    tags: meta.tags,
    messageCount: meta.messageCount,
    exportedAt: meta.exportedAt,
    provider: meta.provider,
    model: meta.model,
    format: OSMD_FORMAT,
  };
}

async function loadExportIndex(): Promise<OSMDIndex> {
  const stored = await getExportIndex<OSMDIndex>();
  return (
    stored ?? {
      version: "osmd-index@1",
      updatedAt: new Date(0).toISOString(),
      exports: [],
    }
  );
}

async function saveExportIndex(index: OSMDIndex): Promise<void> {
  await putExportIndex(index);
}

function upsertIndexEntry(index: OSMDIndex, entry: OSMDIndexEntry): OSMDIndex {
  const exports = [
    entry,
    ...index.exports.filter(
      (x) => x.id !== entry.id && x.sessionId !== entry.sessionId
    ),
  ].sort((a, b) => Date.parse(b.exportedAt) - Date.parse(a.exportedAt));

  return {
    version: "osmd-index@1",
    updatedAt: new Date().toISOString(),
    exports,
  };
}

// ── ArtifactRecord persistence (backward compat) ──────────────────────────────

const ARTIFACTS_KEY = "__artifacts__";

async function loadArtifacts(): Promise<ArtifactRecord[]> {
  const stored = await getSetting<ArtifactRecord[]>(ARTIFACTS_KEY);
  return stored ?? [];
}

async function saveArtifact(artifact: ArtifactRecord): Promise<void> {
  const existing = await loadArtifacts();
  const updated = [artifact, ...existing.filter((a) => a.id !== artifact.id)];
  await putSetting(ARTIFACTS_KEY, updated);
}

export async function listArtifacts(): Promise<ArtifactRecord[]> {
  return loadArtifacts();
}

export async function updateArtifactRepoUrl(
  artifactId: string,
  repoUrl: string
): Promise<void> {
  const existing = await loadArtifacts();
  const updated = existing.map((a) =>
    a.id === artifactId ? { ...a, repoUrl } : a
  );
  await putSetting(ARTIFACTS_KEY, updated);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Exports a chat session to a canonical .osmd artifact + updates the local
 * export registry. Returns a ChatExportBundle whose files map contains:
 *   exports/chats/<slug>_<id>.osmd  — the canonical export document
 *   exports/index.json              — the updated registry
 *
 * downloadExportAsZip() can be called immediately after to deliver both files
 * to the user as a ZIP.
 */
export async function exportChat(
  session: ChatSession,
  settings?: Partial<ChatSettings>
): Promise<ChatExportBundle> {
  const now = new Date();
  const slug = toSlug(session.title, now);
  const artifactId = uid();
  const filename = `${slug}_${artifactId.slice(0, 8)}.osmd`;
  const osmdPath = `${OSMD_EXPORTS_DIR}/${filename}`;

  const meta = buildOsmdMeta(session, settings, artifactId, osmdPath);
  const summary = buildOsmdSummary(session);
  const transcript = buildOsmdTranscript(session);
  const osmd = renderOsmd(meta, summary, transcript);

  const indexEntry = buildIndexEntry(meta, summary);
  const existingIndex = await loadExportIndex();
  const nextIndex = upsertIndexEntry(existingIndex, indexEntry);

  const files: Record<string, string> = {
    [osmdPath]: osmd,
    [OSMD_INDEX_PATH]: JSON.stringify(nextIndex, null, 2),
  };

  const artifact: ArtifactRecord = {
    id: artifactId,
    sessionId: session.id,
    kind: "chat-export",
    slug,
    createdAt: now.getTime(),
    format: OSMD_FORMAT,
    primaryPath: osmdPath,
    manifest: JSON.stringify({
      slug,
      osmdPath,
      indexPath: OSMD_INDEX_PATH,
      summary,
      meta,
      fileKeys: Object.keys(files),
    }),
  };

  await saveArtifact(artifact);
  await saveExportIndex(nextIndex);
  await updateSessionExportRef(session.id, {
    artifactId,
    exportPath: osmdPath,
    exportedAt: now.getTime(),
    exportFormat: OSMD_FORMAT,
  });

  return {
    slug,
    files,
    artifact,
    osmdPath,
    indexPath: OSMD_INDEX_PATH,
  };
}

// ── Download helper (ZIP via browser) ─────────────────────────────────────────

/**
 * Triggers a browser download of the export bundle as a .zip file.
 * Now zips the .osmd file + exports/index.json (whatever is in bundle.files).
 * Uses fflate (esm.sh CDN) — ~20 KB, no bundler config required.
 */
export async function downloadExportAsZip(bundle: ChatExportBundle): Promise<void> {
  const { zipSync, strToU8 } = await cdnImport("https://esm.sh/fflate@0.8");

  const zipFn = zipSync as (entries: Record<string, Uint8Array>) => Uint8Array;
  const toU8 = strToU8 as (str: string) => Uint8Array;

  const zipEntries: Record<string, Uint8Array> = {};
  for (const [filePath, content] of Object.entries(bundle.files)) {
    zipEntries[`${bundle.slug}/${filePath}`] = toU8(content);
  }

  const zipped = zipFn(zipEntries);

  const buf = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength
  ) as ArrayBuffer;

  const blob = new Blob([buf], { type: "application/zip" });
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${bundle.slug}.zip`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
}

// ── Legacy markdown helpers (kept for any direct callers) ─────────────────────

function roleLabel(role: ChatMessage["role"]): string {
  switch (role) {
    case "user":      return "**User**";
    case "assistant": return "**Assistant**";
    case "tool":      return "**Tool**";
    case "system":    return "**System**";
    default:          return `**${role}**`;
  }
}

function messageToMarkdown(msg: ChatMessage): string {
  const ts = new Date(msg.createdAt).toISOString();
  const header = `${roleLabel(msg.role)} _${ts}_`;
  let body = msg.content ?? "";
  if (msg.toolCalls?.length) {
    const calls = msg.toolCalls
      .map((tc) => {
        const args = JSON.stringify(tc.function.arguments, null, 2);
        return `\`${tc.function.name}\`\n\`\`\`json\n${args}\n\`\`\``;
      })
      .join("\n\n");
    body = body ? `${body}\n\n${calls}` : calls;
  }
  if (msg.role === "tool" && msg.toolData !== undefined) {
    body = `\`\`\`json\n${JSON.stringify(msg.toolData, null, 2)}\n\`\`\``;
  }
  return `### ${header}\n\n${body}`;
}

export function sessionToMarkdown(session: ChatSession): string {
  const created = new Date(session.createdAt).toISOString();
  const updated = new Date(session.updatedAt).toISOString();
  const header = [
    `# ${session.title}`,
    ``,
    `> **Created:** ${created}  `,
    `> **Updated:** ${updated}  `,
    `> **Messages:** ${session.messages.length}`,
    ``,
    `---`,
    ``,
  ].join("\n");
  const body = session.messages
    .filter((m) => m.role !== "system")
    .map(messageToMarkdown)
    .join("\n\n---\n\n");
  return header + body;
}
