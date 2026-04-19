/**
 * spaceRecord.ts — v1
 *
 * Perplexity Space orchestration layer.
 *
 * A SpaceRecord stores everything Studio-OS-Chat knows about a linked
 * Perplexity Space: its URL, context markdown, prompt templates, mailbox
 * paths, and optional attachments to a repo or session.
 *
 * Mailbox protocol:
 *   - Outbound (us → studio-os):  append to spaces/studio-os/inbox.md
 *   - Inbound  (studio-os → us):  read spaces/studio-os-chat/inbox.md
 *
 * Mailbox files live in the Studio-OS-Chat GitHub repo so every message
 * is durable, versioned, and inspectable. Appending is done via the
 * GitHub Contents API (read current file → append → PUT with SHA).
 *
 * Design: Studio-OS-Chat does NOT own Perplexity. It indexes and launches
 * Perplexity contexts. The SpaceRecord is a data structure, not a deep
 * API integration.
 */

import { uid } from "./utils";
import { getSetting, putSetting } from "./db";
import { getGithubPat } from "./githubExport";
import type { SpaceRecord } from "./types";

// ── Storage (reuses settings store) ───────────────────────────────────────────────

const SPACES_KEY = "__spaces__";

export async function listSpaces(): Promise<SpaceRecord[]> {
  const stored = await getSetting<SpaceRecord[]>(SPACES_KEY);
  return (stored ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getSpace(id: string): Promise<SpaceRecord | null> {
  const all = await listSpaces();
  return all.find((s) => s.id === id) ?? null;
}

export async function putSpace(space: SpaceRecord): Promise<void> {
  const existing = await listSpaces();
  const updated = [
    space,
    ...existing.filter((s) => s.id !== space.id),
  ];
  await putSetting(SPACES_KEY, updated);
}

export async function deleteSpace(id: string): Promise<void> {
  const existing = await listSpaces();
  await putSetting(SPACES_KEY, existing.filter((s) => s.id !== id));
}

// ── Factory ──────────────────────────────────────────────────────────────────────

export interface CreateSpaceOptions {
  name: string;
  spaceUrl: string;
  contextMarkdown?: string;
  promptTemplates?: string[];
  inboundMailboxPath?: string;
  outboundMailboxPath?: string;
  attachedRepoUrl?: string;
  attachedSessionId?: string;
}

export function createSpace(opts: CreateSpaceOptions): SpaceRecord {
  const now = Date.now();
  return {
    id: uid(),
    name: opts.name,
    spaceUrl: opts.spaceUrl,
    contextMarkdown: opts.contextMarkdown ?? "",
    promptTemplates: opts.promptTemplates ?? [],
    inboundMailboxPath:
      opts.inboundMailboxPath ?? "spaces/studio-os-chat/inbox.md",
    outboundMailboxPath:
      opts.outboundMailboxPath ?? "spaces/studio-os/inbox.md",
    attachedRepoUrl: opts.attachedRepoUrl,
    attachedSessionId: opts.attachedSessionId,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Mailbox: GitHub file append via Contents API ───────────────────────────────

const GH_API = "https://api.github.com";

// Repo where mailboxes live — the Studio-OS-Chat repo itself
const MAILBOX_OWNER = "nothinginfinity";
const MAILBOX_REPO = "Studio-OS-Chat";

interface GHFileResponse {
  sha: string;
  content: string; // base64
  encoding: string;
}

async function readMailboxFile(
  path: string,
  pat: string
): Promise<{ content: string; sha: string } | null> {
  const res = await fetch(
    `${GH_API}/repos/${MAILBOX_OWNER}/${MAILBOX_REPO}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (res.status === 404) return null; // File doesn't exist yet
  if (!res.ok) throw new Error(`Failed to read ${path}: ${res.status}`);

  const data = (await res.json()) as GHFileResponse;
  const content = decodeURIComponent(
    escape(atob(data.content.replace(/\n/g, "")))
  );
  return { content, sha: data.sha };
}

async function writeMailboxFile(
  path: string,
  pat: string,
  content: string,
  sha: string | null,
  commitMessage: string
): Promise<void> {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body: Record<string, unknown> = {
    message: commitMessage,
    content: encoded,
    branch: "main",
  };
  if (sha) body.sha = sha; // Required for updates; omit for new file

  const res = await fetch(
    `${GH_API}/repos/${MAILBOX_OWNER}/${MAILBOX_REPO}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to write ${path}: ${res.status} ${err}`);
  }
}

// ── Public mailbox API ──────────────────────────────────────────────────────────

export interface MailboxMessage {
  /** ISO timestamp */
  sentAt: string;
  /** Which space this was sent from */
  spaceId: string;
  spaceName: string;
  /** Message body in markdown */
  body: string;
  /** Optional: slug of an attached chat export */
  attachedExportSlug?: string;
  /** Optional: URL of an attached repo */
  attachedRepoUrl?: string;
}

function formatMailboxEntry(msg: MailboxMessage): string {
  const lines = [
    `## Message — ${msg.sentAt}`,
    ``,
    `**From:** ${msg.spaceName} (\`${msg.spaceId}\`)`,
  ];

  if (msg.attachedExportSlug) {
    lines.push(`**Export:** \`${msg.attachedExportSlug}\``);
  }
  if (msg.attachedRepoUrl) {
    lines.push(`**Repo:** ${msg.attachedRepoUrl}`);
  }

  lines.push(``, msg.body, ``, `---`, ``);
  return lines.join("\n");
}

/**
 * Append a message to a mailbox file in the Studio-OS-Chat repo.
 * Creates the file if it doesn't exist.
 *
 * @param mailboxPath  e.g. "spaces/studio-os/inbox.md"
 * @param message      The MailboxMessage to append
 * @param pat          GitHub PAT (falls back to stored PAT if omitted)
 */
export async function appendToMailbox(
  mailboxPath: string,
  message: MailboxMessage,
  pat?: string
): Promise<void> {
  const token = pat ?? (await getGithubPat());
  if (!token) throw new Error("No GitHub PAT configured. Set one in Settings.");

  const existing = await readMailboxFile(mailboxPath, token);
  const entry = formatMailboxEntry(message);

  const newContent = existing
    ? existing.content.trimEnd() + "\n\n" + entry
    : `# Inbox\n\n${entry}`;

  await writeMailboxFile(
    mailboxPath,
    token,
    newContent,
    existing?.sha ?? null,
    `mailbox: append message from ${message.spaceName}`
  );
}

/**
 * Read the inbound mailbox for studio-os-chat.
 * Returns raw markdown content, or null if the file doesn't exist.
 *
 * @param pat  GitHub PAT (falls back to stored PAT if omitted)
 */
export async function readInbox(
  mailboxPath = "spaces/studio-os-chat/inbox.md",
  pat?: string
): Promise<string | null> {
  const token = pat ?? (await getGithubPat());
  if (!token) throw new Error("No GitHub PAT configured.");
  const file = await readMailboxFile(mailboxPath, token);
  return file?.content ?? null;
}

/**
 * Convenience: send a message to the studio-os Space inbox.
 * Wraps appendToMailbox with the default outbound path.
 */
export async function sendToStudioOS(
  space: SpaceRecord,
  body: string,
  extras?: Pick<MailboxMessage, "attachedExportSlug" | "attachedRepoUrl">
): Promise<void> {
  const message: MailboxMessage = {
    sentAt: new Date().toISOString(),
    spaceId: space.id,
    spaceName: space.name,
    body,
    ...extras,
  };
  await appendToMailbox(space.outboundMailboxPath, message);
}
