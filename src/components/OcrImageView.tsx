import type { FileRecord } from "../lib/types";

/**
 * A-2 / Track C stub: OcrImageView
 * Full implementation arrives in C-2. This stub ensures FileViewer dispatch
 * for sourceType==='image' does not render a blank screen.
 */
export function OcrImageView({ file }: { file: FileRecord }) {
  return (
    <div className="fv-unsupported">
      <span className="fv-unsupported-icon">🖼</span>
      <p className="fv-unsupported-title">{file.name}</p>
      <p className="fv-unsupported-detail">
        OCR image viewer is coming in Track C. Re-OCR and mode selection will be available soon.
      </p>
    </div>
  );
}
