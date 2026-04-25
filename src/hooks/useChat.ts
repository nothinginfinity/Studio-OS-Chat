import { useEffect, useMemo, useState, useCallback } from "react";
import {
  putSession,
  listSessions,
  putMessages,
  listMessages,
  renameSession as dbRenameSession,
  deleteSession as dbDeleteSession,
  listAllFiles
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
import {
  chatWithOpenAIStream,
  chatWithOpenAIOnce
} from "../lib/openai";
import { getProvider } from "../lib/providers";
import { now, uid } from "../lib/utils";
import { deriveSessionTitle } from "../components/SessionTitleEditor";
import type {
  ChatMessage,
  ChatSession,
  ChatSettings,
  ChatExportRef,
  MessageRecord,
  OllamaMessage,
  SessionRecord,
  ToolCall
} from "../lib/types";
import { usePersistentState } from "./usePersistentState";
import { toolRegistry, getToolByName } from "../tools/registry";
import { createChatSession } from "../lib/chatSession";
import { buildFileContext } from "../lib/fileContext";
import { listChunksByFile } from "../lib/db";

function sessionToRecord(s: ChatSession, messageCount: number): SessionRecord {
  return {
    id: s.id,
    title: s.title,
    titleSource: s.titleSource,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount,
    exportArtifactId: s.exportRef?.artifactId,
    exportPath: s.exportRef?.exportPath,
    exportedAt: s.exportRef?.exportedAt,
    exportFormat: s.exportRef?.format,
  };
}

function deriveSlugFromExportPath(path: string): string {
  return path.split("/").pop()?.replace(/\.osmd$/, "") ?? path;
}

function buildFileIndexAppendix(filePaths: string[]): string {
  if (!filePaths.length) return "";
  const list = filePaths.map((p) => `  • ${p}`).join("\n");
  return (
    `\n\n--- Indexed files (${filePaths.length}) ---\n` +
    list +
    `\n---\n` +
    `When the user asks about any of these files or their content, ` +
    `call the file_search tool FIRST before answering. ` +
    `After receiving tool results, synthesize them into a clear, helpful answer in your own words. ` +
    `Do NOT repeat file paths, scores, chunk IDs, or raw snippets in your reply — ` +
    `always translate retrieved content into useful human language. ` +
    `Never say no files are available when this list is non-empty.`
  );
}

// Extended session type that carries the file attachment id in memory only
type AttachedSession = ChatSession & { attachedFileId?: string };

export function useChat() {
  const [sessions, setSessions] = useState<AttachedSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [settings, setSettings] = usePersistentState<ChatSettings>(
    loadSettings,
    saveSettings
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [indexedFilePaths, setIndexedFilePaths] = useState<string[]>([]);
  const [draftText, setDraftText] = useState("");
  // csvRows for the active attached file — kept in memory for ChatWindow
  const [activeAttachedCsvRows, setActiveAttachedCsvRows] = useState<Record<string, string>[]>([]);

  const refreshFileIndex = useCallback(async () => {
    try {
      const files = await listAllFiles();
      setIndexedFilePaths(files.map((f) => f.path));
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    async function loadFromDb() {
      try {
        const records = await listSessions();
        const hydrated: AttachedSession[] = await Promise.all(
          records.map(async (rec) => {
            const msgs = await listMessages(rec.id);
            return {
              id: rec.id,
              title: rec.title,
              titleSource: rec.titleSource,
              createdAt: rec.createdAt,
              updatedAt: rec.updatedAt,
              messages: msgs as ChatMessage[],
              exportRef:
                rec.exportArtifactId && rec.exportPath && rec.exportedAt
                  ? {
                      artifactId: rec.exportArtifactId,
                      slug: deriveSlugFromExportPath(rec.exportPath),
                      exportPath: rec.exportPath,
                      exportedAt: rec.exportedAt,
                      format: "osmd@1" as const,
                    }
                  : undefined,
            };
          })
        );
        setSessions(hydrated.sort((a, b) => b.updatedAt - a.updatedAt));
        if (hydrated.length > 0) setActiveSessionIdState(hydrated[0].id);
      } catch (err) {
        console.error("[useChat] loadFromDb failed:", err);
        setDbError(
          err instanceof Error ? err.message : "Database failed to open. Try clearing site data."
        );
      } finally {
        setDbReady(true);
      }
    }
    loadFromDb();
  }, []);

  useEffect(() => {
    if (dbReady) refreshFileIndex();
  }, [dbReady, refreshFileIndex]);

  async function persistSessionMeta(session: AttachedSession, msgCount: number) {
    await putSession(sessionToRecord(session, msgCount));
  }

  async function persistSessionMessages(sessionId: string, messages: ChatMessage[]) {
    const records: MessageRecord[] = messages.map((m) => ({
      id: m.id,
      sessionId,
      role: m.role as "user" | "assistant" | "tool",
      content: m.content,
      createdAt: m.createdAt,
      status: m.status,
      toolName: m.toolName,
      toolData: m.toolData,
      toolCallId: m.toolCallId,
      toolCalls: m.toolCalls
    }));
    await putMessages(records);
  }

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) ??
    sessions[0] ??
    null;

  const messages = activeSession?.messages ?? [];

  // The attachedFileId of the currently active session (in-memory only)
  const activeAttachedFileId = activeSession?.attachedFileId;

  async function upsertSession(next: AttachedSession) {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === next.id);
      if (!exists) return [next, ...prev];
      return prev.map((s) => (s.id === next.id ? next : s));
    });
    await persistSessionMeta(next, next.messages.length);
    await persistSessionMessages(next.id, next.messages);
  }

  async function createSession(initialMessage?: string) {
    const session: AttachedSession = {
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

  // ── Task 4.2: analyzeFileInChat ─────────────────────────────────────────────
  // Creates a new chat session bound to a CSV file. Loads csvRows into memory
  // for ChatWindow prop threading (task 4.4). Does NOT fire any LLM call.
  const analyzeFileInChat = useCallback(async (fileId: string, fileName?: string) => {
    const sessionObj = createChatSession({
      attachedFileId: fileId,
      title: fileName ? `Analyze: ${fileName}` : "CSV Analysis",
    });

    const session: AttachedSession = {
      ...sessionObj,
      attachedFileId: fileId,
    };

    await upsertSession(session);
    setActiveSessionIdState(session.id);
    setDraftText("");
    setError("");

    // Pre-load csvRows so ChatWindow can pass them to MessageList for chart rendering
    try {
      const allFiles = await listAllFiles();
      const file = allFiles.find((f) => f.id === fileId);
      if (file?.csvMeta) {
        const chunks = await listChunksByFile(fileId);
        const allText = chunks.map((c) => c.text).join("\n");
        const lines = allText.split("\n").filter((l) => l.trim() !== "");
        const cols = file.csvMeta.columns.map((c) => c.name);
        const parsed = lines.map((line) => {
          const vals = line.split(",");
          const row: Record<string, string> = {};
          cols.forEach((col, i) => { row[col] = vals[i] ?? ""; });
          return row;
        });
        setActiveAttachedCsvRows(parsed);
      } else {
        setActiveAttachedCsvRows([]);
      }
    } catch {
      setActiveAttachedCsvRows([]);
    }

    return session;
  }, []);

  const reusePromptText = useCallback((text: string) => {
    setDraftText(text);
  }, []);

  const appendPromptText = useCallback((text: string) => {
    setDraftText((prev) => {
      if (!prev.trim()) return text;
      return `${prev}\n\n${text}`;
    });
  }, []);

  async function createSessionWithDraft(text: string) {
    const session = await createSession(text);
    setActiveSessionIdState(session.id);
    setDraftText(text);
    return session;
  }

  const deleteSession = useCallback(async (sessionId: string) => {
    await dbDeleteSession(sessionId);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      return next;
    });
    setActiveSessionIdState((prev) => {
      if (prev !== sessionId) return prev;
      const remaining = sessions.filter((s) => s.id !== sessionId);
      return remaining[0]?.id ?? null;
    });
  }, [sessions]);

  function setActiveSession(id: string) {
    setActiveSessionIdState(id);
    setError("");
    // Clear attached csv rows when switching away from a file-backed session
    setSessions((prev) => {
      const next = prev.find((s) => s.id === id);
      if (!next?.attachedFileId) setActiveAttachedCsvRows([]);
      return prev;
    });
  }

  async function renameSession(sessionId: string, title: string) {
    await dbRenameSession(sessionId, title);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, title, titleSource: "manual" } : s
      )
    );
  }

  const markSessionExported = useCallback(
    (sessionId: string, exportRef: ChatExportRef) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, exportRef } : s))
      );
    },
    []
  );

  const effectiveSystemPrompt = useMemo(() => {
    return settings.systemPrompt + buildFileIndexAppendix(indexedFilePaths);
  }, [settings.systemPrompt, indexedFilePaths]);

  const ollamaMessages = useMemo<OllamaMessage[]>(() => {
    const base: OllamaMessage[] = [
      { role: "system", content: effectiveSystemPrompt }
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
  }, [messages, effectiveSystemPrompt]);

  const isOllama = settings.provider === "ollama" || !settings.provider;

  // ── Task 4.3: buildFileContext injection helper ─────────────────────────────
  // Returns a file-context prefix to prepend to the system prompt on the FIRST
  // user message of a file-attached session. Returns "" on any error.
  async function buildFileContextForSession(session: AttachedSession): Promise<string> {
    if (!session.attachedFileId) return "";
    if (session.messages.filter((m) => m.role === "user").length > 0) return ""; // not first
    try {
      const allFiles = await listAllFiles();
      const file = allFiles.find((f) => f.id === session.attachedFileId);
      if (!file?.csvMeta) return "";
      const chunks = await listChunksByFile(file.id);
      const allText = chunks.map((c) => c.text).join("\n");
      const lines = allText.split("\n").filter((l) => l.trim() !== "");
      const cols = file.csvMeta.columns.map((c) => c.name);
      const rows = lines.map((line) => {
        const vals = line.split(",");
        const row: Record<string, string> = {};
        cols.forEach((col, i) => { row[col] = vals[i] ?? ""; });
        return row;
      });
      return buildFileContext(file, rows);
    } catch {
      return "";
    }
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;

    setError("");
    const session = activeSession ?? await createSession(trimmed);

    // Task 4.3: inject file context into system prompt on first message
    const fileContextBlock = await buildFileContextForSession(session);
    const systemPromptForCall = fileContextBlock
      ? `${fileContextBlock}\n\n${effectiveSystemPrompt}`
      : effectiveSystemPrompt;

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

    const sessionWithUser: AttachedSession = {
      ...session,
      title: session.messages.length === 0
        ? deriveSessionTitle([{ role: "user", content: trimmed }])
        : session.title,
      titleSource: session.messages.length === 0 ? "auto" : session.titleSource,
      updatedAt: now(),
      messages: [...session.messages, userMessage, assistantDraft]
    };
    await upsertSession(sessionWithUser);

    setIsLoading(true);

    try {
      const streamedToolCalls: ToolCall[] = [];
      const allMessages: OllamaMessage[] = [
        { role: "system", content: systemPromptForCall },
        ...ollamaMessages.slice(1), // skip original system message, use ours
        { role: "user", content: trimmed }
      ];

      if (!isOllama) {
        const provider = getProvider(settings.provider);
        if (!provider) throw new Error(`Unknown provider: ${settings.provider}`);
        if (!settings.apiKey) throw new Error(`No API key set for ${provider.name}. Go to ⚙️ Settings → ${provider.name} → Save your key.`);

        const result = await chatWithOpenAIStream(
          {
            baseUrl: provider.baseUrl,
            apiKey: settings.apiKey,
            model: settings.model,
            messages: allMessages,
            tools: toolRegistry
          },
          {
            onTextDelta: (chunk) => {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id !== session.id ? s : {
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
            onToolCalls: (calls) => {
              for (const c of calls) streamedToolCalls.push(c);
            }
          }
        );

        const finalAssistant: ChatMessage = {
          id: assistantDraftId,
          role: "assistant",
          content: result.content,
          createdAt: assistantDraft.createdAt,
          status: "complete",
          toolCalls: streamedToolCalls.length ? streamedToolCalls : undefined
        };

        setSessions((prev) =>
          prev.map((s) =>
            s.id !== session.id ? s : {
              ...s, updatedAt: now(),
              messages: [...s.messages.filter((m) => m.id !== assistantDraftId), finalAssistant]
            }
          )
        );

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== session.id || s.titleSource !== "auto") return s;
            const refined = deriveSessionTitle([
              { role: "user", content: trimmed },
              { role: "assistant", content: result.content }
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
            const result2 = await tool.run(call.function.arguments);
            toolMessages = [...toolMessages, {
              id: uid(), role: "tool", content: JSON.stringify(result2),
              createdAt: now(), toolName: tool.name, toolData: result2, toolCallId: call.id
            }];
          }
          setSessions((prev) =>
            prev.map((s) =>
              s.id !== session.id ? s : { ...s, updatedAt: now(), messages: [...s.messages, ...toolMessages] }
            )
          );
          const followup = await chatWithOpenAIOnce({
            baseUrl: provider.baseUrl,
            apiKey: settings.apiKey,
            model: settings.model,
            messages: [
              ...allMessages,
              { role: "assistant", content: finalAssistant.content, tool_calls: streamedToolCalls },
              ...toolMessages.map((m) => ({
                role: "tool" as const, content: m.content,
                tool_name: m.toolName, tool_call_id: m.toolCallId
              }))
            ],
            tools: toolRegistry
          });
          setSessions((prev) =>
            prev.map((s) =>
              s.id !== session.id ? s : {
                ...s, updatedAt: now(),
                messages: [...s.messages, { id: uid(), role: "assistant", content: followup.content, createdAt: now(), status: "complete" }]
              }
            )
          );
        }

        await refreshFileIndex();
        return;
      }

      // ── Ollama path ───────────────────────────────────────────────────────
      const firstResponse = await chatWithOllamaStream(
        {
          baseUrl: settings.ollamaBaseUrl,
          model: settings.model,
          messages: allMessages,
          tools: buildOllamaTools(toolRegistry)
        },
        {
          onTextDelta: (chunk) => {
            setSessions((prev) =>
              prev.map((s) =>
                s.id !== session.id ? s : {
                  ...s, updatedAt: now(),
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
                function: { name: call.function.name, arguments: call.function.arguments }
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
          s.id !== session.id ? s : {
            ...s, updatedAt: now(),
            messages: [...s.messages.filter((m) => m.id !== assistantDraftId), finalAssistantMessage]
          }
        )
      );

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
          toolMessages = [...toolMessages, {
            id: uid(), role: "tool", content: JSON.stringify(result),
            createdAt: now(), toolName: tool.name, toolData: result, toolCallId: call.id
          }];
        }
        setSessions((prev) =>
          prev.map((s) =>
            s.id !== session.id ? s : { ...s, updatedAt: now(), messages: [...s.messages, ...toolMessages] }
          )
        );
        const followup = await chatWithOllamaOnce({
          baseUrl: settings.ollamaBaseUrl,
          model: settings.model,
          messages: [
            ...allMessages,
            { role: "assistant", content: finalAssistantMessage.content, tool_calls: streamedToolCalls },
            ...toolMessages.map((m) => ({
              role: "tool" as const, content: m.content,
              tool_name: m.toolName, tool_call_id: m.toolCallId
            }))
          ],
          tools: buildOllamaTools(toolRegistry)
        });
        setSessions((prev) =>
          prev.map((s) =>
            s.id !== session.id ? s : {
              ...s, updatedAt: now(),
              messages: [...s.messages, { id: uid(), role: "assistant", content: followup.message?.content ?? "", createdAt: now(), status: "complete" }]
            }
          )
        );
      }

      await refreshFileIndex();
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
    createSessionWithDraft,
    analyzeFileInChat,
    deleteSession,
    setActiveSession,
    renameSession,
    markSessionExported,
    messages,
    settings,
    setSettings,
    sendMessage,
    clearChat,
    isLoading,
    error,
    dbReady,
    dbError,
    draftText,
    setDraftText,
    reusePromptText,
    appendPromptText,
    activeAttachedFileId,
    activeAttachedCsvRows,
  };
}
