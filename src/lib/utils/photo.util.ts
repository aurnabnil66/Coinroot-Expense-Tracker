/**
 * Rules for the profile photo. A picked photo is checked (`pickedPhotoProblem`), then cropped
 * to a square and shrunk to `PHOTO_SIDE` pixels as a JPEG on the phone, so what's stored and
 * uploaded is small (typically 30–80 KB) whatever the camera made. The cloud bucket enforces
 * `MAX_PHOTO_BYTES` and JPEG too (see the avatars migration). Pure and tested.
 */

/** Width and height of the saved photo (it's shown as a small circle). */
export const PHOTO_SIDE = 512;
/** JPEG quality of the saved photo (0–1). */
export const PHOTO_QUALITY = 0.8;
/** The saved photo may be at most this big: the cloud bucket refuses anything larger. */
export const MAX_PHOTO_BYTES = 1024 * 1024;
/** Picked originals larger than this aren't accepted (decoding them could run out of memory). */
export const MAX_PICKED_PHOTO_BYTES = 25 * 1024 * 1024;
/** A picked photo must be at least this many pixels on its shorter side. */
export const MIN_PHOTO_SIDE = 128;
/** Image types the phone can read and shrink. GIFs (often animated) and other files aren't accepted. */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;

/** What the photo picker tells us about a picked file (any field may be missing). */
export type PickedPhoto = {
  type?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
};

/** "3.4 MB", "820 KB": for messages. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Why a picked file can't be the profile photo, or `null` when it's fine. Unknown details pass (the shrink step checks the rest). */
export function pickedPhotoProblem(photo: PickedPhoto): string | null {
  const mime = photo.mimeType?.toLowerCase().trim() || null;
  if ((photo.type && photo.type !== 'image') || (mime && !(PHOTO_MIME_TYPES as readonly string[]).includes(mime))) {
    return 'Choose a photo (JPG, PNG, WebP or HEIC).';
  }
  if (photo.fileSize && photo.fileSize > MAX_PICKED_PHOTO_BYTES) {
    return `This photo is too large (${formatFileSize(photo.fileSize)}). Choose one under ${formatFileSize(MAX_PICKED_PHOTO_BYTES)}.`;
  }
  const { width, height } = photo;
  if (width && height && Math.min(width, height) < MIN_PHOTO_SIDE) {
    return `This photo is too small (${width} × ${height}). Choose one at least ${MIN_PHOTO_SIDE} × ${MIN_PHOTO_SIDE} pixels.`;
  }
  return null;
}

/** The centred square to crop from a `width` × `height` image, and the side to shrink it to. */
export function squareCrop(width: number, height: number): { originX: number; originY: number; side: number; target: number } {
  const side = Math.min(width, height);
  return {
    originX: Math.floor((width - side) / 2),
    originY: Math.floor((height - side) / 2),
    side,
    target: Math.min(side, PHOTO_SIDE),
  };
}

/** Why a shrunk photo can't be saved, or `null` when it's fine. */
export function savedPhotoProblem(bytes: number): string | null {
  if (bytes <= 0) return "This photo couldn't be read. Try another one.";
  if (bytes > MAX_PHOTO_BYTES) return "This photo couldn't be made small enough. Try another one.";
  return null;
}
