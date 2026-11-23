import { useEffect, useRef } from 'react';

/**
 * Long enough for a screen or modal to finish sliding in. Focusing during the transition
 * (what `autoFocus` does) often moves the cursor without opening the keyboard on real
 * Android and iOS devices.
 */
export const AUTO_FOCUS_DELAY_MS = 450;

/**
 * Focuses the input on its ref after the screen has settled, when `enabled`. Use instead
 * of the `autoFocus` prop: `const ref = useAutoFocus<TextInput>(autoFocus)` → `<TextInput ref={ref} />`.
 */
export function useAutoFocus<T extends { focus: () => void }>(enabled: boolean | undefined) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => ref.current?.focus(), AUTO_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled]);
  return ref;
}

type Focusable = { focus: () => void; blur: () => void; isFocused: () => boolean };

/**
 * Focuses an input from a tap outside it (its padding, a label, a sign) and makes sure the
 * keyboard opens. On Android, closing the keyboard with Back leaves the input focused, and
 * `focus()` on a focused input doesn't bring the keyboard back, so it's re-focused instead.
 */
export function focusInput(input: Focusable | null | undefined) {
  if (!input) return;
  if (!input.isFocused()) {
    input.focus();
    return;
  }
  input.blur();
  setTimeout(() => input.focus(), 50);
}
