/**
 * githubExport.ts — v1
 *
 * GitHub API bridge: takes a ChatExportBundle and:
 *   1. Creates a new GitHub repo named after the bundle slug
 *   2. Pushes all bundle files in a single commit via the Git Data API
 *   3. Returns the repo URL and stamps it back onto the ArtifactRecord
 *
 * Auth: requires a GitHub Personal Access Token (PAT) with `repo` scope.
 * The PAT is stored in the settings store under key "github_pat" — never
 * hard-coded or committed. The user provides it once via settings UI.
 *
 * Why not isomorphic-git?
 * isomorphic-git is great for local clone/read/write but browser push still
 * needs careful CORS/auth handling. The GitHub REST API (fetch-based) is
 * simpler, more reliable, and doesn't require a proxy for public repos.
 *
 * API calls made:
 *   POST /user/repos              — create the repo
 *   POST /repos/{owner}/{repo}/git/blobs  — one per file
 *   POST /repos/{owner}/{repo}/git/trees  — one tree with all blobs
 *   POST /repos/{owner}/{repo}/git/commits— one commit
 *   PATCH /repos/{owner}/{repo}/git/refs/heads/main — update HEAD
 */

import { getSetting, putSetting } from "./db";
import { updateArtifactRepoUrl } from "./chatExport";
import type { ChatExportBundle } from "./chatExport";

const GH_API = "https://api.github.com";
const PAT_KEY = "github_pat";
const GH_USER_KEY = "github_user";

// ── PAT helpers ─────────────────────────────────────────────────────────────────

export async function getGithubPat(): Promise<string | null> {
  return getSetting<string>(PAT_KEY);
}

export async function setGithubPat(pat: string): Promise<void> {
  await putSetting(PAT_KEY, pat.trim());
  // Clear cached user so it re-validates on next call
  await putSetting(GH_USER_KEY, null);
}

// ── Authenticated fetch ──────────────────────────────────────────────────────────

