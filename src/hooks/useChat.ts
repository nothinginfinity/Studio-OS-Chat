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
  OllamaMessage,
  ToolCall
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

    upsertSession({
      ...session,
      title: session.messages.length ? session.title : trimmed.slice(0, 40),
      updatedAt: now(),
      messages: [...session.messages, userMessage, assistantDraft]
    });

    setIsLoading(true);

    try {
      // Accumulate tool calls across chunks — push, never overwrite
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
            // Accumulate, preserving provider-supplied IDs where present
            for (const call of toolCalls) {
              streamedToolCalls.push({
                // Keep the model's own ID if it provided one; fall back to local uid
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

      // firstResponse.message.content is now the fully accumulated streamed text
      // (ollama.ts returns a synthesized response, not the final stats chunk)
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
            // Preserve the provider-supplied call ID for the round-trip
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
