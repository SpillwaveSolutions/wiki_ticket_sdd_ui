// Normalizes the `external` field of a WorklogItem. Real repo data is a flat
// object `{system, key, url, hash?, synced_at?}` (see WorklogItem in
// types.ts), but the shape isn't schema-enforced, so this also tolerates a
// `{github: {...}}` wrapper and an array of refs (first entry wins) —
// defensive against older/foreign sync adapters. Shared by Board and
// SyncHealth so both panels agree on what counts as "linked".
export interface ExternalRef {
  system?: string;
  key?: string | number;
  url?: string;
}

/** `raw` is typed `unknown` (not `WorklogItem["external"]`) because this
 * function's whole job is tolerating shapes looser than the documented type. */
export function normalizeExternal(raw: unknown): ExternalRef | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    const first = raw.find((r) => r && typeof r === "object");
    return first ? normalizeExternal(first) : null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.github && typeof obj.github === "object") {
    const gh = obj.github as Record<string, unknown>;
    return { system: "github", key: gh.key as string | number | undefined, url: gh.url as string | undefined };
  }
  if ("key" in obj || "number" in obj || "url" in obj) {
    return {
      system: obj.system as string | undefined,
      key: (obj.key ?? obj.number) as string | number | undefined,
      url: obj.url as string | undefined,
    };
  }
  return null;
}
