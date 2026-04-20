/**
 * github.ts — LLM-callable GitHub tools
 *
 * Registers two tools the model can invoke mid-conversation:
 *   github_read  — read a file from a GitHub repo
 *   github_push  — create or update a file in a GitHub repo
 *
 * Both tools resolve the stored PAT automatically via getGithubPat().
 * Uses Bearer auth to support both classic and fine-grained PATs.
 */

import type { ToolDefinition } from "../lib/types";
import { getGithubPat } from "../lib/githubExport";

const GITHUB_API = "https://api.github.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getPat(): Promise<string> {
  const pat = await getGithubPat();
  if (!pat) throw new Error("No GitHub PAT found. Go to Settings -> GitHub and save your token.");
  return pat;
}

function authHeaders(pat: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── github_read ───────────────────────────────────────────────────────────────

export const githubReadTool: ToolDefinition = {
  name: "github_read",
  description:
    "Read the contents of a file from a GitHub repository using the stored PAT. " +
    "Returns the decoded file content as a string. " +
    "Use this to inspect existing files before pushing updates.",
  inputSchema: {
    type: "object",
    properties: {
      owner: {
        type: "string",
        description: "GitHub repository owner (username or org)",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
      path: {
        type: "string",
        description: "File path within the repo, e.g. 'docs/spec.md'",
      },
      ref: {
        type: "string",
        description: "Branch, tag, or commit SHA (defaults to the repo default branch)",
      },
    },
    required: ["owner", "repo", "path"],
  },
  async run(args: unknown) {
    const { owner, repo, path, ref } = args as Record<string, string>;
    const pat = await getPat();
    const url = ref
      ? `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`
      : `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;

    const res = await fetch(url, { headers: authHeaders(pat) });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }
    const data = await res.json();
    if (data.encoding === "base64" && data.content) {
      const decoded = atob(data.content.replace(/\n/g, ""));
      return { path: data.path, sha: data.sha, content: decoded, size: data.size };
    }
    return { path: data.path, sha: data.sha, content: data.content ?? "", size: data.size };
  },
};

// ── github_push ───────────────────────────────────────────────────────────────

export const githubPushTool: ToolDefinition = {
  name: "github_push",
  description:
    "Create or update a file in a GitHub repository using the stored PAT. " +
    "If the file already exists, fetches its current SHA automatically before updating. " +
    "Returns the commit URL on success.",
  inputSchema: {
    type: "object",
    properties: {
      owner: {
        type: "string",
        description: "GitHub repository owner (username or org)",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
      path: {
        type: "string",
        description: "File path within the repo, e.g. 'docs/spec.md'",
      },
      content: {
        type: "string",
        description: "Full file content to write (plain text, not base64)",
      },
      message: {
        type: "string",
        description: "Commit message",
      },
      branch: {
        type: "string",
        description: "Branch to push to (defaults to the repo default branch)",
      },
    },
    required: ["owner", "repo", "path", "content", "message"],
  },
  async run(args: unknown) {
    const { owner, repo, path, content, message, branch } = args as Record<string, string>;
    const pat = await getPat();

    // Check if file exists to get its SHA (required for updates)
    let existingSha: string | undefined;
    try {
      const checkUrl = branch
        ? `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
        : `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
      const check = await fetch(checkUrl, { headers: authHeaders(pat) });
      if (check.ok) {
        const existing = await check.json();
        existingSha = existing.sha;
      }
    } catch {
      // File doesn't exist yet — that's fine, create it
    }

    const body: Record<string, string> = {
      message,
      content: btoa(unescape(encodeURIComponent(content))),
    };
    if (existingSha) body.sha = existingSha;
    if (branch) body.branch = branch;

    const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${path}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: authHeaders(pat),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`GitHub API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    return {
      success: true,
      path: data.content?.path,
      sha: data.content?.sha,
      commitUrl: data.commit?.html_url,
      commitMessage: data.commit?.message,
    };
  },
};
