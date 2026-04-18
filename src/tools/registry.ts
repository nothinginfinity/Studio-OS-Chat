import type { ToolDefinition } from "../lib/types";
import { fileSearchTool } from "./fileSearch";
import { calculatorTool } from "./calculator";
import { echoTool } from "./echo";

export const toolRegistry: ToolDefinition[] = [
  fileSearchTool,
  calculatorTool,
  echoTool
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return toolRegistry.find((tool) => tool.name === name);
}
