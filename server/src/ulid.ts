// Decodes a ULID's leading 10 chars (48-bit ms timestamp, Crockford base32)
// into an epoch-ms number / ISO string. https://github.com/ulid/spec
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function ulidTimestampMs(ulid: string): number | null {
  if (!ulid || ulid.length < 10) return null;
  let ms = 0;
  for (const ch of ulid.slice(0, 10).toUpperCase()) {
    const idx = CROCKFORD.indexOf(ch);
    if (idx === -1) return null;
    ms = ms * 32 + idx;
  }
  return ms;
}

export function ulidTimestampIso(ulid: string): string | null {
  const ms = ulidTimestampMs(ulid);
  return ms === null ? null : new Date(ms).toISOString();
}
