/**
 * Bangladeshi mobile numbers: 11 digits starting with 013–019 (e.g. 017XXXXXXXX),
 * optionally written with the +880 / 880 country code, spaces or dashes.
 */
const LOCAL_MOBILE = /^01[3-9]\d{8}$/;

/** Returns the number in international form (`+8801XXXXXXXXX`), or `null` if it isn't a valid BD mobile number. */
export function normalizeBdPhone(input: string): string | null {
  let digits = input.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+880')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('880')) digits = `0${digits.slice(3)}`;
  return LOCAL_MOBILE.test(digits) ? `+88${digits}` : null;
}

/** For display and editing: `+8801712345678` → `01712-345678`. Other text is returned as is. */
export function formatBdPhone(phone: string): string {
  const local = phone.startsWith('+88') ? phone.slice(3) : phone;
  return LOCAL_MOBILE.test(local) ? `${local.slice(0, 5)}-${local.slice(5)}` : phone;
}
