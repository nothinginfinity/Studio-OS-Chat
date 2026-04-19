/**
 * GitHubSettings.tsx
 *
 * Settings panel for the GitHub Personal Access Token (PAT).
 * - Masked password input
 * - Save calls setGithubPat() from githubExport.ts
 * - Validate calls validateGithubPat() and shows the authed username
 * - Remove clears the stored PAT
 * - Inline success / error feedback
 */
import { useState, useEffect } from "react";
import {
  setGithubPat,
  getGithubPat,
  validateGithubPat,
} from "../lib/githubExport";

export function GitHubSettings() {
  const [pat, setPat] = useState("");
  const [savedPat, setSavedPat] = useState("");
  const [validating, setValidating] = useState(false);
  const [validUser, setValidUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load any already-saved PAT on mount
  useEffect(() => {
    getGithubPat().then((p) => {
      if (p) {
        setSavedPat(p);
        setPat(p);
      }
    });
  }, []);

  async function handleSave() {
    if (!pat.trim()) return;
    setValidating(true);
    setError(null);
    setValidUser(null);
    try {
      await setGithubPat(pat.trim());
      setSavedPat(pat.trim());
      const user = await validateGithubPat(pat.trim());
      if (user) {
        setValidUser(user);
      } else {
        setError("PAT saved but validation returned no user — check scopes.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid PAT");
    } finally {
      setValidating(false);
    }
  }

  async function handleRemove() {
    await setGithubPat("");
    setPat("");
    setSavedPat("");
    setValidUser(null);
    setError(null);
  }

  // Show only first 7 chars + dots for the saved key placeholder
  const masked = savedPat
    ? `${savedPat.slice(0, 7)}${"•".repeat(Math.max(0, savedPat.length - 7))}`
    : "";

  return (
    <div className="github-settings">
      <div className="settings-section-title">GitHub Export</div>
      <p className="provider-settings-note">
        🔒 PAT stored only on this device. Needs{" "}
        <code>repo</code> scope to create repos.
      </p>

      {validUser && (
        <p className="github-validated">
          ✓ Authenticated as <strong>{validUser}</strong>
        </p>
      )}
      {error && <p className="github-error">{error}</p>}

      <label className="field">
        <span>Personal Access Token</span>
        <input
          type="password"
          value={pat}
          placeholder={masked || "ghp_…"}
          onChange={(e) => setPat(e.target.value)}
          autoComplete="off"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
      </label>

      <div className="github-btn-row">
        <button
          className="github-save-btn"
          onClick={handleSave}
          disabled={validating || !pat.trim()}
        >
          {validating ? "Validating…" : "Save & Validate"}
        </button>
        {savedPat && (
          <button className="github-clear-btn" onClick={handleRemove}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
