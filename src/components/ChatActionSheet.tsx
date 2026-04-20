import { useState } from "react";
import { ActionSheetBase } from "./ActionSheetBase";
import { getGithubPat, promoteConversationToSpecRepo } from "../lib/githubExport";
import type { ChatSession, ChatSettings } from "../lib/types";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface Props {
  session: ChatSession | null;
  settings: ChatSettings;
  onClose: () => void;
  onOpen: (sessionId: string) => void;
  onRename: (sessionId: string) => void;
  onExport: (sessionId: string) => void;
  onCopyExportPath: (path: string) => void;
  onDelete: (sessionId: string) => void;
}

type PromoteStatus = "idle" | "busy" | "done" | "error";

export function ChatActionSheet({
  session,
  settings,
  onClose,
  onOpen,
  onRename,
  onExport,
  onCopyExportPath,
  onDelete,
}: Props) {
  const [promoteStatus, setPromoteStatus] = useState<PromoteStatus>("idle");
  const [promoteMsg, setPromoteMsg] = useState("");
  const [promoteUrl, setPromoteUrl] = useState("");

  if (!session) return null;

  const exported = !!session.exportRef;
  const msgCount = session.messages.length;

  async function handlePromote() {
    if (!session) return;
    setPromoteStatus("busy");
    setPromoteMsg("");
    setPromoteUrl("");

    try {
      const pat = await getGithubPat();
      if (!pat) {
        setPromoteStatus("error");
        setPromoteMsg("No GitHub PAT — save one in Settings → GitHub Export");
        setTimeout(() => { setPromoteStatus("idle"); setPromoteMsg(""); }, 6000);
        return;
      }

      const result = await promoteConversationToSpecRepo(
        session,
        pat,
        settings,
        {
          title: session.title,
          source: "Studio-OS-Chat",
          sourceChatSurface: "studio-os-chat",
          exportTime: new Date().toISOString(),
          brainstormModel: settings.model ?? null,
          brainstormProvider: settings.provider ?? null,
        },
        false
      );

      setPromoteStatus("done");
      setPromoteMsg("Spec repo created ✓");
      setPromoteUrl(result.repoUrl);
    } catch (err) {
      setPromoteStatus("error");
      setPromoteMsg(err instanceof Error ? err.message : "Promotion failed");
      setTimeout(() => { setPromoteStatus("idle"); setPromoteMsg(""); }, 6000);
    }
  }

  return (
    <ActionSheetBase onBackdropClick={onClose} ariaLabel="Chat actions" zIndex={1100}>
      <div className="action-sheet-handle" />

      {/* Session detail header */}
      <div className="action-sheet-detail">
        <div className="action-sheet-detail-meta">
          {exported && (
            <span className="action-sheet-detail-badge">Exported</span>
          )}
          <span className="action-sheet-detail-time">
            {relativeTime(session.updatedAt)}
          </span>
          <span className="action-sheet-detail-time">
            {msgCount} {msgCount === 1 ? "message" : "messages"}
          </span>
        </div>
        <div className="action-sheet-detail-title">{session.title}</div>
        {exported && session.exportRef?.exportPath && (
          <div className="action-sheet-export-path">
            {session.exportRef.exportPath}
          </div>
        )}
      </div>

      <div className="action-sheet-divider" />

      <div className="action-sheet-actions">
        <button
          className="action-sheet-btn"
          onClick={() => { onOpen(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">💬</span>
          <span className="action-sheet-btn-label">
            <strong>Open chat</strong>
            <span className="action-sheet-btn-hint">Switch to this conversation</span>
          </span>
        </button>

        <button
          className="action-sheet-btn"
          onClick={() => { onRename(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">✏️</span>
          <span className="action-sheet-btn-label">
            <strong>Rename</strong>
            <span className="action-sheet-btn-hint">Edit conversation title</span>
          </span>
        </button>

        <button
          className="action-sheet-btn"
          onClick={() => { onExport(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">⬆️</span>
          <span className="action-sheet-btn-label">
            <strong>Export chat</strong>
            <span className="action-sheet-btn-hint">Save as .osmd to GitHub</span>
          </span>
        </button>

        {/* Promote to Spec Repo */}
        <button
          className="action-sheet-btn"
          onClick={handlePromote}
          disabled={promoteStatus === "busy"}
          aria-label="Promote this conversation to a Studio OS spec repo on GitHub"
        >
          <span className="action-sheet-btn-icon">🚀</span>
          <span className="action-sheet-btn-label">
            <strong>
              {promoteStatus === "busy" ? "Creating spec repo…" : "Promote to Spec Repo"}
            </strong>
            <span className="action-sheet-btn-hint">
              {promoteStatus === "done" && promoteUrl
                ? promoteUrl
                : promoteStatus === "error"
                ? promoteMsg
                : "Push conversation to a new GitHub spec repo"}
            </span>
          </strong>
          </span>
        </button>

        {promoteStatus === "done" && promoteUrl && (
          <a
            href={promoteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="action-sheet-btn action-sheet-btn--link"
            onClick={onClose}
          >
            <span className="action-sheet-btn-icon">🔗</span>
            <span className="action-sheet-btn-label">
              <strong>Open spec repo</strong>
              <span className="action-sheet-btn-hint">{promoteUrl}</span>
            </span>
          </a>
        )}

        {exported && session.exportRef?.exportPath && (
          <button
            className="action-sheet-btn"
            onClick={() => {
              onCopyExportPath(session.exportRef!.exportPath);
              onClose();
            }}
          >
            <span className="action-sheet-btn-icon">⎘</span>
            <span className="action-sheet-btn-label">
              <strong>Copy export path</strong>
              <span className="action-sheet-btn-hint">{session.exportRef.exportPath}</span>
            </span>
          </button>
        )}

        <button
          className="action-sheet-btn action-sheet-btn--destructive"
          onClick={() => { onDelete(session.id); onClose(); }}
        >
          <span className="action-sheet-btn-icon">🗑</span>
          <span className="action-sheet-btn-label">
            <strong>Delete chat</strong>
            <span className="action-sheet-btn-hint">Remove this conversation</span>
          </span>
        </button>
      </div>

      <button className="action-sheet-cancel" onClick={onClose}>Cancel</button>
    </ActionSheetBase>
  );
}
