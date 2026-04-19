/**
 * tools/ocr.ts — v1
 *
 * Tool registration for the OCR ingestion pipeline.
 *
 * This is NOT a live-chat OCR tool that returns text in the turn.
 * It is an ingestion trigger: the model calls this tool to ingest
 * an already-uploaded image file into the indexed file system.
 * Future searches hit the text index, not the image.
 *
 * The tool expects the image to have been uploaded to the file system
 * first (via the file upload UI). It locates the file by name, runs
 * OCR via ocr.ts, and returns a summary of what was indexed.
 *
 * Modes:
 *   screenshot — UI text, labels (default)
 *   document   — photographed pages, prose
 *   code       — monospace output wrapped in fenced blocks
 *   receipt    — structured fields (amounts, dates, vendors)
 */

import type { ToolDefinition } from "../lib/types";
import type { OCRMode } from "../lib/types";
import { ingestImageAsMarkdown } from "../lib/ocr";
import { isImageFile } from "../lib/fileParsers";
import { listFileRoots } from "../lib/db";

const VALID_MODES: OCRMode[] = ["screenshot", "document", "code", "receipt"];

function isValidMode(m: unknown): m is OCRMode {
  return typeof m === "string" && (VALID_MODES as string[]).includes(m);
}

export const ocrTool: ToolDefinition = {
  name: "ocr_ingest",
  description:
    "Run OCR on an image file that the user has uploaded and index the extracted " +
    "text into the local file system. Use this when the user wants to make a " +
    "screenshot, photo, or scanned document searchable. The extracted text is " +
    "stored as a companion markdown file and indexed — future searches will find " +
    "it automatically without re-running OCR. " +
    "Modes: 'screenshot' (UI/labels), 'document' (prose pages), " +
    "'code' (monospace, preserves fenced blocks), 'receipt' (fields/amounts).",
  inputSchema: {
    type: "object",
    properties: {
      filename: {
        type: "string",
        description:
          "Name of the image file to OCR (e.g. 'screenshot.png'). " +
          "The file must have been uploaded to the local file system first.",
      },
      mode: {
        type: "string",
        enum: VALID_MODES,
        description:
          "OCR mode. Defaults to 'screenshot'. Use 'document' for photographed " +
          "pages, 'code' for terminal/editor screenshots, 'receipt' for receipts/cards.",
      },
      lang: {
        type: "string",
        description:
          "Tesseract language code (default: 'eng'). Examples: 'fra', 'deu', 'spa', 'chi_sim'.",
      },
      rootId: {
        type: "string",
        description:
          "Optional file root id to associate the indexed output with. " +
          "Defaults to the first available file root.",
      },
    },
    required: ["filename"],
  },

  async run(args) {
    const a = args as Record<string, unknown>;
    const filename = typeof a.filename === "string" ? a.filename.trim() : "";
    const mode: OCRMode = isValidMode(a.mode) ? a.mode : "screenshot";
    const lang = typeof a.lang === "string" && a.lang.trim() ? a.lang.trim() : "eng";

    if (!filename) {
      return { success: false, error: "filename is required" };
    }

    if (!isImageFile(filename)) {
      return {
        success: false,
        error: `'${filename}' does not appear to be a supported image file. ` +
          "Supported: .png .jpg .jpeg .gif .webp .bmp .tiff",
      };
    }

    // Resolve rootId — use provided or fall back to first available root
    let rootId = typeof a.rootId === "string" ? a.rootId.trim() : "";
    if (!rootId) {
      const roots = await listFileRoots();
      if (roots.length === 0) {
        return {
          success: false,
          error:
            "No file roots found. Ask the user to open a folder or upload files first.",
        };
      }
      rootId = roots[0].id;
    }

    // The file object must be provided by the UI layer via a File input.
    // Since tools run in the browser, we construct a minimal File-like object
    // from the filename so the UI layer can intercept and supply the real File.
    // This tool returns a structured request; the UI resolves the actual File.
    //
    // For direct programmatic use (e.g. from a file-upload handler), pass
    // the File object directly to ingestImageAsMarkdown() instead.
    //
    // Tool call path: model → ocrTool.run() → returns { needsFile: true }
    // UI intercept:   detects needsFile, opens file picker, calls ingestImageAsMarkdown()
    // This pattern avoids exposing File objects in the tool schema.

    return {
      needsFile: true,
      filename,
      mode,
      lang,
      rootId,
      instruction:
        `Please select the image file '${filename}' to begin OCR ingestion in '${mode}' mode. ` +
        `The extracted text will be indexed and searchable immediately after.`,
    };
  },
};

/**
 * Direct ingestion entry point for use by the file-upload UI handler.
 * Call this when you already have a File object (e.g. from drag-and-drop).
 *
 * @param file    The image File object
 * @param rootId  The file root to associate the indexed output with
 * @param mode    OCR mode
 * @param lang    Tesseract language code
 */
export async function runOcrIngestion(
  file: File,
  rootId: string,
  mode: OCRMode = "screenshot",
  lang = "eng"
) {
  if (!isImageFile(file.name)) {
    throw new Error(`Not a supported image file: ${file.name}`);
  }
  return ingestImageAsMarkdown(file, rootId, mode, lang);
}
