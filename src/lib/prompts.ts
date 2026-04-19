/**
 * prompts.ts — Prompt history helpers
 *
 * Reads user-role MessageRecords directly from the existing messages
 * object store in db.ts. No schema changes required.
 */

import type { MessageRecord } from "./types";
import { listMessages, listSessions } from "./db";

export interface PromptEntry {
  messageId: string;
  sessionId: string;
  sessionTitle: string;
  content: string;
  createdAt: number;
}

/**
 * Returns every user-role message across all sessions,
 * sorted newest-first, enriched with session title.
 */
export async function listAllUserPrompts(): Promise<PromptEntry[]> {
  const sessions = await listSessions();
  const sessionMap = new Map<string, string>(
    sessions.map((s) => [s.id, s.title])
  );

  const allMessages: MessageRecord[] = [];
  for (const session of sessions) {
    const msgs = await listMessages(session.id);
    allMessages.push(...msgs.filter((m) => m.role === "user"));
  }

  return allMessages
    .map((m) => ({
      messageId: m.id,
      sessionId: m.sessionId,
      sessionTitle: sessionMap.get(m.sessionId) ?? "Untitled",
      content: m.content,
      createdAt: m.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Keyword search across prompt content (case-insensitive).
 * Splits query into tokens and requires ALL tokens to match.
 */
export async function searchUserPrompts(query: string): Promise<PromptEntry[]> {
  const all = await listAllUserPrompts();
  if (!query.trim()) return all;
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return all.filter((p) =>
    tokens.every((tok) => p.content.toLowerCase().includes(tok))
  );
}
