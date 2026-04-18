import type { ToolDefinition } from "../lib/types";

export const echoTool: ToolDefinition = {
  name: "echo",
  description: "Returns the text you pass in.",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"]
  },
  async run(args) {
    const text =
      typeof args === "object" && args !== null && "text" in args && typeof (args as any).text === "string"
        ? (args as any).text
        : "";
    return { echoed: text };
  }
};
