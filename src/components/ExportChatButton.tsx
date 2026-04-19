/**
 * ExportChatButton.tsx
 *
 * Orchestrates chat export. On success:
 *   1. exportChat()            — builds .osmd + updates registry + persists DB ref
 *   2. downloadExportAsZip()   — delivers ZIP to browser (zip mode)
 *      pushBundleToGitHub()    — pushes to GitHub (github mode)
 *   3. onExported()            — notifies parent to update React state immediately
 *
 * The onExported callback is optional so existing callers without it still work.
 */
import { useState } from "react";
import { exportChat, downloadExportAsZip } from "../lib/chatExport";
import { pushBundleToGitHub, getGithubPat } from "../lib/githubExport";
import type { ChatSession, ChatSettings, ChatExportRef } from "../lib/types";

interface Props {
  session: ChatSession | null;
  settings: ChatSettings;
  onExported?: (sessionId: string, exportRef: ChatExportRef) => void;
}

type Mode = "zip" | "github";
type Status = "idle" | "busy" | "done" | "error";

export function ExportChatButton({ session, settings, onExported }: Props) {
  const [mode, setMode] = useState<Mode>("zip");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  function reset() {
    setTimeout(() => {
      setStatus("idle");
      setMessage("");
      setRepoUrl("");
    }, 7000);
  }

  async function handleExport() {
    if (!session) return;
    setStatus("busy");
    setMessage("");
    setRepoUrl("");

    try {
      const bundle = await exportChat(session, settings);

      if (mode === "zip") {
        await downloadExportAsZip(bundle);
        setStatus("done");
        setMessage("ZIP downloaded ✓");
      } else {
        const pat = await getGithubPat();
        if (!pat) {
          setStatus("error");
          setMessage("No GitHub PAT — save one in Settings → GitHub Export");
          reset();
          return;
        }
        const result = await pushBundleToGitHub(bundle, pat);
        setStatus("done");
        setMessage("Pushed to GitHub ✓");
        setRepoUrl(result.repoUrl);
      }

      // Notify parent so sidebar badge appears immediately without reload
      onExported?.(session.id, {
        artifactId: bundle.artifact.id,
        slug: bundle.slug,
        exportPath: bundle.osmdPath,
        exportedAt: bundle.artifact.createdAt,
        format: "osmd@1",
      });
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Export failed");
    } finally {
      reset();
    }
  }

  const disabled = !session || status === "busy";

  return (
    <div className="export-chat-widget">
      {/* Mode toggle */}
      <div className="export-mode-row">
        <button
          className={`export-mode-btn${
            mode === "zip" ? " export-mode-btn--active" : ""
          }`}
          onClick={() => setMode("zip")}
          aria-pressed={mode === "zip"}
        >
          ⬇️ ZIP
        </button>
        <button
          className={`export-mode-btn${
            mode === "github" ? " export-mode-btn--active" : ""
          }`}
          onClick={() => setMode("github")}
          aria-pressed={mode === "github"}
        >
          🐙 GitHub
        </button>
      </div>

      {/* Export button */}
      <button
        className="export-chat-btn"
        onClick={handleExport}
        disabled={disabled}
        aria-label={`Export current chat as ${mode === "zip" ? "ZIP" : "GitHub repo"}`}
      >
        {status === "busy" ? "Exporting…" : "Export Chat"}
      </button>

      {/* Feedback */}
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
          → Open repo
        </a>
      )}
    </div>
  );
}
