import { uid } from "./utils";
import type { ChatSession, ChatSettings, ChatMessage } from "./types";
import type { ChatExportBundle } from "./chatExport";

export interface SpecRepoExportOptions {
  owner?: string;
  source?: string;
  sourceChatSurface?: string;
  exportTime?: string;
  creatorName?: string;
  creatorId?: string;
  brainstormModel?: string | null;
  brainstormProvider?: string | null;
  codingModel?: string | null;
  codingProvider?: string | null;
  title?: string;
  summary?: string | null;
  nextAction?: string | null;
}

export interface SpecRepoBundle {
  repoName: string;
  files: Record<string, string>;
  title: string;
  description: string;
}

const TEMPLATE_REPO_NAME = "studio-os-spec-repo-template";
const TEMPLATE_DESCRIPTION =
  "Template for Studio OS conversation-derived spec repos — structured memory, provenance, prompt lineage, and optional artifact/code generation.";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

function iso(ts: number): string {
  return new Date(ts).toISOString();
}

function cleanText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function summarizeMessages(messages: ChatMessage[], role: "user" | "assistant"): string[] {
  return messages
    .filter((m) => m.role === role && m.content.trim())
    .slice(0, 3)
    .map((m) => truncate(cleanText(m.content).replace(/\n+/g, " "), 180));
}

function deriveSummary(session: ChatSession): string {
  const user = summarizeMessages(session.messages, "user");
  const assistant = summarizeMessages(session.messages, "assistant");
  const parts = [
    user[0] ? `Conversation started from: ${user[0]}` : null,
    assistant[0] ? `Primary assistant response: ${assistant[0]}` : null,
    session.messages.length ? `Captured ${session.messages.length} messages.` : null,
  ].filter(Boolean);
  return parts.join(" ") || "Conversation-derived spec repo generated from Studio-OS-Chat.";
}

function deriveKeyInsights(session: ChatSession): string[] {
  const user = summarizeMessages(session.messages, "user");
  const assistant = summarizeMessages(session.messages, "assistant");
  const insights = [
    user[0] ? `Initial user intent: ${user[0]}` : null,
    assistant[0] ? `Assistant direction: ${assistant[0]}` : null,
    session.messages.some((m) => m.toolCalls?.length) ? "The conversation included tool-assisted steps." : null,
  ].filter(Boolean) as string[];
  return insights.length ? insights : ["Refine the distilled summary from the exported conversation."];
}

function deriveDecisions(session: ChatSession): string[] {
  const assistant = summarizeMessages(session.messages, "assistant");
  return assistant.length
    ? assistant.slice(0, 3).map((item) => `Working direction: ${item}`)
    : ["The exported conversation should be converted into a structured, editable spec."];
}

function deriveOpenQuestions(session: ChatSession): string[] {
  const userQuestions = session.messages
    .filter((m) => m.role === "user")
    .flatMap((m) => cleanText(m.content).split(/\n+/))
    .filter((line) => line.includes("?"))
    .slice(0, 3)
    .map((line) => truncate(line, 180));
  return userQuestions.length
    ? userQuestions
    : [
        "What should be refined first in the exported spec?",
        "Does this spec need a prompt chain extracted immediately?",
        "Should this remain memory/planning, or evolve into implementation?",
      ];
}

function buildConversationMarkdown(
  session: ChatSession,
  source: string,
  sourceChatSurface: string,
  exportTime: string
): string {
  const conversation = session.messages
    .map((message) => {
      const header = `### ${message.role} — ${iso(message.createdAt)}`;
      const body = message.content?.trim()
        ? message.content.trim()
        : message.role === "tool" && message.toolData !== undefined
          ? "```json\n" + JSON.stringify(message.toolData, null, 2) + "\n```"
          : "(no content)";
      const toolCalls = message.toolCalls?.length
        ? "\n\n**Tool calls**\n\n" +
          message.toolCalls
            .map(
              (toolCall) =>
                "- `" + toolCall.function.name + "`\n\n```json\n" +
                JSON.stringify(toolCall.function.arguments ?? {}, null, 2) +
                "\n```"
            )
            .join("\n\n")
        : "";
      return `${header}\n\n${body}${toolCalls}`;
    })
    .join("\n\n---\n\n");

  return (
    "# Conversation Record\n\n" +
    "## Source\n" +
    "- session id: " + session.id + "\n" +
    "- exported from: " + source + "\n" +
    "- source chat surface: " + sourceChatSurface + "\n" +
    "- export time: " + exportTime + "\n\n" +
    "## Notes\n" +
    "This file is for the cleaned or selected conversation record.\n\n" +
    "It should not be a blind dump if a refined transcript is available.\n" +
    "Use this file to preserve the useful dialogue, excerpts, or structured transcript.\n\n" +
    "## Conversation\n\n" +
    conversation + "\n"
  );
}

