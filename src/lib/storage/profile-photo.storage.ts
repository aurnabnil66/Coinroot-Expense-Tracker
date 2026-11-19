import { File } from 'expo-file-system';
import { ImageManipulator, type ImageRef, SaveFormat } from 'expo-image-manipulator';

import { PHOTO_QUALITY, savedPhotoProblem, squareCrop } from '@/lib/utils';

/** A photo that can't be used, with a message for the user. */
export class PhotoError extends Error {}

/** Big originals are decoded at most this large (keeps memory in check; still far above the saved size). */
const DECODE_LIMIT = 4096;
/** Tried in turn until the photo fits the size limit (the first one nearly always does). */
const QUALITIES = [PHOTO_QUALITY, 0.6, 0.4];

/**
 * Turns a picked photo into the profile photo: crops the centred square, shrinks it to
 * `PHOTO_SIDE` pixels and saves it as a JPEG in the cache (typically 30–80 KB). Returns its
 * `file://` URI; `saveProfile` then copies it into the documents folder. Throws `PhotoError`
 * when the photo can't be read or made small enough.
 */
export async function shrinkPhoto(uri: string): Promise<string> {
  let loaded: ImageRef | undefined;
  let square: ImageRef | undefined;
  try {
    try {
      loaded = await ImageManipulator.manipulate(uri, { maxWidth: DECODE_LIMIT, maxHeight: DECODE_LIMIT }).renderAsync();
    } catch {
      throw new PhotoError("This photo couldn't be read. Try another one.");
    }
    const { originX, originY, side, target } = squareCrop(loaded.width, loaded.height);
    square = await ImageManipulator.manipulate(loaded)
      .crop({ originX, originY, width: side, height: side })
      .resize({ width: target, height: target })
      .renderAsync();

    let problem: string | null = null;
    for (const compress of QUALITIES) {
      const saved = await square.saveAsync({ compress, format: SaveFormat.JPEG });
      const file = new File(saved.uri);
      problem = savedPhotoProblem(file.size);
      if (!problem) return saved.uri;
      deleteQuietly(file);
      if (file.size <= 0) break;
    }
    throw new PhotoError(problem ?? "This photo couldn't be read. Try another one.");
  } catch (e) {
    if (e instanceof PhotoError) throw e;
    throw new PhotoError("This photo couldn't be prepared. Try another one.");
  } finally {
    loaded?.release();
    square?.release();
  }
}

function deleteQuietly(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // A leftover cache file is harmless.
  }
}
