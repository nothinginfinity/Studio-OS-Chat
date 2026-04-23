/**
 * useSpaceMailbox.ts
 * React hook for reading and writing a single Studio-OS space mailbox
 * via the GitHub Contents API.
 *
 * The GitHub PAT comes from settings.githubPat — already handled
 * by GitHubSettings.tsx, no new auth work needed.
 *
 * Usage (in App.tsx):
 *   const mailbox = useSpaceMailbox({
 *     spaceName: 'studio-os-chat',
 *     pat: settings.githubPat,
 *   });
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnvelopeStatus = 'pending' | 'delivered' | 'read' | 'error';

export interface SpaceEnvelope {
  id: string;
  threadId?: string;
  from: string;
  to: string;
  sentAt: string;
  body: string;
  payload?: Record<string, unknown>;
  status: EnvelopeStatus;
}

export interface UseSpaceMailboxOptions {
  /** Space ID matching registry.json — e.g. 'studio-os-chat' */
  spaceName: string;
  /** GitHub PAT with repo read/write scope — from settings.githubPat */
  pat: string;
  /** Owner/repo containing the spaces/ directory */
  repo?: string;
  /** Poll interval ms — 0 to disable */
  pollIntervalMs?: number;
}

export interface UseSpaceMailboxResult {
  inbox: SpaceEnvelope[];
  outbox: SpaceEnvelope[];
  send: (
    to: string,
    body: string,
    payload?: Record<string, unknown>,
    threadId?: string
  ) => Promise<void>;
  refresh: () => Promise<void>;
  isLoading: boolean;
  error: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REPO = 'nothinginfinity/studio-os-spaces';
const GITHUB_API = 'https://api.github.com';

// ---------------------------------------------------------------------------
// GitHub API helpers
// ---------------------------------------------------------------------------

async function fetchFileContent(
  repo: string,
  path: string,
  pat: string
): Promise<{ content: string; sha: string }> {
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) return { content: '', sha: '' };
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${path}`);
  const json = await res.json();
  const content =
    typeof json.content === 'string'
      ? decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))))
      : '';
  return { content, sha: json.sha ?? '' };
}

async function appendToFile(
  repo: string,
  path: string,
  pat: string,
  appendText: string,
  commitMessage: string
): Promise<void> {
  const { content: current, sha } = await fetchFileContent(repo, path, pat);
  const next = current + '\n' + appendText + '\n';
  const encoded = btoa(unescape(encodeURIComponent(next)));
  const body: Record<string, unknown> = { message: commitMessage, content: encoded };
  if (sha) body.sha = sha;
  const res = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub write ${res.status}: ${path}`);
}

// ---------------------------------------------------------------------------
// Envelope helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createEnvelope(
  from: string,
  to: string,
  body: string,
  payload?: Record<string, unknown>,
  threadId?: string
): SpaceEnvelope {
  return {
    id: uid(),
    threadId,
    from,
    to,
    sentAt: new Date().toISOString(),
    body,
    payload,
    status: 'pending',
  };
}

function serializeEnvelope(env: SpaceEnvelope): string {
  const payloadBlock = env.payload
    ? `\n\`\`\`json\n${JSON.stringify(env.payload, null, 2)}\n\`\`\``
    : '';
  return [
    `---`,
    `<!-- envelope:${env.id} -->`,
    `**From:** ${env.from}  `,
    `**To:** ${env.to}  `,
    `**Sent:** ${env.sentAt}  `,
    env.threadId ? `**Thread:** ${env.threadId}  ` : null,
    `**Status:** ${env.status}`,
    ``,
    env.body,
    payloadBlock,
    ``,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

function parseEnvelopes(markdown: string): SpaceEnvelope[] {
  const blocks = markdown
    .split(/^---$/m)
    .map((b) => b.trim())
    .filter(Boolean);
  const envelopes: SpaceEnvelope[] = [];
  for (const block of blocks) {
    const idMatch = block.match(/<!-- envelope:([\w-]+) -->/);
    const fromMatch = block.match(/\*\*From:\*\* ([\w-]+)/);
    const toMatch = block.match(/\*\*To:\*\* ([\w-]+)/);
    const sentMatch = block.match(/\*\*Sent:\*\* (.+)/);
    const threadMatch = block.match(/\*\*Thread:\*\* ([\w-]+)/);
    const statusMatch = block.match(/\*\*Status:\*\* (\w+)/);
    if (!idMatch || !fromMatch || !toMatch || !sentMatch) continue;
    const bodyStart = block.indexOf('\n\n');
    const body = bodyStart !== -1 ? block.slice(bodyStart).trim() : '';
    envelopes.push({
      id: idMatch[1],
      from: fromMatch[1],
      to: toMatch[1],
      sentAt: sentMatch[1].trim(),
      threadId: threadMatch?.[1],
      status: (statusMatch?.[1] ?? 'pending') as EnvelopeStatus,
      body,
    });
  }
  return envelopes;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSpaceMailbox({
  spaceName,
  pat,
  repo = DEFAULT_REPO,
  pollIntervalMs = 30_000,
}: UseSpaceMailboxOptions): UseSpaceMailboxResult {
  const [inbox, setInbox] = useState<SpaceEnvelope[]>([]);
  const [outbox, setOutbox] = useState<SpaceEnvelope[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inboxPath = `spaces/${spaceName}/inbox.md`;
  const outboxPath = `spaces/${spaceName}/outbox.md`;

  const refresh = useCallback(async () => {
    if (!pat) return;
    setIsLoading(true);
    setError('');
    try {
      const [inboxFile, outboxFile] = await Promise.all([
        fetchFileContent(repo, inboxPath, pat),
        fetchFileContent(repo, outboxPath, pat),
      ]);
      setInbox(parseEnvelopes(inboxFile.content));
      setOutbox(parseEnvelopes(outboxFile.content));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [pat, repo, inboxPath, outboxPath]);

  const send = useCallback(
    async (
      to: string,
      body: string,
      payload?: Record<string, unknown>,
      threadId?: string
    ) => {
      if (!pat) throw new Error('No GitHub PAT configured — add it in Settings.');
      const envelope = createEnvelope(spaceName, to, body, payload, threadId);
      const block = serializeEnvelope(envelope);
      await appendToFile(
        repo,
        outboxPath,
        pat,
        block,
        `msg(${spaceName}→${to}): ${envelope.id}`
      );
      setOutbox((prev) => [envelope, ...prev]);
    },
    [pat, repo, spaceName, outboxPath]
  );

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Polling
  useEffect(() => {
    if (!pollIntervalMs || !pat) return;
    pollRef.current = setInterval(refresh, pollIntervalMs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh, pollIntervalMs, pat]);

  return { inbox, outbox, send, refresh, isLoading, error };
}
