/**
 * ExportChatButton.tsx
 *
 * Orchestrates chat export AND spec repo promotion. On success:
 *   1. exportChat()                       — builds .osmd + updates registry + persists DB ref
 *   2. downloadExportAsZip()              — delivers ZIP to browser (zip mode)
 *      pushBundleToGitHub()               — pushes .osmd bundle to GitHub (github mode)
 *      promoteConversationToSpecRepo()    — creates a new spec repo scaffold (spec-repo mode)
 *   3. onExported()                       — notifies parent to update React state immediately
 *
 * The onExported callback is optional so existing callers without it still work.
 */
import { useState } from "react";
import { exportChat, downloadExportAsZip } from "../lib/chatExport";
import {
  pushBundleToGitHub,
  promoteConversationToSpecRepo,
  getGithubPat,
} from "../lib/githubExport";
import type { ChatSession, ChatSettings, ChatExportRef } from "../lib/types";

interface Props {
  session: ChatSession | null;
  settings: ChatSettings;
  onExported?: (sessionId: string, exportRef: ChatExportRef) => void;
}

type Mode = "zip" | "github" | "spec-repo";
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
      if (mode === "spec-repo") {
        // Spec repo promotion — no .osmd bundle involved
        const pat = await getGithubPat();
        if (!pat) {
          setStatus("error");
          setMessage("No GitHub PAT — save one in Settings → GitHub Export");
          reset();
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

        setStatus("done");
        setMessage("Spec repo created ✓");
        setRepoUrl(result.repoUrl);
        reset();
        return;
      }

      // ZIP / GitHub .osmd export
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

  const buttonLabel: Record<Mode, string> = {
    zip: "Export Chat",
    github: "Export Chat",
    "spec-repo": "Promote to Spec Repo",
  };

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
        <button
          className={`export-mode-btn${
            mode === "spec-repo" ? " export-mode-btn--active" : ""
          }`}
          onClick={() => setMode("spec-repo")}
          aria-pressed={mode === "spec-repo"}
          title="Promote this conversation into a new Studio OS spec repo on GitHub"
        >
          🚀 Spec Repo
        </button>
      </div>

      {/* Mode description */}
      {mode === "spec-repo" && (
        <p className="export-mode-description">
          Creates a new GitHub repo with SPEC.md, SUMMARY.md, CONVERSATION.md,
          PROMPT_CHAIN.json, PROVENANCE.json, and full Studio OS scaffold.
        </p>
      )}

      {/* Action button */}
      <button
        className="export-chat-btn"
        onClick={handleExport}
        disabled={disabled}
        aria-label={
          mode === "spec-repo"
            ? "Promote current chat to a Studio OS spec repo on GitHub"
            : `Export current chat as ${mode === "zip" ? "ZIP" : "GitHub repo"}`
        }
      >
        {status === "busy"
          ? mode === "spec-repo"
            ? "Creating spec repo…"
            : "Exporting…"
          : buttonLabel[mode]}
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
