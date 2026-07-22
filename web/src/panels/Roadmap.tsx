import { useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import mermaid from "mermaid";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Panel 3 — see docs/plans/2026-07-22-wiki-ticket-ui-ia.md panel 3 (Roadmap).
// docs/roadmap.md carries a YAML frontmatter header (wiki_key, doc_type,
// truth_state, source_hash, generated_at) that GET /api/roadmap already
// parses into `meta` — but `markdown` still contains the raw header, so it
// has to be stripped client-side before handing the body to react-markdown.

/** Strips a leading `---\n...\n---\n` YAML frontmatter block, if present. */
function stripFrontmatter(markdown: string): string {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n?/);
  return match ? markdown.slice(match[0].length) : markdown;
}

// ponytail: react-markdown (no rehype-raw) doesn't drop this itself when it
// isn't its own blank-line-delimited block (roadmap-render emits it right
// after the frontmatter), so it leaks through as literal text. Strip the
// generator's own HTML comments client-side rather than pull in rehype-raw
// for one line.
function stripHtmlComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->\n?/g, "");
}

function extractH2s(markdown: string): string[] {
  return [...markdown.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Flattens react children into plain text — good enough for heading text,
 * which is never anything fancier than inline formatting in generated docs. */
function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return extractText(props?.children);
  }
  return "";
}

let mermaidInitialized = false;
function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({ theme: "dark", startOnLoad: false });
  mermaidInitialized = true;
}

let mermaidSeq = 0;

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`roadmap-mermaid-${++mermaidSeq}`);

  useEffect(() => {
    ensureMermaidInit();
    let cancelled = false;
    mermaid
      .render(idRef.current, code)
      .then(({ svg: rendered }) => {
        if (!cancelled) setSvg(rendered);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <ErrorState message={`Mermaid render failed: ${error}`} />;
  if (!svg) return <Spinner label="Rendering diagram…" />;
  // eslint-disable-next-line react/no-danger
  return <div className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const text = extractText(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  if (match?.[1] === "mermaid") return <MermaidBlock code={text} />;

  const isBlock = Boolean(match) || text.includes("\n");
  if (!isBlock) {
    return <code className="rounded bg-slate-800/80 px-1 py-0.5 text-xs">{children}</code>;
  }
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-900/80 p-3 text-xs">
      <code className={className}>{children}</code>
    </pre>
  );
}

function Heading2({ children }: { children?: ReactNode }) {
  return (
    <h2 id={slugify(extractText(children))} className="mt-6 text-base font-semibold text-slate-100">
      {children}
    </h2>
  );
}

function RoadmapBody({ meta, markdown }: { meta: Record<string, string>; markdown: string }) {
  const body = stripHtmlComments(stripFrontmatter(markdown));
  const headings = extractH2s(body);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap gap-2">
          {meta.generated_at && (
            <span className="rounded border border-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
              generated {meta.generated_at}
            </span>
          )}
          {meta.source_hash && (
            <span className="rounded border border-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
              hash {meta.source_hash}
            </span>
          )}
        </div>
        <article className="max-w-none text-sm leading-relaxed text-slate-300">
          <ReactMarkdown components={{ h2: Heading2, code: CodeBlock, pre: ({ children }) => <>{children}</> }}>
            {body}
          </ReactMarkdown>
        </article>
      </div>
      {headings.length > 0 && (
        <nav className="w-48 shrink-0 text-xs text-slate-400 lg:sticky lg:top-0 lg:self-start">
          <p className="mb-2 font-semibold text-slate-300">On this page</p>
          <ul className="space-y-1">
            {headings.map((h) => (
              <li key={h}>
                <a className="hover:text-accent" href={`#${slugify(h)}`}>
                  {h}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

export default function Roadmap() {
  const roadmap = useApi(() => api.getRoadmap(), []);

  return (
    <Panel title="Roadmap">
      {roadmap.status === "loading" && <Spinner label="Loading /api/roadmap…" />}
      {roadmap.status === "error" && <ErrorState message={roadmap.error} />}
      {roadmap.status === "ok" && <RoadmapBody meta={roadmap.data.meta} markdown={roadmap.data.markdown} />}
    </Panel>
  );
}
