import type {
  PostOcrDocument,
  PostOcrProcessedDocument,
  PostOcrRunner,
} from "./types";
import { runGeometryEngine } from "./engineAdapter";

/**
 * Production runner — delegates to the geometry engine adapter.
 * The adapter handles placeholder vs real engine switching.
 */
export class DefaultPostOcrRunner implements PostOcrRunner {
  async process(doc: PostOcrDocument): Promise<PostOcrProcessedDocument> {
    return runGeometryEngine(doc);
  }
}
