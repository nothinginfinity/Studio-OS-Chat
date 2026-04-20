/**
 * githubExport.ts — v2
 *
 * GitHub API bridge for two export flows:
 *   1. Push a ChatExportBundle to a new GitHub repo
 *   2. Promote a conversation into a Studio OS spec repo scaffold and push it
 *
 * Auth: requires a GitHub Personal Access Token (PAT) with `repo` scope.
 */

import { getSetting, putSetting } from "./db";
import { updateArtifactRepoUrl } from "./chatExport";
import type { ChatExportBundle } from "./chatExport";
import type { ChatSession, ChatSettings } from "./types";
import {
  buildSpecRepoBundle,
  buildSpecRepoBundleFromExport,
  type SpecRepoBundle,
  type SpecRepoExportOptions,
} from "./specRepoExport";

const GH_API = "https://api.github.com";
const PAT_KEY = "github_pat";
const GH_USER_KEY = "github_user";

export async function getGithubPat(): Promise<string | null> {
  return getSetting<string>(PAT_KEY);
}

export async function setGithubPat(pat: string): Promise<void> {
  await putSetting(PAT_KEY, pat.trim());
  await putSetting(GH_USER_KEY, null);
}

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

async function resolveGithubUser(pat: string): Promise<string> {
  const cached = await getSetting<string>(GH_USER_KEY);
  if (cached) return cached;

  const res = await ghFetch("/user", pat);
  if (!res.ok) throw new Error("Invalid GitHub PAT or network error");
  const data = (await res.json()) as { login: string };
  await putSetting(GH_USER_KEY, data.login);
  return data.login;
}

interface BlobResponse { sha: string; }
interface TreeResponse { sha: string; }
interface CommitResponse { sha: string; html_url: string; }
interface RefResponse { object: { sha: string }; }
interface RepoResponse { html_url: string; default_branch: string; }

async function createBlob(
  owner: string,
  repo: string,
  pat: string,
  content: string
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
  owner: string,
  repo: string,
  pat: string,
  branch: string
): Promise<RefResponse> {
  const res = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, pat);
  if (!res.ok) throw new Error(`Could not get ref for branch ${branch}`);
  return res.json() as Promise<RefResponse>;
}

async function updateRef(
  owner: string,
  repo: string,
  pat: string,
  branch: string,
  sha: string
): Promise<void> {
  await ghPatch(
    `/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    pat,
    { sha, force: false }
  );
}

export interface GitHubExportResult {
  repoUrl: string;
  repoName: string;
  owner: string;
  commitSha: string;
}

async function createRepoAndPushFiles(
  spec: { repoName: string; files: Record<string, string>; description: string },
  pat: string,
  isPrivate: boolean,
  commitMessage: string
): Promise<GitHubExportResult> {
  const owner = await resolveGithubUser(pat);
  const repoName = spec.repoName.slice(0, 100);
  const repoData = await ghPost<RepoResponse>("/user/repos", pat, {
    name: repoName,
    description: spec.description,
    private: isPrivate,
    auto_init: true,
  });

  const defaultBranch = repoData.default_branch ?? "main";
  const ref = await getRef(owner, repoName, pat, defaultBranch);
  const parentSha = ref.object.sha;

  const commitRes = await ghFetch(
    `/repos/${owner}/${repoName}/git/commits/${parentSha}`,
    pat
  );
  if (!commitRes.ok) throw new Error("Could not fetch initial commit");
  const initialCommit = (await commitRes.json()) as { tree: { sha: string } };
  const baseTreeSha = initialCommit.tree.sha;

  const blobEntries: Array<{ path: string; sha: string }> = [];
  for (const [filePath, content] of Object.entries(spec.files)) {
    const blobSha = await createBlob(owner, repoName, pat, content);
    blobEntries.push({ path: filePath, sha: blobSha });
  }

  const treeSha = await createTree(owner, repoName, pat, baseTreeSha, blobEntries);
  const commitSha = await createCommit(owner, repoName, pat, commitMessage, treeSha, parentSha);
  await updateRef(owner, repoName, pat, defaultBranch, commitSha);

  return {
    repoUrl: repoData.html_url,
    repoName,
    owner,
    commitSha,
  };
}

export async function pushBundleToGitHub(
  bundle: ChatExportBundle,
  pat: string,
  isPrivate = true
): Promise<GitHubExportResult> {
  const result = await createRepoAndPushFiles(
    {
      repoName: bundle.slug,
      files: bundle.files,
      description: `Studio-OS-Chat export: ${bundle.artifact.slug}`,
    },
    pat,
    isPrivate,
    `Export: ${bundle.artifact.slug}\n\nGenerated by Studio-OS-Chat`
  );

  await updateArtifactRepoUrl(bundle.artifact.id, result.repoUrl);
  return result;
}

export async function promoteConversationToSpecRepo(
  session: ChatSession,
  pat: string,
  settings?: Partial<ChatSettings>,
  options: SpecRepoExportOptions = {},
  isPrivate = false
): Promise<GitHubExportResult> {
  const specBundle = buildSpecRepoBundle(session, settings, options);
  return createRepoAndPushFiles(
    specBundle,
    pat,
    isPrivate,
    "feat: initialize studio-os spec repo from conversation"
  );
}

export async function promoteExportBundleToSpecRepo(
  session: ChatSession,
  bundle: ChatExportBundle,
  pat: string,
  settings?: Partial<ChatSettings>,
  options: SpecRepoExportOptions = {},
  isPrivate = false
): Promise<GitHubExportResult> {
  const specBundle: SpecRepoBundle = buildSpecRepoBundleFromExport(
    session,
    bundle,
    settings,
    options
  );
  return createRepoAndPushFiles(
    specBundle,
    pat,
    isPrivate,
    "feat: initialize studio-os spec repo from exported conversation"
  );
}

export async function validateGithubPat(pat: string): Promise<string | null> {
  try {
    return await resolveGithubUser(pat);
  } catch {
    return null;
  }
}
