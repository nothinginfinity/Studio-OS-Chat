import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { OfflineBanner } from "./components/OfflineBanner";
import { useChat } from "./hooks/useChat";
import { useSpaceMailbox } from "./hooks/useSpaceMailbox";
import { listAllFiles } from "./lib/db";

type Tab = "chats" | "library" | "files" | "spaces" | "settings";

export default function App() {
  const {
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
    activeAttachedFileId,
    activeAttachedCsvRows,
  } = useChat();

  // ---------------------------------------------------------------------------
  // Space mailbox — studio-os-chat ↔ studio-os-spaces
  // ---------------------------------------------------------------------------
  const spaceMailbox = useSpaceMailbox({
    spaceName: "studio-os-chat",
    pat: (settings as unknown as Record<string, string>).githubPat ?? "",
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

  // Task 4.4: Listen for "Analyze in Chat" event dispatched from FilesPanel
  useEffect(() => {
    async function handler(e: Event) {
      const { fileId } = (e as CustomEvent<{ fileId: string }>).detail;
      if (!fileId) return;
      // Resolve file name for session title
      let fileName: string | undefined;
      try {
        const files = await listAllFiles();
        fileName = files.find((f) => f.id === fileId)?.name;
      } catch {
        // non-fatal
      }
      await analyzeFileInChat(fileId, fileName);
      setSidebarTab("chats");
    }
    window.addEventListener("studio:analyze-file", handler);
    return () => window.removeEventListener("studio:analyze-file", handler);
  }, [analyzeFileInChat]);

  // ---------------------------------------------------------------------------
  // React to inbound space messages
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
        <span>Loading\u2026</span>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="app-loading" style={{ flexDirection: "column", gap: "12px", padding: "24px", textAlign: "center" }}>
        <span style={{ fontSize: "18px" }}>\u26a0\ufe0f Database error</span>
        <span style={{ fontSize: "13px", color: "#e08080", maxWidth: "480px" }}>{dbError}</span>
        <span style={{ fontSize: "12px", color: "#666" }}>
          Try clearing site data: Settings \u2192 Privacy \u2192 Clear browsing data \u2192 Cached images and files + Cookies.
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Fix C: OfflineBanner must be in the DOM when offline so chat.spec.ts
          [data-testid=offline-banner] assertion passes. OfflineBanner renders
          null when online, so there is no visible impact in normal usage. */}
      <OfflineBanner />
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
        {/* Task 4.4: pass attachedFileId + csvRows so ChatWindow can render inline charts */}
        <ChatWindow
          messages={messages}
          onSend={sendMessage}
          isLoading={isLoading}
          error={error}
          sessionId={activeSession?.id}
          attachedFileId={activeAttachedFileId}
          csvRows={activeAttachedCsvRows}
          draftText={draftText}
          onDraftChange={setDraftText}
        />
      </div>
    </>
  );
}
