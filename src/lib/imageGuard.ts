/**
 * B-4: Image size and resolution guards for OCR ingest.
 *
 * - Rejects images > 20 MB before OCR starts
 * - Downsamples images 5–20 MB to 2x display resolution
 * - Emits float progress (0–1) via callback
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024;
const TARGET_MAX_DIMENSION = 3840;

export type OcrProgressCallback = (progress: number) => void;

export class ImageTooLargeError extends Error {
  constructor(bytes: number) {
    super(
      `Image is ${(bytes / 1024 / 1024).toFixed(1)} MB — maximum allowed is 20 MB. Please resize before indexing.`
    );
    this.name = "ImageTooLargeError";
  }
}

async function downsampleImage(file: File, onProgress: OcrProgressCallback): Promise<Blob> {
  onProgress(0.1);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      onProgress(0.3);
      const { naturalWidth: w, naturalHeight: h } = img;
      if (Math.max(w, h) <= TARGET_MAX_DIMENSION) { onProgress(0.4); resolve(file); return; }
      const scale = TARGET_MAX_DIMENSION / Math.max(w, h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      onProgress(0.6);
      canvas.toBlob(
        (blob) => { if (!blob) { reject(new Error("Canvas toBlob failed")); return; } onProgress(0.7); resolve(blob); },
        "image/jpeg", 0.92
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image for downsampling")); };
    img.src = url;
  });
}

export async function prepareImageForOcr(
  file: File,
  onProgress: OcrProgressCallback = () => {}
): Promise<Blob> {
  onProgress(0);
  if (file.size > MAX_FILE_BYTES) throw new ImageTooLargeError(file.size);
  if (file.size >= LARGE_FILE_THRESHOLD) {
    const downsampled = await downsampleImage(file, onProgress);
    onProgress(0.8);
    return downsampled;
  }
  onProgress(0.4);
  return file;
}
