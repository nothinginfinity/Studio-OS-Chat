/**
 * chatExport.ts — v1
 */

import { uid } from "./utils";
import { putSetting, getSetting } from "./db";
import type {
  ChatSession,
  ChatMessage,
  ArtifactRecord,
  ChatSettings,
} from "./types";

// ── CDN dynamic import helper ─────────────────────────────────────────────────
// Uses Function constructor so TSC never sees the import() call and cannot
// attempt to resolve the URL as a module specifier. Vite also ignores it.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const cdnImport = new Function("url", "return import(url)") as (url: string) => Promise<Record<string, unknown>>;

// ── Markdown transcript ───────────────────────────────────────────────────────

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
    const data = JSON.stringify(msg.toolData, null, 2);
    body = `\`\`\`json\n${data}\n\`\`\``;
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

// ── Context JSON ──────────────────────────────────────────────────────────────

export interface ExportContext {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  provider?: string;
  model?: string;
  toolCallCount: number;
  exportedAt: string;
  exportVersion: "1.0";
}

function buildContext(
  session: ChatSession,
  settings?: Partial<ChatSettings>
): ExportContext {
  const toolCallCount = session.messages.filter(
    (m) => m.toolCalls && m.toolCalls.length > 0
  ).length;

  return {
    sessionId: session.id,
    title: session.title,
    createdAt: new Date(session.createdAt).toISOString(),
    updatedAt: new Date(session.updatedAt).toISOString(),
    messageCount: session.messages.length,
    provider: settings?.provider,
    model: settings?.model,
    toolCallCount,
    exportedAt: new Date().toISOString(),
    exportVersion: "1.0",
  };
}

// ── Sources JSON ──────────────────────────────────────────────────────────────

function extractSources(session: ChatSession): unknown[] {
  const sources: unknown[] = [];
  for (const msg of session.messages) {
    if (msg.role === "tool" && msg.toolName === "file_search" && msg.toolData) {
      sources.push(msg.toolData);
    }
  }
  return sources;
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

// ── Bundle type ───────────────────────────────────────────────────────────────

export interface ChatExportBundle {
  slug: string;
  files: Record<string, string>;
  artifact: ArtifactRecord;
}

// ── ArtifactRecord persistence ────────────────────────────────────────────────

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

export async function exportChat(
  session: ChatSession,
  settings?: Partial<ChatSettings>
): Promise<ChatExportBundle> {
  const now = new Date();
  const slug = toSlug(session.title, now);

  const chatMd = sessionToMarkdown(session);
  const context = buildContext(session, settings);
  const sources = extractSources(session);

  const readme = [
    `# ${session.title}`,
    ``,
    `Exported from **Studio-OS-Chat** on ${now.toISOString().slice(0, 10)}.`,
    ``,
    `## Files`,
    ``,
    `| File | Description |`,
    `|------|-------------|`,
    `| \`chat.md\` | Full conversation transcript |`,
    `| \`context.json\` | Session metadata (model, provider, timestamps) |`,
    `| \`sources.json\` | File search results referenced during the chat |`,
    ``,
    `## Stats`,
    ``,
    `- **Messages:** ${context.messageCount}`,
    `- **Tool calls:** ${context.toolCallCount}`,
    `- **Model:** ${context.model ?? "unknown"}`,
    `- **Provider:** ${context.provider ?? "unknown"}`,
  ].join("\n");

  const files: Record<string, string> = {
    "chat.md":      chatMd,
    "context.json": JSON.stringify(context, null, 2),
    "sources.json": JSON.stringify(sources, null, 2),
    "README.md":    readme,
  };

  const artifact: ArtifactRecord = {
    id: uid(),
    sessionId: session.id,
    kind: "chat-export",
    slug,
    createdAt: now.getTime(),
    manifest: JSON.stringify({ slug, fileKeys: Object.keys(files), context }),
  };

  await saveArtifact(artifact);

  return { slug, files, artifact };
}

// ── Download helper (ZIP via browser) ─────────────────────────────────────────

/**
 * Triggers a browser download of the export bundle as a .zip file.
 * Uses fflate (esm.sh CDN) — ~20 KB, no bundler config required.
 *
 * cdnImport() uses the Function constructor so TypeScript never sees the
 * import() call and cannot attempt to resolve the URL as a module specifier.
 *
 * The zipped Uint8Array is copied into a plain ArrayBuffer before passing
 * to Blob — required because TS strict DOM lib types BlobPart as
 * Uint8Array<ArrayBuffer>, not Uint8Array<ArrayBufferLike>.
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

  // Copy into a plain ArrayBuffer so Blob constructor is satisfied under
  // strict TS DOM types (BlobPart requires Uint8Array<ArrayBuffer> not
  // Uint8Array<ArrayBufferLike>).
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
