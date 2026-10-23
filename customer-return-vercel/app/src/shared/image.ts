/**
 * Return photos travel to the returns service as base64 data URLs, one photo
 * per request. Every photo is downscaled hard enough to stay well inside the
 * storefront proxy's 1 MB request limit.
 */

const MAX_EDGE = 1000;
const JPEG_QUALITY = 0.7;
/** Refuse anything that still exceeds this after compression. */
export const MAX_PHOTO_BYTES = 700_000;

export interface ReturnPhoto {
  /** Local-only id, so a photo can be removed before submitting. */
  id: string;
  dataUrl: string;
  mimeType: string;
  bytes: number;
  name: string;
}

let photoSeq = 0;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file is not a valid image"));
    image.src = dataUrl;
  });
}

/**
 * Downscale to at most MAX_EDGE on the long side and re-encode as JPEG.
 * Falls back to the original data URL when the canvas is unavailable.
 */
export async function compressPhoto(file: File): Promise<ReturnPhoto> {
  const original = await readAsDataUrl(file);
  let dataUrl = original;
  let mimeType = file.type || "image/jpeg";

  try {
    const image = await loadImage(original);
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (context) {
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      mimeType = "image/jpeg";
    }
  } catch {
    // Keep the original bytes; the size guard below still applies.
  }

  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (bytes > MAX_PHOTO_BYTES) {
    throw new Error(
      `"${file.name}" is too large to attach even after compression. ` +
        "Please use a smaller image.",
    );
  }

  photoSeq += 1;
  return {
    id: `photo-${Date.now()}-${photoSeq}`,
    dataUrl,
    mimeType,
    bytes,
    name: file.name,
  };
}