async function ghFetch(
  path: string,
  pat: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${GH_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

async function ghPost<T>(path: string, pat: string, body: unknown): Promise<T> {
  const res = await ghFetch(path, pat, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API POST ${path} failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<T>;
}

async function ghPatch<T>(path: string, pat: string, body: unknown): Promise<T> {
  const res = await ghFetch(path, pat, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API PATCH ${path} failed (${res.status}): ${err}`);
  }
  return res.json() as Promise<T>;
}

// ── Resolve authenticated user ──────────────────────────────────────────────────

async function resolveGithubUser(pat: string): Promise<string> {
  const cached = await getSetting<string>(GH_USER_KEY);
  if (cached) return cached;

  const res = await ghFetch("/user", pat);
  if (!res.ok) throw new Error("Invalid GitHub PAT or network error");
  const data = (await res.json()) as { login: string };
  await putSetting(GH_USER_KEY, data.login);
  return data.login;
}

// ── Git Data API helpers ─────────────────────────────────────────────────────────

interface BlobResponse { sha: string; }
interface TreeResponse { sha: string; }
interface CommitResponse { sha: string; html_url: string; }
interface RefResponse { object: { sha: string }; }
interface RepoResponse { html_url: string; default_branch: string; }

async function createBlob(
  owner: string, repo: string, pat: string, content: string
): Promise<string> {
  const res = await ghPost<BlobResponse>(
    `/repos/${owner}/${repo}/git/blobs`,
    pat,
    { content: btoa(unescape(encodeURIComponent(content))), encoding: "base64" }
  );
  return res.sha;
}

async function createTree(
  owner: string,
  repo: string,
  pat: string,
  baseTreeSha: string,
  entries: Array<{ path: string; sha: string }>
): Promise<string> {
  const res = await ghPost<TreeResponse>(
    `/repos/${owner}/${repo}/git/trees`,
    pat,
    {
      base_tree: baseTreeSha,
      tree: entries.map(({ path, sha }) => ({
        path,
        mode: "100644",
        type: "blob",
        sha,
      })),
    }
  );
  return res.sha;
}

async function createCommit(
  owner: string,
  repo: string,
  pat: string,
  message: string,
  treeSha: string,
  parentSha: string
): Promise<string> {
  const res = await ghPost<CommitResponse>(
    `/repos/${owner}/${repo}/git/commits`,
    pat,
    { message, tree: treeSha, parents: [parentSha] }
  );
  return res.sha;
}

async function getRef(
  owner: string, repo: string, pat: string, branch: string
): Promise<RefResponse> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, pat);
  if (!res.ok) throw new Error(`Could not get ref for branch ${branch}`);
  return res.json() as Promise<RefResponse>;
}

async function updateRef(
  owner: string, repo: string, pat: string, branch: string, sha: string
): Promise<void> {
  await ghPatch(
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    pat,
    { sha, force: false }
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface GitHubExportResult {
  repoUrl: string;
  repoName: string;
  owner: string;
  commitSha: string;
}

/**
 * Push a ChatExportBundle to a new GitHub repository.
 *
 * Steps:
 *   1. Resolve the authenticated GitHub user from the PAT
 *   2. Create a new private repo named after bundle.slug
 *   3. Upload each file as a blob
 *   4. Create a tree pointing to all blobs
 *   5. Create a commit on top of the repo's initial commit
 *   6. Fast-forward the default branch ref
 *   7. Stamp the repo URL back onto the ArtifactRecord
 *
 * @param bundle     The ChatExportBundle from exportChat()
 * @param pat        GitHub PAT with `repo` scope
 * @param isPrivate  Whether to create the repo as private (default: true)
 */
export async function pushBundleToGitHub(
  bundle: ChatExportBundle,
  pat: string,
  isPrivate = true
): Promise<GitHubExportResult> {
  // 1. Resolve user
  const owner = await resolveGithubUser(pat);

  // 2. Create repo (auto_init: true gives us an initial commit + main branch)
  const repoName = bundle.slug.slice(0, 100); // GitHub repo name limit
  const repoData = await ghPost<RepoResponse>("/user/repos", pat, {
    name: repoName,
    description: `Studio-OS-Chat export: ${bundle.artifact.slug}`,
    private: isPrivate,
    auto_init: true,
  });

  const defaultBranch = repoData.default_branch ?? "main";

  // 3. Get the SHA of the initial commit so we can parent our commit off it
  const ref = await getRef(owner, repoName, pat, defaultBranch);
  const parentSha = ref.object.sha;

  // We need the tree SHA of the initial commit to use as base_tree
  const commitRes = await ghFetch(
    `/repos/${owner}/${repoName}/git/commits/${parentSha}`,
    pat
  );
  if (!commitRes.ok) throw new Error("Could not fetch initial commit");
  const initialCommit = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = initialCommit.tree.sha;

  // 4. Create blobs for each file
  const blobEntries: Array<{ path: string; sha: string }> = [];
  for (const [filePath, content] of Object.entries(bundle.files)) {
    const blobSha = await createBlob(owner, repoName, pat, content);
    blobEntries.push({ path: filePath, sha: blobSha });
  }

  // 5. Create tree
  const treeSha = await createTree(owner, repoName, pat, baseTreeSha, blobEntries);

  // 6. Create commit
  const commitMessage = `Export: ${bundle.artifact.slug}\n\nGenerated by Studio-OS-Chat`;
  const commitSha = await createCommit(
    owner, repoName, pat, commitMessage, treeSha, parentSha
  );

  // 7. Update branch ref
  await updateRef(owner, repoName, pat, defaultBranch, commitSha);

  // 8. Stamp repoUrl back onto the ArtifactRecord
  const repoUrl = repoData.html_url;
  await updateArtifactRepoUrl(bundle.artifact.id, repoUrl);

  return { repoUrl, repoName, owner, commitSha };
}

/**
 * Validate a PAT and return the authenticated GitHub username.
 * Returns null if the PAT is invalid or the request fails.
 */
export async function validateGithubPat(pat: string): Promise<string | null> {
  try {
    return await resolveGithubUser(pat);
  } catch {
    return null;
  }
}
