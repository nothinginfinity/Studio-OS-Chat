import type { ToolDefinition } from "../lib/types";

export const calculatorTool: ToolDefinition = {
  name: "calculator",
  description: "Evaluates a simple arithmetic expression.",
  inputSchema: {
    type: "object",
    properties: { expression: { type: "string" } },
    required: ["expression"]
  },
  async run(args) {
    const expression =
      typeof args === "object" && args !== null && "expression" in args && typeof (args as any).expression === "string"
        ? (args as any).expression
        : "";
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) throw new Error("Invalid expression");
    const result = Function(`"use strict"; return (${expression});`)();
    return { expression, result };
  }
};
