import { Directory, File, Paths } from 'expo-file-system';

import { createSetting } from './settings.storage';

export type Profile = {
  /** One-word name used to greet the user; empty until the profile is created. */
  nickname: string;
  /** `file://` URI of the profile photo in the app's documents folder, or `null` for the initial. */
  photo: string | null;
  /** Contact email; with an account it's the sign-in email. Empty when not given. */
  email: string;
  /** Bangladeshi mobile number as `+8801XXXXXXXXX`, or `null`. */
  phone: string | null;
};

const EMPTY_PROFILE: Profile = { nickname: '', photo: null, email: '', phone: null };

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/** The user's profile, on this device only (stored as JSON in MMKV). */
export const profileSetting = createSetting<Profile>({
  key: 'profile',
  fallback: EMPTY_PROFILE,
  read: (storage, key) => {
    const raw = storage.getString(key);
    if (!raw) return undefined;
    try {
      const value = JSON.parse(raw) as Record<string, unknown>;
      return {
        // Earlier versions stored a full `name`; its first word becomes the nickname.
        nickname: text(value.nickname) || text(value.name).trim().split(/\s+/)[0] || '',
        photo: typeof value.photo === 'string' ? value.photo : null,
        email: text(value.email),
        phone: typeof value.phone === 'string' ? value.phone : null,
      };
    } catch {
      return undefined;
    }
  },
  write: (storage, key, value) => storage.set(key, JSON.stringify(value)),
});

const PHOTO_FOLDER = 'profile';

/**
 * Saves the profile. A newly picked photo (in the picker's temporary cache) is copied into
 * the app's documents folder so it survives cache clean-ups; the previous photo is deleted.
 */
export async function saveProfile(next: Profile): Promise<Profile> {
  const previous = profileSetting.get().photo;
  let photo = next.photo;

  if (photo && photo !== previous) {
    const folder = new Directory(Paths.document, PHOTO_FOLDER);
    folder.create({ intermediates: true, idempotent: true });
    const source = new File(photo);
    const extension = source.extension || '.jpg';
    const target = new File(folder, `photo-${Date.now()}${extension}`);
    await source.copy(target);
    photo = target.uri;
  }

  const saved = { ...next, photo };
  profileSetting.set(saved);

  if (previous && previous !== photo) deleteQuietly(previous);
  return saved;
}

function deleteQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // An orphaned photo file is harmless.
  }
}
