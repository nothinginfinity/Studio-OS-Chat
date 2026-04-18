import type { ToolDefinition } from "../lib/types";
import { searchLocalIndex } from "../lib/search";

export const fileSearchTool: ToolDefinition = {
  name: "file_search",
  description:
    "Search the user's locally indexed files and return the most relevant snippets. " +
    "Use this whenever the user asks about their files, notes, code, or documents.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query — keywords, a phrase, or a question about the content."
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return. Defaults to 5."
      }
    },
    required: ["query"]
  },
  async run(args) {
    const query =
      typeof args === "object" && args !== null && "query" in args
        ? String((args as Record<string, unknown>).query)
        : "";

    const limit =
      typeof args === "object" && args !== null && "limit" in args
        ? Math.min(Number((args as Record<string, unknown>).limit) || 5, 20)
        : 5;

    if (!query.trim()) {
      return { query, count: 0, results: [], error: "Empty query" };
    }

    const results = await searchLocalIndex(query, { limit });

    return {
      query,
      count: results.length,
      results
    };
  }
};
