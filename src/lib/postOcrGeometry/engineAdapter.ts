/**
 * Geometry engine adapter.
 *
 * This is the ONLY place in the app that imports from post-ocr-geometry-engine.
 * All other files import from this module or from the boundary index.
 *
 * STATUS: Wiring is conditional. When post-ocr-geometry-engine is published
 * to npm and installed, uncomment the real import block below and remove
 * the placeholder path.
 *
 * To activate:
 *   1. npm install post-ocr-geometry-engine
 *   2. Uncomment the real import block
 *   3. Remove the placeholder block
 *   4. Delete this comment
 */

import type { PostOcrDocument, PostOcrProcessedDocument } from "./types";

// ---------------------------------------------------------------------------
// PLACEHOLDER — active until engine is installed
// ---------------------------------------------------------------------------
// When the real engine is installed, replace this entire block with the
// real import block below it.

async function runWithPlaceholder(
  doc: PostOcrDocument
): Promise<PostOcrProcessedDocument> {
  const rawText =
    typeof doc.rawPayload === "string"
      ? doc.rawPayload
      : JSON.stringify(doc.rawPayload, null, 2);

  return {
    markdown: rawText,
    text: rawText,
    blocks: [
      {
        id: `${doc.id}-raw`,
        type: "raw",
        text: rawText,
        page: 1,
        confidence: 0,
        flags: ["engine-adapter-placeholder"],
      },
    ],
    debug: {
      warnings: [
        "engineAdapter: post-ocr-geometry-engine is not installed. "
        + "Install the package and activate the real import block in engineAdapter.ts.",
      ],
      ambiguousBlocks: [],
    },
    summary: {
      pages: 1,
      blockCount: 1,
      headingCount: 0,
      listCount: 0,
      tableCount: 0,
      codeCount: 0,
      ambiguityCount: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// REAL ENGINE BLOCK — uncomment when post-ocr-geometry-engine is installed
// ---------------------------------------------------------------------------
//
// import {
//   fromTesseractTSV,
//   fromPaddleOCR,
//   buildDocument,
// } from "post-ocr-geometry-engine";
//
// async function runWithEngine(
//   doc: PostOcrDocument
// ): Promise<PostOcrProcessedDocument> {
//   const isString = typeof doc.rawPayload === "string";
//
//   const normalized =
//     doc.provider === "paddleocr" && !isString
//       ? fromPaddleOCR(doc.rawPayload as Record<string, unknown>)
//       : fromTesseractTSV(isString ? doc.rawPayload : JSON.stringify(doc.rawPayload), {
//           pageWidth: doc.pageWidth ?? 1200,
//           pageHeight: doc.pageHeight ?? 1600,
//         });
//
//   const result = buildDocument(normalized, {
//     enableTableInference: true,
//     enableCodeInference: true,
//   });
//
//   return {
//     markdown: result.markdown,
//     text: result.text,
//     blocks: result.blocks.map((b, i) => ({
//       id: b.id ?? `block-${i}`,
//       type: b.type,
//       text: b.text,
//       level: b.level,
//       rows: b.rows,
//       page: b.page,
//       confidence: b.confidence,
//       flags: b.flags,
//       ambiguity: b.ambiguity,
//     })),
//     debug: {
//       warnings: result.debug.warnings,
//       ambiguousBlocks: result.debug.ambiguousBlocks,
//       html: result.debug.debugHtml,
//     },
//     summary: {
//       pages: result.pages.length,
//       blockCount: result.blocks.length,
//       headingCount: result.blocks.filter((b) => b.type === "heading").length,
//       listCount: result.blocks.filter((b) => b.type === "list" || b.type === "list_item").length,
//       tableCount: result.blocks.filter((b) => b.type === "table").length,
//       codeCount: result.blocks.filter((b) => b.type === "code").length,
//       ambiguityCount: result.debug.ambiguousBlocks?.length ?? 0,
//     },
//   };
// }

// ---------------------------------------------------------------------------
// Public adapter function — swap runWithPlaceholder for runWithEngine above
// ---------------------------------------------------------------------------

export async function runGeometryEngine(
  doc: PostOcrDocument
): Promise<PostOcrProcessedDocument> {
  // SWAP THIS LINE when activating the real engine:
  // return runWithEngine(doc);
  return runWithPlaceholder(doc);
}
