export type Greeting = 'Good Morning' | 'Good Afternoon' | 'Good Evening';

/** Morning 5:00–11:59, afternoon 12:00–16:59, evening otherwise (including late night). */
export function greetingFor(date: Date): Greeting {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/** Up to two initials for an avatar: "Rahim Uddin" → "RU", "rahim" → "R", "" → "". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}
