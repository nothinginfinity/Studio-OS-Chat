/**
 * registry.ts — v3
 *
 * Central tool registry for Studio-OS-Chat.
 *
 * Registered tools (v3):
 *   calculator   — evaluate arithmetic expressions
 *   echo         — debug/test: echo args back
 *   file_search  — BM25 lexical search over indexed local files
 *   ocr_ingest   — OCR ingestion pipeline
 *   github_read  — read a file from a GitHub repo using stored PAT
 *   github_push  — create or update a file in a GitHub repo using stored PAT
 */

import type { ToolDefinition } from "../lib/types";
import { calculatorTool } from "./calculator";
import { echoTool } from "./echo";
import { fileSearchTool } from "./fileSearch";
import { ocrTool } from "./ocr";
import { githubReadTool, githubPushTool } from "./github";

// ── Registry map ────────────────────────────────────────────────────────────────────

const _registry = new Map<string, ToolDefinition>();

function register(tool: ToolDefinition): void {
  if (_registry.has(tool.name)) {
    console.warn(`[registry] Tool '${tool.name}' registered more than once — overwriting.`);
  }
  _registry.set(tool.name, tool);
}

register(calculatorTool);
register(echoTool);
register(fileSearchTool);
register(ocrTool);
register(githubReadTool);
register(githubPushTool);

// ── Public API ───────────────────────────────────────────────────────────────────

/** Returns all registered tools as an array. */
export function getAllTools(): ToolDefinition[] {
  return [..._registry.values()];
}

/** Look up a single tool by name. Returns undefined if not found. */
export function getTool(name: string): ToolDefinition | undefined {
  return _registry.get(name);
}

/** Returns the names of all registered tools. */
export function getToolNames(): string[] {
  return [..._registry.keys()];
}

/** Register an additional tool at runtime. */
export function registerTool(tool: ToolDefinition): void {
  register(tool);
}

// ── Legacy / convenience aliases (used by useChat.ts) ────────────────────────

export const toolRegistry: ToolDefinition[] = getAllTools();
export const getToolByName = getTool;
