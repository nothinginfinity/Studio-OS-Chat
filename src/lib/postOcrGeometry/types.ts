export type PostOcrSourceType =
  | "image"
  | "screenshot"
  | "pdf-page"
  | "ocr-tsv"
  | "ocr-json";

export type PostOcrProvider = "tesseract" | "paddleocr" | "other";

export interface PostOcrDocument {
  id: string;
  sourceType: PostOcrSourceType;
  provider: PostOcrProvider;
  rawPayload: string | Record<string, unknown>;
  filename?: string;
  pageWidth?: number;
  pageHeight?: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface PostOcrBlock {
  id: string;
  type: string;
  text?: string;
  level?: number;
  page: number;
  confidence: number;
  flags?: string[];
  rows?: string[][];
  ambiguity?: {
    level: "low" | "medium" | "high";
    reasons: string[];
  };
}

export interface PostOcrProcessedDocument {
  markdown: string;
  text: string;
  blocks: PostOcrBlock[];
  debug?: {
    html?: string;
    json?: unknown;
    warnings?: string[];
    ambiguousBlocks?: string[];
  };
  summary: {
    pages: number;
    blockCount: number;
    headingCount: number;
    listCount: number;
    tableCount: number;
    codeCount: number;
    ambiguityCount: number;
  };
}

export interface PostOcrRunner {
  process(doc: PostOcrDocument): Promise<PostOcrProcessedDocument>;
}
