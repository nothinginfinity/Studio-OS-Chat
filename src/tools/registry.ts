/**
 * registry.ts — v2
 *
 * Central tool registry for Studio-OS-Chat.
 *
 * All tools must be registered here. The registry is the single source of
 * truth for which tools the model can call. Tool definitions are typed via
 * ToolDefinition in types.ts.
 *
 * Registered tools (v2):
 *   calculator   — evaluate arithmetic expressions
 *   echo         — debug/test: echo args back
 *   file_search  — BM25 lexical search over indexed local files
 *   ocr_ingest   — OCR ingestion pipeline (screenshot/document/code/receipt)
 */

import type { ToolDefinition } from "../lib/types";
import { calculatorTool } from "./calculator";
import { echoTool } from "./echo";
import { fileSearchTool } from "./fileSearch";
import { ocrTool } from "./ocr";

// ── Registry map ────────────────────────────────────────────────────────────────

const _registry = new Map<string, ToolDefinition>();

function register(tool: ToolDefinition): void {
  if (_registry.has(tool.name)) {
    console.warn(`[registry] Tool '${tool.name}' registered more than once — overwriting.`);
  }
  _registry.set(tool.name, tool);
}

// Register all tools
register(calculatorTool);
register(echoTool);
register(fileSearchTool);
register(ocrTool);

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns all registered tools as an array. */
export function getAllTools(): ToolDefinition[] {
  return [..._registry.values()];
}

/** Look up a single tool by name. Returns undefined if not found. */
export function getTool(name: string): ToolDefinition | undefined {
  return _registry.get(name);
}

/** Returns the names of all registered tools (useful for system prompt injection). */
export function getToolNames(): string[] {
  return [..._registry.keys()];
}

/**
 * Register an additional tool at runtime.
 * Useful for dynamically loaded tools or test overrides.
 */
export function registerTool(tool: ToolDefinition): void {
  register(tool);
}
