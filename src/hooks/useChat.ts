import { useMemo, useState } from "react";
import {
  loadSessions,
  saveSessions,
  loadActiveSessionId,
  saveActiveSessionId,
  loadSettings,
  saveSettings
} from "../lib/storage";
import {
  buildOllamaTools,
  chatWithOllamaOnce,
  chatWithOllamaStream
} from "../lib/ollama";
import { now, uid } from "../lib/utils";
import type {
  ChatMessage,
  ChatSession,
  ChatSettings,
  OllamaMessage
} from "../lib/types";
import { usePersistentState } from "./usePersistentState";
import { toolRegistry, getToolByName } from "../tools/registry";

export function useChat() {
  const [sessions, setSessions] = usePersistentState<ChatSession[]>(
    loadSessions,
    saveSessions
  );
  const [activeSessionId, setActiveSessionIdState] = usePersistentState<string | null>(
    loadActiveSessionId,
    saveActiveSessionId
  );

  const [settings, setSettings] = usePersistentState<ChatSettings>(
    loadSettings,
    saveSettings
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ??
    sessions[0] ??
    null;

  const messages = activeSession?.messages ?? [];

  function upsertSession(next: ChatSession) {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === next.id);
      if (!exists) return [next, ...prev];
      return prev.map((s) => (s.id === next.id ? next : s));
    });
  }

  function createSession(initialMessage?: string) {
    const session: ChatSession = {
      id: uid(),
      title: initialMessage?.slice(0, 40) || "New Chat",
      createdAt: now(),
      updatedAt: now(),
      messages: []
    };
    upsertSession(session);
    setActiveSessionIdState(session.id);
    return session;
  }

  function setActiveSession(id: string) {
    setActiveSessionIdState(id);
    setError("");
  }

  const ollamaMessages = useMemo<OllamaMessage[]>(() => {
    const base: OllamaMessage[] = [
      { role: "system", content: settings.systemPrompt }
    ];
    for (const msg of messages) {
      if (
        msg.role === "user" ||
        msg.role === "assistant" ||
        msg.role === "tool"
      ) {
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
    const session = activeSession ?? createSession(trimmed);

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

    const firstPassMessages = [...session.messages, userMessage, assistantDraft];
    upsertSession({
      ...session,
      title: session.messages.length ? session.title : trimmed.slice(0, 40),
      updatedAt: now(),
      messages: firstPassMessages
    });

    setIsLoading(true);

    try {
      let streamedToolCalls: ChatMessage["toolCalls"] = [];

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
            streamedToolCalls = toolCalls.map((call) => ({
              id: uid(),
              function: {
                name: call.function.name,
                arguments: call.function.arguments
              }
            }));
          }
        }
      );

      const finalAssistantMessage: ChatMessage = {
        id: assistantDraftId,
        role: "assistant",
        content: firstResponse.message?.content ?? "",
        createdAt: assistantDraft.createdAt,
        status: "complete",
        toolCalls: streamedToolCalls
      };

      setSessions((prev) => {
        const resolvedSession = prev.find((s) => s.id === session.id);
        if (!resolvedSession) return prev;

        let workingMessages = [
          ...resolvedSession.messages.filter((m) => m.id !== assistantDraftId),
          finalAssistantMessage
        ];

        return prev.map((s) =>
          s.id !== session.id
            ? s
            : { ...s, updatedAt: now(), messages: workingMessages }
        );
      });

      if (streamedToolCalls && streamedToolCalls.length > 0) {
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
              : {
                  ...s,
                  updatedAt: now(),
                  messages: [...s.messages, ...toolMessages]
                }
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
              : {
                  ...s,
                  updatedAt: now(),
                  messages: [...s.messages, finalAnswer]
                }
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
    upsertSession({
      ...activeSession,
      updatedAt: now(),
      messages: []
    });
    setError("");
  }

  return {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    setActiveSession,
    messages,
    settings,
    setSettings,
    sendMessage,
    clearChat,
    isLoading,
    error
  };
}
