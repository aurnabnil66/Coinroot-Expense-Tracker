import { useEffect, useState, useSyncExternalStore } from 'react';

import { type Profile, profileSetting } from '@/lib/storage';
import { type Greeting, greetingFor } from '@/lib/utils';

/** The user's name and photo (saved with `saveProfile` from `@/lib/storage`). */
export function useProfile(): Profile {
  return useSyncExternalStore(profileSetting.subscribe, profileSetting.get, () => profileSetting.fallback);
}

/** "Good morning" / "afternoon" / "evening", rechecked every minute so it changes while the app is open. */
export function useGreeting(): Greeting {
  const [greeting, setGreeting] = useState(() => greetingFor(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setGreeting(greetingFor(new Date())), 60_000);
    return () => clearInterval(timer);
  }, []);
  return greeting;
}
