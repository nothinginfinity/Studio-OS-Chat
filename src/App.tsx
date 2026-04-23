import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { useChat } from "./hooks/useChat";
import { useSpaceMailbox } from "./hooks/useSpaceMailbox";

type Tab = "chats" | "library" | "files" | "spaces" | "settings";

export default function App() {
  const {
    sessions,
    activeSession,
    activeSessionId,
    createSession,
    createSessionWithDraft,
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
  } = useChat();

  // ---------------------------------------------------------------------------
  // Space mailbox — studio-os-chat ↔ studio-os-spaces
  // PAT comes from settings.githubPat (GitHubSettings.tsx handles storage).
  // Polling every 30 s; skipped silently if no PAT is configured yet.
  // ---------------------------------------------------------------------------
  const spaceMailbox = useSpaceMailbox({
    spaceName: "studio-os-chat",
    pat: (settings as Record<string, string>).githubPat ?? "",
    pollIntervalMs: 30_000,
  });

  const [sidebarTab, setSidebarTab] = useState<Tab>("chats");

  const handleInsertPrompt = useCallback((content: string) => {
    reusePromptText(content);
  }, [reusePromptText]);

  // Listen for file-preview sheet "Summarize in new chat" action
  useEffect(() => {
    async function handler(e: Event) {
      const { previewText, name } = (e as CustomEvent<{ previewText: string; name: string }>).detail;
      const prompt = `Summarize and analyse the following content from "${name}":\n\n${previewText}`;
      await createSessionWithDraft(prompt);
      setSidebarTab("chats");
    }
    window.addEventListener("studio:new-chat-from-file", handler);
    return () => window.removeEventListener("studio:new-chat-from-file", handler);
  }, [createSessionWithDraft]);

  // ---------------------------------------------------------------------------
  // React to inbound space messages
  // Any envelope arriving in inbox with body starting "draft:" is auto-loaded
  // as a chat draft so the user can review and send it.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const latest = spaceMailbox.inbox[0];
    if (!latest) return;
    if (latest.body.startsWith("draft:")) {
      const text = latest.body.replace(/^draft:\s*/i, "");
      setDraftText(text);
      setSidebarTab("chats");
    }
  }, [spaceMailbox.inbox, setDraftText]);

  if (!dbReady) {
    return (
      <div className="app-loading">
        <span>Loading…</span>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="app-loading" style={{ flexDirection: "column", gap: "12px", padding: "24px", textAlign: "center" }}>
        <span style={{ fontSize: "18px" }}>⚠️ Database error</span>
        <span style={{ fontSize: "13px", color: "#e08080", maxWidth: "480px" }}>{dbError}</span>
        <span style={{ fontSize: "12px", color: "#666" }}>
          Try clearing site data: Settings → Privacy → Clear browsing data → Cached images and files + Cookies.
        </span>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        settings={settings}
        setSettings={setSettings}
        onClearChat={clearChat}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSession}
        onNewSession={() => createSession()}
        onRenameSession={renameSession}
        onSessionExported={markSessionExported}
        onInsertPrompt={handleInsertPrompt}
        onReusePrompt={reusePromptText}
        onCreateSessionWithDraft={createSessionWithDraft}
        onDeleteSession={deleteSession}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        spaceMailbox={spaceMailbox}
      />
      <ChatWindow
        messages={messages}
        onSend={sendMessage}
        isLoading={isLoading}
        error={error}
        sessionId={activeSession?.id}
        draftText={draftText}
        onDraftChange={setDraftText}
      />
    </div>
  );
}
