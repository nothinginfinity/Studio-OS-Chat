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

function buildConversationMarkdown(session: ChatSession, source: string, sourceChatSurface: string, exportTime: string): string {
  const conversation = session.messages
    .map((message) => {
      const header = `### ${message.role} — ${iso(message.createdAt)}`;
      const body = message.content?.trim()
        ? message.content.trim()
        : message.role === "tool" && message.toolData !== undefined
          ? `\`\`\`json\n${JSON.stringify(message.toolData, null, 2)}\n\`\`\``
          : "(no content)";
      const toolCalls = message.toolCalls?.length
        ? `\n\n**Tool calls**\n\n${message.toolCalls
            .map(
              (toolCall) =>
                `- \`${toolCall.function.name}\`\n\n\`\`\`json\n${JSON.stringify(toolCall.function.arguments ?? {}, null, 2)}\n\`\`\``
            )
            .join("\n\n")}`
        : "";
      return `${header}\n\n${body}${toolCalls}`;
    })
    .join("\n\n---\n\n");

  return `# Conversation Record

## Source
- session id: ${session.id}
- exported from: ${source}
- source chat surface: ${sourceChatSurface}
- export time: ${exportTime}

## Notes
This file is for the cleaned or selected conversation record.

It should not be a blind dump if a refined transcript is available.
Use this file to preserve the useful dialogue, excerpts, or structured transcript.

## Conversation

${conversation}
`;
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
  const nextAction = options.nextAction?.trim() || "Refine SUMMARY.md and SPEC.md from the exported conversation.";
  const openQuestions = deriveOpenQuestions(session);
  const keyInsights = deriveKeyInsights(session);
  const decisions = deriveDecisions(session);
  const nowDate = exportTime.slice(0, 10);

  const readme = `# ${repoName}

> A Studio OS template for turning conversations into durable, forkable, provenance-aware spec repos.

A Studio OS template for conversation-derived spec repos.

This repo structure is designed to turn a conversation into a durable, Git-backed specification that can remain:

- memory
- writing
- planning
- research
- recipes
- notes
- poetry
- article/book development

or evolve into:

- software
- workflow automation
- prototype
- generated code
- digital artifacts

## What this repo is

A spec repo is a structured package of:

- intent
- context
- constraints
- provenance
- prompt lineage
- optional artifacts
- optional generated code

It is not limited to software.

## Core idea

A conversation becomes more useful when it is transformed into:

- a readable summary
- a durable spec
- a provenance record
- an optional prompt chain
- an optional artifact/code handoff surface

## Main files

- \\`SPEC.md\\` — distilled specification
- \\`SUMMARY.md\\` — concise summary of the conversation
- \\`CONVERSATION.md\\` — cleaned conversation record
- \\`STATUS.md\\` — current phase/state
- \\`DECISIONS.md\\` — major decisions and reasoning
- \\`TASKS.md\\` — next actions
- \\`PROMPT_CHAIN.json\\` — extracted prompt lineage
- \\`PROVENANCE.json\\` — chain of custody
- \\`ARTIFACTS.json\\` — outputs and linked artifacts

## Studio OS meaning

In Studio OS, a spec repo is the durable handoff object between:

- brainstorming
- refinement
- coding
- evaluation
- publication
- memory

## Suggested lifecycle

1. Have a conversation in Studio OS
2. Promote it to a spec repo
3. Refine summary/spec
4. Optionally generate code or artifacts
5. Save outputs back into the repo
6. Fork, branch, archive, or publish

## Output folders

- \\`outputs/generated-code/\\` — generated source code
- \\`outputs/docs/\\` — generated documents
- \\`outputs/images/\\` — generated images
- \\`outputs/other/\\` — other artifacts

## Notes

This template is intentionally spec-first.
It should be usable even if no code is ever generated.
`;

  const spec = `# Spec

## Title
${title}

## Intent
Convert this conversation into a durable Studio OS spec repo that can remain planning/memory or evolve into implementation.

## Why this exists
This repo was generated from a Studio-OS-Chat conversation so the work can be preserved as a structured, Git-backed object with provenance.

## Desired outcome
A readable, editable, provenance-aware spec repo that can guide future writing, planning, software generation, or artifact creation.

## Audience / user
- The original human author
- Future collaborators
- Coding models using the repo as a handoff surface

## Constraints
- Preserve conversation provenance
- Keep the repo useful even without code
- Maintain a spec-first structure
- Generated code, if any, belongs under \\`outputs/generated-code/\\`

## Requirements

### Functional requirements
- Preserve the conversation in a structured record
- Distill the conversation into a readable summary and spec
- Track provenance, decisions, tasks, and prompt lineage

### Non-functional requirements
- Simplicity
- Maintainability
- Human readability
- Model readability
- Low-friction for future evolution

## Inputs
- The exported Studio-OS-Chat conversation
- Session metadata
- Optional provider/model metadata

## Outputs
- Structured markdown files
- Provenance JSON
- Prompt chain JSON
- Artifact registry JSON

## Possible forms
This spec may eventually become one or more of the following:

- article
- book
- poem
- research note
- recipe collection
- software
- prototype
- workflow
- automation
- calculator
- calendar
- CRM
- image set
- internal tool

## Prompt-chain relevance
Yes. This repo includes prompt lineage so future work can reconstruct how the idea evolved.

## Artifact expectations
This spec may later produce generated docs, images, code, or other digital artifacts saved into the outputs folder.

## Open questions
- ${openQuestions.join("\n- ")}

## Next best action
${nextAction}
`;

  const summaryMd = `# Summary

## One-paragraph summary
${summary}

## Key insights
- ${keyInsights.join("\n- ")}

## Most important decisions
- ${decisions.join("\n- ")}

## Risks / unknowns
- The generated summary and spec may need human refinement.
- Prompt lineage may need cleanup if the session contained tool-only noise.

## Recommended next step
${nextAction}
`;

  const status = `# Status

Current phase: spec

## Pipeline
- [x] Conversation captured
- [x] Summary created
- [x] Spec drafted
- [x] Prompt chain extracted
- [ ] Artifact defined
- [ ] Code generated
- [ ] Artifact tested
- [ ] Published
- [ ] Archived

## Current focus
Refine the generated spec and decide whether this repo remains planning/memory or evolves into a build target.

## Notes
Generated from Studio-OS-Chat on ${exportTime}.
`;

  const decisionsMd = `# Decisions

## Decision Log

### ${nowDate}
**Decision:**  
Promote this conversation into a Studio OS spec repo.

**Reason:**  
The conversation has enough structure and value to preserve as a durable handoff object.

**Impact:**  
The work now exists as a Git-backed repository with summary, spec, provenance, prompt lineage, and task surfaces.

---

### ${nowDate}
**Decision:**  
Keep the repo spec-first rather than code-first.

**Reason:**  
The Studio OS template is intended to preserve intent and structure before implementation choices are locked.

**Impact:**  
Future code generation remains optional and should be placed under \\`outputs/generated-code/\\`.
`;

  const tasks = `# Tasks

## Now
- Refine SUMMARY.md
- Refine SPEC.md

## Next
- Review PROMPT_CHAIN.json for cleanup
- Decide whether to create an implementation repo or remain spec-only

## Later
- Define artifacts in ARTIFACTS.json
- Generate code or documents if needed

## Backlog
- Add examples or schemas specific to this spec
- Record downstream forks or publications
`;

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

  const artifacts = JSON.stringify(
    {
      version: "1.0.0",
      artifacts: [],
    },
    null,
    2
  );

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

  const repoRules = `# Repo Rules

## Rule 1
This repo is spec-first.

## Rule 2
Do not assume this repo must become software.

## Rule 3
Preserve provenance whenever possible:
- human
- conversation/session
- model/provider
- export time

## Rule 4
Use \\`SPEC.md\\` as the main handoff file for coding models.

## Rule 5
Use \\`SUMMARY.md\\` for fast human orientation.

## Rule 6
If code is generated, place it under \\`outputs/generated-code/\\` unless a later repo structure replaces it.

## Rule 7
If this repo forks into an implementation repo, record that fork in \\`ARTIFACTS.json\\` and/or \\`PROVENANCE.json\\`.
`;

  const gitignore = `.DS_Store
node_modules/
dist/
build/
.env
.env.local
.env.*.local
coverage/
*.log
`;

  const license = `MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

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
    LICENSE: license,
    ".gitignore": gitignore,
    "notes/scratchpad.md": "# Scratchpad\n\nUse this file for loose notes, fragments, partial ideas, and temporary structure.\n",
    "outputs/generated-code/.gitkeep": "",
    "outputs/docs/.gitkeep": "",
    "outputs/images/.gitkeep": "",
    "outputs/other/.gitkeep": "",
    ".studio-os/manifest.json": manifest,
    ".studio-os/export-config.json": exportConfig,
    ".studio-os/repo-rules.md": repoRules,
  };

  return {
    repoName,
    files,
    title,
    description: TEMPLATE_DESCRIPTION,
  };
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
