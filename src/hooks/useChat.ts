import { useEffect, useMemo, useState } from "react";
import {
  putSession,
  listSessions,
  putMessages,
  listMessages,
  renameSession as dbRenameSession
} from "../lib/db";
import {
  loadSettings,
  saveSettings
} from "../lib/storage";
import {
  buildOllamaTools,
  chatWithOllamaOnce,
  chatWithOllamaStream
} from "../lib/ollama";
import { now, uid } from "../lib/utils";
import { deriveSessionTitle } from "../components/SessionTitleEditor";
import type {
  ChatMessage,
  ChatSession,
  ChatSettings,
  OllamaMessage,
  SessionRecord,
  ToolCall
} from "../lib/types";
import { usePersistentState } from "./usePersistentState";
import { toolRegistry, getToolByName } from "../tools/registry";

function sessionToRecord(s: ChatSession, messageCount: number): SessionRecord {
  return {
    id: s.id,
    title: s.title,
    titleSource: s.titleSource,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount
  };
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [settings, setSettings] = usePersistentState<ChatSettings>(
    loadSettings,
    saveSettings
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [dbReady, setDbReady] = useState(false);

  // Load sessions from IndexedDB on mount
  useEffect(() => {
    async function loadFromDb() {
      const records = await listSessions();
      const hydrated: ChatSession[] = await Promise.all(
        records.map(async (rec) => {
          const msgs = await listMessages(rec.id);
          return {
            id: rec.id,
            title: rec.title,
            titleSource: rec.titleSource,
            createdAt: rec.createdAt,
            updatedAt: rec.updatedAt,
            messages: msgs as ChatMessage[]
          };
        })
      );
      setSessions(hydrated.sort((a, b) => b.updatedAt - a.updatedAt));
      if (hydrated.length > 0) setActiveSessionIdState(hydrated[0].id);
      setDbReady(true);
    }
    loadFromDb();
  }, []);

  async function persistSessionMeta(session: ChatSession, msgCount: number) {
    await putSession(sessionToRecord(session, msgCount));
  }

  async function persistSessionMessages(sessionId: string, messages: ChatMessage[]) {
    await putMessages(
      messages.map((m) => ({ ...m, sessionId }))
    );
  }

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ??
    sessions[0] ??
    null;

  const messages = activeSession?.messages ?? [];

  async function upsertSession(next: ChatSession) {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === next.id);
      if (!exists) return [next, ...prev];
      return prev.map((s) => (s.id === next.id ? next : s));
    });
    await persistSessionMeta(next, next.messages.length);
    await persistSessionMessages(next.id, next.messages);
  }

  async function createSession(initialMessage?: string) {
    const session: ChatSession = {
      id: uid(),
      title: initialMessage?.slice(0, 60) || "New Chat",
      titleSource: "auto",
      createdAt: now(),
      updatedAt: now(),
      messages: []
    };
    await upsertSession(session);
    setActiveSessionIdState(session.id);
    return session;
  }

  function setActiveSession(id: string) {
    setActiveSessionIdState(id);
    setError("");
  }

  async function renameSession(sessionId: string, title: string) {
    await dbRenameSession(sessionId, title);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, title, titleSource: "manual" } : s
      )
    );
  }

  const ollamaMessages = useMemo<OllamaMessage[]>(() => {
    const base: OllamaMessage[] = [
      { role: "system", content: settings.systemPrompt }
    ];
    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "assistant" || msg.role === "tool") {
        base.push({
          role: msg.role,
          content: msg.content,
          tool_name: msg.toolName,
          tool_call_id: msg.toolCallId,
          tool_calls: msg.toolCalls
        });
      }
    }
    return base;
  }, [messages, settings.systemPrompt]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    setError("");
    const session = activeSession ?? await createSession(trimmed);

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      createdAt: now()
    };

    const assistantDraftId = uid();
    const assistantDraft: ChatMessage = {
      id: assistantDraftId,
      role: "assistant",
      content: "",
      createdAt: now(),
      status: "streaming"
    };

    const sessionWithUser: ChatSession = {
      ...session,
      title: session.messages.length === 0 ? deriveSessionTitle([{ role: "user", content: trimmed }]) : session.title,
      titleSource: session.messages.length === 0 ? "auto" : session.titleSource,
      updatedAt: now(),
      messages: [...session.messages, userMessage, assistantDraft]
    };
    await upsertSession(sessionWithUser);

    setIsLoading(true);

    try {
      const streamedToolCalls: ToolCall[] = [];

      const firstResponse = await chatWithOllamaStream(
        {
          baseUrl: settings.ollamaBaseUrl,
          model: settings.model,
          messages: [...ollamaMessages, { role: "user", content: trimmed }],
          tools: buildOllamaTools(toolRegistry)
        },
        {
          onTextDelta: (chunk) => {
            setSessions((prev) =>
              prev.map((s) =>
                s.id !== session.id
                  ? s
                  : {
                      ...s,
                      updatedAt: now(),
                      messages: s.messages.map((m) =>
                        m.id === assistantDraftId
                          ? { ...m, content: m.content + chunk, status: "streaming" as const }
                          : m
                      )
                    }
              )
            );
          },
          onToolCalls: (toolCalls) => {
            for (const call of toolCalls) {
              streamedToolCalls.push({
                id: (call as ToolCall).id ?? uid(),
                function: {
                  name: call.function.name,
                  arguments: call.function.arguments
                }
              });
            }
          }
        }
      );

      const finalAssistantMessage: ChatMessage = {
        id: assistantDraftId,
        role: "assistant",
        content: firstResponse.message?.content ?? "",
        createdAt: assistantDraft.createdAt,
        status: "complete",
        toolCalls: streamedToolCalls.length ? streamedToolCalls : undefined
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id !== session.id
            ? s
            : {
                ...s,
                updatedAt: now(),
                messages: [
                  ...s.messages.filter((m) => m.id !== assistantDraftId),
                  finalAssistantMessage
                ]
              }
        )
      );

      // After first assistant completion, refine auto-title
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== session.id || s.titleSource !== "auto") return s;
          const refined = deriveSessionTitle([
            { role: "user", content: trimmed },
            { role: "assistant", content: finalAssistantMessage.content }
          ]);
          putSession(sessionToRecord({ ...s, title: refined }, s.messages.length));
          return { ...s, title: refined };
        })
      );

      if (streamedToolCalls.length > 0) {
        let toolMessages: ChatMessage[] = [];

        for (const call of streamedToolCalls) {
          const tool = getToolByName(call.function.name);
          if (!tool) continue;
          const result = await tool.run(call.function.arguments);
          const toolMessage: ChatMessage = {
            id: uid(),
            role: "tool",
            content: JSON.stringify(result),
            createdAt: now(),
            toolName: tool.name,
            toolData: result,
            toolCallId: call.id
          };
          toolMessages = [...toolMessages, toolMessage];
        }

        setSessions((prev) =>
          prev.map((s) =>
            s.id !== session.id
              ? s
              : { ...s, updatedAt: now(), messages: [...s.messages, ...toolMessages] }
          )
        );

        const followup = await chatWithOllamaOnce({
          baseUrl: settings.ollamaBaseUrl,
          model: settings.model,
          messages: [
            ...ollamaMessages,
            { role: "user", content: trimmed },
            {
              role: "assistant",
              content: finalAssistantMessage.content,
              tool_calls: streamedToolCalls
            },
            ...toolMessages.map((m) => ({
              role: "tool" as const,
              content: m.content,
              tool_name: m.toolName,
              tool_call_id: m.toolCallId
            }))
          ],
          tools: buildOllamaTools(toolRegistry)
        });

        const finalAnswer: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: followup.message?.content ?? "",
          createdAt: now(),
          status: "complete"
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id !== session.id
              ? s
              : { ...s, updatedAt: now(), messages: [...s.messages, finalAnswer] }
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  function clearChat() {
    if (!activeSession) return;
    upsertSession({ ...activeSession, updatedAt: now(), messages: [] });
    setError("");
  }

  return {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    setActiveSession,
    renameSession,
    messages,
    settings,
    setSettings,
    sendMessage,
    clearChat,
    isLoading,
    error,
    dbReady
  };
}
