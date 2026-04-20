/**
 * PromoteToSpecRepoButton.tsx
 *
 * Self-contained button that promotes the active ChatSession into a
 * Studio OS spec repo scaffold and pushes it to GitHub.
 *
 * Usage:
 *   <PromoteToSpecRepoButton session={session} settings={settings} />
 */
import { useState } from "react";
import { getGithubPat, promoteConversationToSpecRepo } from "../lib/githubExport";
import type { ChatSession, ChatSettings } from "../lib/types";

interface Props {
  session: ChatSession | null;
  settings: ChatSettings;
  /** Called with the new repo URL on success */
  onPromoted?: (repoUrl: string) => void;
}

type Status = "idle" | "busy" | "done" | "error";

export function PromoteToSpecRepoButton({ session, settings, onPromoted }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  function scheduleReset() {
    setTimeout(() => {
      setStatus("idle");
      setMessage("");
      setRepoUrl("");
    }, 9000);
  }

  async function handlePromote() {
    if (!session) return;
    setStatus("busy");
    setMessage("");
    setRepoUrl("");

    try {
      const pat = await getGithubPat();
      if (!pat) {
        setStatus("error");
        setMessage("No GitHub PAT — save one in Settings → GitHub Export");
        scheduleReset();
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
        false // public by default — user can change in GitHub after
      );

      setStatus("done");
      setMessage("Spec repo created ✓");
      setRepoUrl(result.repoUrl);
      onPromoted?.(result.repoUrl);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      scheduleReset();
    }
  }

  const disabled = !session || status === "busy";

  return (
    <div className="promote-spec-repo-widget">
      <button
        className="promote-spec-repo-btn"
        onClick={handlePromote}
        disabled={disabled}
        aria-label="Promote this conversation to a Studio OS spec repo on GitHub"
      >
        {status === "busy" ? "Creating spec repo…" : "🚀 Promote to Spec Repo"}
      </button>

      {message && (
        <p className={`export-status export-status--${status}`}>
          {message}
        </p>
      )}

      {repoUrl && (
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="export-repo-link"
        >
          → Open spec repo
        </a>
      )}
    </div>
  );
}
