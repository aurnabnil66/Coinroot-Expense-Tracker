import { createEnumSetting } from './settings.storage';

/**
 * How first-time setup was finished on this device:
 * - `none`: not yet (show setup)
 * - `own`: the user created their own accounts
 * - `sample`: "Explore with sample data"
 */
export const SETUP_STATES = ['none', 'own', 'sample'] as const;
export type SetupState = (typeof SETUP_STATES)[number];

/** Persisted so setup runs only once. Settings → "Set up accounts again" sets it back to `none`. */
export const setupStateSetting = createEnumSetting<SetupState>('setup-state', SETUP_STATES, 'none');
