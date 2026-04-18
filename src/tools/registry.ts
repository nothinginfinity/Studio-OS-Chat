import type { ToolDefinition } from "../lib/types";
import { echoTool } from "./echo";
import { calculatorTool } from "./calculator";

export const toolRegistry: ToolDefinition[] = [
  echoTool,
  calculatorTool
];
