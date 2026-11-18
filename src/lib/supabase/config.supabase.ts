/**
 * Supabase project settings from the environment (`.env.local`, see `.env.example`).
 * Expo inlines `EXPO_PUBLIC_*` values at build time, so they must be read by their full name.
 *
 * Both values are public: the publishable key only identifies the project, and Row Level
 * Security on the database decides what a signed-in user can read and write.
 * Without them the app still works fully; only signing in is unavailable.
 */
export type SupabaseConfig = {
  url: string;
  publishableKey: string;
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfig: SupabaseConfig | null = url && publishableKey ? { url, publishableKey } : null;

/** Whether this build can sign in (the Supabase URL and key were set when it was built). */
export const isCloudConfigured = supabaseConfig !== null;
