import { useMemo, useState } from "react";
import { loadMessages, loadSettings, saveMessages, saveSettings } from "../lib/storage";
import { chatWithOllama } from "../lib/ollama";
import { now, uid } from "../lib/utils";
import type { ChatMessage, ChatSettings, OllamaMessage } from "../lib/types";
import { usePersistentState } from "./usePersistentState";

export function useChat() {
  const [messages, setMessages] = usePersistentState<ChatMessage[]>(
    loadMessages,
    saveMessages
  );

  const [settings, setSettings] = usePersistentState<ChatSettings>(
    loadSettings,
    saveSettings
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const ollamaMessages = useMemo<OllamaMessage[]>(() => {
    const base: OllamaMessage[] = [{ role: "system", content: settings.systemPrompt }];
    for (const msg of messages) {
      if (msg.role === "user" || msg.role === "assistant") {
        base.push({ role: msg.role, content: msg.content });
      }
    }
    return base;
  }, [messages, settings.systemPrompt]);

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isLoading) return;
    setError("");

    const userMessage: ChatMessage = { id: uid(), role: "user", content: trimmed, createdAt: now() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setIsLoading(true);

    try {
      const reply = await chatWithOllama({
        baseUrl: settings.ollamaBaseUrl,
        model: settings.model,
        messages: [...ollamaMessages, { role: "user", content: trimmed }]
      });
      const assistantMessage: ChatMessage = { id: uid(), role: "assistant", content: reply, createdAt: now() };
      setMessages([...nextMessages, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  return { messages, settings, setSettings, sendMessage, clearChat, isLoading, error };
}
