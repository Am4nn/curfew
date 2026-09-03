// Compressing a photo in the browser, before it goes anywhere.
//
// Everything happens on a canvas, and a canvas holds nothing but pixels. That
// is what strips EXIF: the original file's bytes are never what we upload, so
// GPS and the rest are gone by construction rather than by a pass that could
// miss a field (decision 98). Sizes come from the type (decision 97).

/** Bigger than this is refused before it is read. A video, usually. */
export const MAX_SOURCE_BYTES = 50_000_000;

export interface Compressed {
  blob: Blob;
  contentType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
  /** For the preview, revoked by the caller when it is done. */
  url: string;
}

let webpSupport: boolean | null = null;

/** Can this browser ENCODE webp? Decoding it is not the same question. */
function canEncodeWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    webpSupport = probe.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      type,
      quality,
    );
  });
}

/** Fit inside a square of `maxEdge`, never scaling a small photo up. */
function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

async function draw(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: { maxEdge: number; quality: number },
): Promise<Compressed> {
  const { width, height } = fit(sourceWidth, sourceHeight, options.maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");
  context.drawImage(source, 0, 0, width, height);

  const webp = canEncodeWebp();
  const contentType = webp ? "image/webp" : "image/jpeg";
  const blob = await toBlob(canvas, contentType, options.quality);

  return { blob, contentType, width, height, url: URL.createObjectURL(blob) };
}

/** A frame from a live camera. There is no file, so there is nothing to strip. */
export async function compressFrame(
  video: HTMLVideoElement,
  options: { maxEdge: number; quality: number },
): Promise<Compressed> {
  return draw(video, video.videoWidth, video.videoHeight, options);
}

/**
 * A file from the gallery, for the types that allow one. Anything the browser
 * can decode is re-encoded rather than refused (decision 100), so a 40 MB HEIC
 * becomes a 180 KB JPEG and never reaches the network at full size.
 */
export async function compressFile(
  file: File,
  options: { maxEdge: number; quality: number },
): Promise<Compressed> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("That file is too large to be a photo.");
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("That is not a photo Curfew can read."));
      image.src = url;
    });
    return await draw(image, image.naturalWidth, image.naturalHeight, options);
  } finally {
    URL.revokeObjectURL(url);
  }
}
