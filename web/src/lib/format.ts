// Small formatting helpers shared by more than one panel. Single-use
// helpers (isoWeekKey, findDoc, slugify, …) stay local to their panel.

/** Strips a leading `---\n...\n---\n` YAML frontmatter block, if present.
 * Used by Roadmap (server-parsed `meta` still leaves the raw header in
 * `markdown`) and Docs (raw file content fetched straight from disk). */
export function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? markdown.slice(match[0].length) : markdown;
}

/** Coarse relative-time label ("3h ago", "2d ago") for an ISO timestamp.
 * Falls back to the raw string if it doesn't parse. Used by Activity's feed
 * rows and Releases' publish dates. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(diffMs)) return iso;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
