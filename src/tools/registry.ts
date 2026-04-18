import type { ToolDefinition } from "../lib/types";
import { echoTool } from "./echo";
import { calculatorTool } from "./calculator";

export const toolRegistry: ToolDefinition[] = [
  echoTool,
  calculatorTool
];

export function getToolByName(name: string): ToolDefinition | undefined {
  return toolRegistry.find((tool) => tool.name === name);
}