function buildPromptChain(session: ChatSession, settings?: Partial<ChatSettings>): string {
  const steps = session.messages.map((message, index) => ({
    id: `step-${String(index + 1).padStart(3, "0")}`,
    role: message.role,
    type: message.role === "tool" ? "tool" : "prompt",
    summary: truncate(cleanText(message.content || `${message.role} message`), 120),
    content: message.content || (message.toolData ? JSON.stringify(message.toolData, null, 2) : ""),
    timestamp: iso(message.createdAt),
    model: message.model ?? settings?.model ?? null,
    provider: message.provider ?? settings?.provider ?? null,
    notes: "",
  }));

  return JSON.stringify(
    {
      version: "1.0.0",
      title: session.title,
      conversationId: session.id,
      description: "Ordered prompt lineage extracted from the source conversation.",
      steps,
    },
    null,
    2
  );
}

export function buildSpecRepoBundle(
  session: ChatSession,
  settings?: Partial<ChatSettings>,
  options: SpecRepoExportOptions = {}
): SpecRepoBundle {
  const exportTime = options.exportTime ?? new Date().toISOString();
  const source = options.source ?? "Studio OS";
  const sourceChatSurface = options.sourceChatSurface ?? "studio-os-chat";
  const title = options.title?.trim() || session.title.trim() || "untitled-spec";
  const repoName = slugify(title) || `spec-${uid().slice(0, 8)}`;
  const summary = options.summary?.trim() || deriveSummary(session);
  const nextAction =
    options.nextAction?.trim() || "Refine SUMMARY.md and SPEC.md from the exported conversation.";
  const openQuestions = deriveOpenQuestions(session);
  const keyInsights = deriveKeyInsights(session);
  const decisions = deriveDecisions(session);
  const nowDate = exportTime.slice(0, 10);

  const readme =
    "# " + repoName + "\n\n" +
    "> A Studio OS template for turning conversations into durable, forkable, provenance-aware spec repos.\n\n" +
    "A Studio OS template for conversation-derived spec repos.\n\n" +
    "This repo structure is designed to turn a conversation into a durable, Git-backed specification that can remain:\n\n" +
    "- memory\n- writing\n- planning\n- research\n- recipes\n- notes\n- poetry\n- article/book development\n\n" +
    "or evolve into:\n\n" +
    "- software\n- workflow automation\n- prototype\n- generated code\n- digital artifacts\n\n" +
    "## What this repo is\n\n" +
    "A spec repo is a structured package of:\n\n" +
    "- intent\n- context\n- constraints\n- provenance\n- prompt lineage\n- optional artifacts\n- optional generated code\n\n" +
    "It is not limited to software.\n\n" +
    "## Core idea\n\n" +
    "A conversation becomes more useful when it is transformed into:\n\n" +
    "- a readable summary\n- a durable spec\n- a provenance record\n- an optional prompt chain\n- an optional artifact/code handoff surface\n\n" +
    "## Main files\n\n" +
    "- `SPEC.md` — distilled specification\n" +
    "- `SUMMARY.md` — concise summary of the conversation\n" +
    "- `CONVERSATION.md` — cleaned conversation record\n" +
    "- `STATUS.md` — current phase/state\n" +
    "- `DECISIONS.md` — major decisions and reasoning\n" +
    "- `TASKS.md` — next actions\n" +
    "- `PROMPT_CHAIN.json` — extracted prompt lineage\n" +
    "- `PROVENANCE.json` — chain of custody\n" +
    "- `ARTIFACTS.json` — outputs and linked artifacts\n\n" +
    "## Studio OS meaning\n\n" +
    "In Studio OS, a spec repo is the durable handoff object between:\n\n" +
    "- brainstorming\n- refinement\n- coding\n- evaluation\n- publication\n- memory\n\n" +
    "## Suggested lifecycle\n\n" +
    "1. Have a conversation in Studio OS\n" +
    "2. Promote it to a spec repo\n" +
    "3. Refine summary/spec\n" +
    "4. Optionally generate code or artifacts\n" +
    "5. Save outputs back into the repo\n" +
    "6. Fork, branch, archive, or publish\n\n" +
    "## Output folders\n\n" +
    "- `outputs/generated-code/` — generated source code\n" +
    "- `outputs/docs/` — generated documents\n" +
    "- `outputs/images/` — generated images\n" +
    "- `outputs/other/` — other artifacts\n\n" +
    "## Notes\n\n" +
    "This template is intentionally spec-first.\n" +
    "It should be usable even if no code is ever generated.\n";

  const spec =
    "# Spec\n\n" +
    "## Title\n" + title + "\n\n" +
    "## Intent\n" +
    "Convert this conversation into a durable Studio OS spec repo that can remain planning/memory or evolve into implementation.\n\n" +
    "## Why this exists\n" +
    "This repo was generated from a Studio-OS-Chat conversation so the work can be preserved as a structured, Git-backed object with provenance.\n\n" +
    "## Desired outcome\n" +
    "A readable, editable, provenance-aware spec repo that can guide future writing, planning, software generation, or artifact creation.\n\n" +
    "## Audience / user\n" +
    "- The original human author\n- Future collaborators\n- Coding models using the repo as a handoff surface\n\n" +
    "## Constraints\n" +
    "- Preserve conversation provenance\n" +
    "- Keep the repo useful even without code\n" +
    "- Maintain a spec-first structure\n" +
    "- Generated code, if any, belongs under `outputs/generated-code/`\n\n" +
    "## Requirements\n\n" +
    "### Functional requirements\n" +
    "- Preserve the conversation in a structured record\n" +
    "- Distill the conversation into a readable summary and spec\n" +
    "- Track provenance, decisions, tasks, and prompt lineage\n\n" +
    "### Non-functional requirements\n" +
    "- Simplicity\n- Maintainability\n- Human readability\n- Model readability\n- Low-friction for future evolution\n\n" +
    "## Open questions\n- " + openQuestions.join("\n- ") + "\n\n" +
    "## Next best action\n" + nextAction + "\n";

  const summaryMd =
    "# Summary\n\n" +
    "## One-paragraph summary\n" + summary + "\n\n" +
    "## Key insights\n- " + keyInsights.join("\n- ") + "\n\n" +
    "## Most important decisions\n- " + decisions.join("\n- ") + "\n\n" +
    "## Risks / unknowns\n" +
    "- The generated summary and spec may need human refinement.\n" +
    "- Prompt lineage may need cleanup if the session contained tool-only noise.\n\n" +
    "## Recommended next step\n" + nextAction + "\n";

  const status =
    "# Status\n\n" +
    "Current phase: spec\n\n" +
    "## Pipeline\n" +
    "- [x] Conversation captured\n" +
    "- [x] Summary created\n" +
    "- [x] Spec drafted\n" +
    "- [x] Prompt chain extracted\n" +
    "- [ ] Artifact defined\n" +
    "- [ ] Code generated\n" +
    "- [ ] Artifact tested\n" +
    "- [ ] Published\n" +
    "- [ ] Archived\n\n" +
    "## Current focus\n" +
    "Refine the generated spec and decide whether this repo remains planning/memory or evolves into a build target.\n\n" +
    "## Notes\n" +
    "Generated from Studio-OS-Chat on " + exportTime + ".\n";

  const decisionsMd =
    "# Decisions\n\n" +
    "## Decision Log\n\n" +
    "### " + nowDate + "\n" +
    "**Decision:**  \nPromote this conversation into a Studio OS spec repo.\n\n" +
    "**Reason:**  \nThe conversation has enough structure and value to preserve as a durable handoff object.\n\n" +
    "**Impact:**  \nThe work now exists as a Git-backed repository with summary, spec, provenance, prompt lineage, and task surfaces.\n\n" +
    "---\n\n" +
    "### " + nowDate + "\n" +
    "**Decision:**  \nKeep the repo spec-first rather than code-first.\n\n" +
    "**Reason:**  \nThe Studio OS template is intended to preserve intent and structure before implementation choices are locked.\n\n" +
    "**Impact:**  \nFuture code generation remains optional and should be placed under `outputs/generated-code/`.\n";

  const tasks =
    "# Tasks\n\n" +
    "## Now\n- Refine SUMMARY.md\n- Refine SPEC.md\n\n" +
    "## Next\n" +
    "- Review PROMPT_CHAIN.json for cleanup\n" +
    "- Decide whether to create an implementation repo or remain spec-only\n\n" +
    "## Later\n" +
    "- Define artifacts in ARTIFACTS.json\n" +
    "- Generate code or documents if needed\n\n" +
    "## Backlog\n" +
    "- Add examples or schemas specific to this spec\n" +
    "- Record downstream forks or publications\n";

  const provenance = JSON.stringify(
    {
      repoType: "studio-os-spec-repo",
      schemaVersion: "1.0.0",
      title,
      creator: {
        name: options.creatorName ?? "replace-me",
        id: options.creatorId ?? "replace-me",
      },
      conversation: {
        sessionId: session.id,
        source: sourceChatSurface,
        exportedAt: exportTime,
      },
      modelContext: {
        brainstormModel: options.brainstormModel ?? settings?.model ?? null,
        brainstormProvider: options.brainstormProvider ?? settings?.provider ?? null,
        codingModel: options.codingModel ?? null,
        codingProvider: options.codingProvider ?? null,
      },
      purpose: {
        mode: "spec",
        possibleOutputs: ["memory", "writing", "software", "workflow", "artifact"],
      },
      artifactLinks: [],
      parentRepo: null,
      tags: ["studio-os", "spec-repo", slugify(title)].filter(Boolean),
    },
    null,
    2
  );

  const artifacts = JSON.stringify({ version: "1.0.0", artifacts: [] }, null, 2);

  const manifest = JSON.stringify(
    {
      repoType: "studio-os-spec-repo",
      schemaVersion: "1.0.0",
      title,
      status: "spec",
      createdFromConversation: true,
      supportsCodeGeneration: true,
      supportsMemoryOnly: true,
      supportsWritingOnly: true,
    },
    null,
    2
  );

  const exportConfig = JSON.stringify(
    {
      summaryFile: "SUMMARY.md",
      specFile: "SPEC.md",
      conversationFile: "CONVERSATION.md",
      statusFile: "STATUS.md",
      decisionsFile: "DECISIONS.md",
      tasksFile: "TASKS.md",
      promptChainFile: "PROMPT_CHAIN.json",
      provenanceFile: "PROVENANCE.json",
      artifactsFile: "ARTIFACTS.json",
      outputsDir: "outputs",
    },
    null,
    2
  );

  const repoRules =
    "# Repo Rules\n\n" +
    "## Rule 1\nThis repo is spec-first.\n\n" +
    "## Rule 2\nDo not assume this repo must become software.\n\n" +
    "## Rule 3\nPreserve provenance whenever possible:\n- human\n- conversation/session\n- model/provider\n- export time\n\n" +
    "## Rule 4\nUse `SPEC.md` as the main handoff file for coding models.\n\n" +
    "## Rule 5\nUse `SUMMARY.md` for fast human orientation.\n\n" +
    "## Rule 6\nIf code is generated, place it under `outputs/generated-code/` unless a later repo structure replaces it.\n\n" +
    "## Rule 7\nIf this repo forks into an implementation repo, record that fork in `ARTIFACTS.json` and/or `PROVENANCE.json`.\n";

  const gitignore =
    ".DS_Store\nnode_modules/\ndist/\nbuild/\n.env\n.env.local\n.env.*.local\ncoverage/\n*.log\n";

  const license =
    "MIT License\n\nCopyright (c) 2026\n\n" +
    "Permission is hereby granted, free of charge, to any person obtaining a copy\n" +
    "of this software and associated documentation files (the \"Software\"), to deal\n" +
    "in the Software without restriction, including without limitation the rights\n" +
    "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell\n" +
    "copies of the Software, and to permit persons to whom the Software is\n" +
    "furnished to do so, subject to the following conditions:\n\n" +
    "The above copyright notice and this permission notice shall be included in all\n" +
    "copies or substantial portions of the Software.\n\n" +
    "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\n" +
    "IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\n" +
    "FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\n" +
    "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\n" +
    "LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\n" +
    "OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n" +
    "SOFTWARE.\n";

  const files: Record<string, string> = {
    "README.md": readme,
    "SPEC.md": spec,
    "SUMMARY.md": summaryMd,
    "CONVERSATION.md": buildConversationMarkdown(session, source, sourceChatSurface, exportTime),
    "STATUS.md": status,
    "DECISIONS.md": decisionsMd,
    "TASKS.md": tasks,
    "PROMPT_CHAIN.json": buildPromptChain(session, settings),
    "PROVENANCE.json": provenance,
    "ARTIFACTS.json": artifacts,
    "LICENSE": license,
    ".gitignore": gitignore,
    "notes/scratchpad.md":
      "# Scratchpad\n\nUse this file for loose notes, fragments, partial ideas, and temporary structure.\n",
    "outputs/generated-code/.gitkeep": "",
    "outputs/docs/.gitkeep": "",
    "outputs/images/.gitkeep": "",
    "outputs/other/.gitkeep": "",
    ".studio-os/manifest.json": manifest,
    ".studio-os/export-config.json": exportConfig,
    ".studio-os/repo-rules.md": repoRules,
  };

  return { repoName, files, title, description: TEMPLATE_DESCRIPTION };
}

export function buildSpecRepoBundleFromExport(
  session: ChatSession,
  bundle: ChatExportBundle,
  settings?: Partial<ChatSettings>,
  options: SpecRepoExportOptions = {}
): SpecRepoBundle {
  const nextOptions: SpecRepoExportOptions = {
    ...options,
    summary:
      options.summary ??
      `Conversation promoted from Studio-OS-Chat export artifact ${bundle.osmdPath} into a Studio OS spec repo scaffold.`,
  };
  return buildSpecRepoBundle(session, settings, nextOptions);
}

export { TEMPLATE_REPO_NAME, TEMPLATE_DESCRIPTION };
