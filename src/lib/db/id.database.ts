import { randomUUID } from 'expo-crypto';

/** A new row id (UUID v4), unique across devices so offline rows can sync later. */
export const newId = (): string => randomUUID();
