/**
 * chatExport.ts — v1
 *
 * Turns a ChatSession into a durable artifact bundle:
 *
 *   chat.md          — human-readable transcript
 *   context.json     — metadata: model, provider, tool calls, timestamps
 *   sources.json     — all file search results referenced in the session
 *   artifacts/       — any tool-produced content blocks (future)
 *
 * The bundle is stored as an ArtifactRecord in IndexedDB.
 * It can also be zipped for download or pushed to GitHub (see githubExport.ts).
 *
 * Design principle: conversations are ephemeral windows; repos are durable state.
 * This module is the bridge between the two.
 */

import { uid } from "./utils";
import { putSetting, getSetting } from "./db";
import type {
  ChatSession,
  ChatMessage,
  ArtifactRecord,
  ChatSettings,
} from "./types";

// ── Markdown transcript ───────────────────────────────────────────────────────────

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

  // Attach tool call info if present
  if (msg.toolCalls?.length) {
    const calls = msg.toolCalls
      .map((tc) => {
        const args = JSON.stringify(tc.function.arguments, null, 2);
        return `\`${tc.function.name}\`\n\`\`\`json\n${args}\n\`\`\``;
      })
      .join("\n\n");
    body = body ? `${body}\n\n${calls}` : calls;
  }

  // Tool result block
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

// ── Context JSON ──────────────────────────────────────────────────────────────────

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

// ── Sources JSON (file search results referenced in session) ─────────────────

function extractSources(session: ChatSession): unknown[] {
  const sources: unknown[] = [];
  for (const msg of session.messages) {
    if (msg.role === "tool" && msg.toolName === "file_search" && msg.toolData) {
      sources.push(msg.toolData);
    }
  }
  return sources;
}

// ── Slug generator ────────────────────────────────────────────────────────────────

function toSlug(title: string, date: Date): string {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${dateStr}-${titleSlug}`;
}

// ── Bundle type ──────────────────────────────────────────────────────────────────

export interface ChatExportBundle {
  /** Slug used as folder name and repo name */
  slug: string;
  /** Files to write: path → string content */
  files: Record<string, string>;
  /** The ArtifactRecord stored in IndexedDB */
  artifact: ArtifactRecord;
}

// ── ArtifactRecord persistence ───────────────────────────────────────────────────

// Reuse the generic settings store for artifacts list (avoids a db.ts schema bump)
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
 * Serialise a ChatSession into a ChatExportBundle and persist the
 * ArtifactRecord to IndexedDB.
 *
 * The returned `files` map contains:
 *   "chat.md"      — full markdown transcript
 *   "context.json" — session metadata + model info
 *   "sources.json" — file_search tool results referenced in the session
 *   "README.md"    — human-friendly intro for GitHub repo view
 *
 * @param session   The ChatSession to export
 * @param settings  Optional ChatSettings for model/provider metadata
 */
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

// ── Download helper (ZIP via browser) ────────────────────────────────────────

/**
 * Triggers a browser download of the export bundle as a .zip file.
 * Uses fflate (esm.sh) — ~20 KB, no bundler config required.
 */
export async function downloadExportAsZip(bundle: ChatExportBundle): Promise<void> {
  const { zipSync, strToU8 } = await import(
    /* @vite-ignore */
    "https://esm.sh/fflate@0.8"
  );

  const zipEntries: Record<string, Uint8Array> = {};
  for (const [filePath, content] of Object.entries(bundle.files)) {
    zipEntries[`${bundle.slug}/${filePath}`] = strToU8(content);
  }

  const zipped = zipSync(zipEntries);
  const blob = new Blob([zipped], { type: "application/zip" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${bundle.slug}.zip`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
