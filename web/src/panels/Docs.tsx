import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { stripFrontmatter } from "../lib/format";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";
import { ErrorState, EmptyState } from "../components/EmptyState";
import type { InventoryDoc } from "../lib/types";

// Wave 2: inventory-driven doc browser with truth-state badges + supersede
// chains from _inventory.json — see plan panel 6 (changed panel).

/** Resolve a wiki_key/canonical_key/alias reference to the doc record it names. */
function findDoc(docs: InventoryDoc[], key: string | undefined): InventoryDoc | undefined {
  if (!key) return undefined;
  return docs.find(
    (d) => d.wiki_key === key || d.canonical_key === key || (d.aliases ?? []).includes(key),
  );
}

function IdentityHeader({ doc, docs, onNavigate }: {
  doc: InventoryDoc;
  docs: InventoryDoc[];
  onNavigate: (source: string) => void;
}) {
  const supersedesDoc = findDoc(docs, doc.supersedes);
  const supersededByDoc = findDoc(docs, doc.superseded_by);
  return (
    <div className="glass mb-4 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-slate-100">{doc.title}</h2>
        <Badge axis="truth_state" value={doc.truth_state} />
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-400 sm:grid-cols-2">
        <div><dt className="inline text-slate-500">wiki_key: </dt><dd className="inline font-mono">{doc.wiki_key}</dd></div>
        {doc.canonical_key && (
          <div><dt className="inline text-slate-500">canonical_key: </dt><dd className="inline font-mono">{doc.canonical_key}</dd></div>
        )}
        {doc.status && (
          <div><dt className="inline text-slate-500">status: </dt><dd className="inline">{doc.status}</dd></div>
        )}
        {doc.date && (
          <div><dt className="inline text-slate-500">date: </dt><dd className="inline">{doc.date}</dd></div>
        )}
        {doc.aliases && doc.aliases.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="inline text-slate-500">aliases: </dt>
            <dd className="inline font-mono">{doc.aliases.join(", ")}</dd>
          </div>
        )}
        {supersedesDoc && (
          <div className="sm:col-span-2">
            <dt className="inline text-slate-500">supersedes: </dt>
            <dd className="inline">
              <button
                type="button"
                onClick={() => onNavigate(supersedesDoc.source)}
                className="focus-ring rounded text-accent hover:underline"
              >
                {supersedesDoc.title}
              </button>
            </dd>
          </div>
        )}
        {supersededByDoc && (
          <div className="sm:col-span-2">
            <dt className="inline text-slate-500">superseded by: </dt>
            <dd className="inline">
              <button
                type="button"
                onClick={() => onNavigate(supersededByDoc.source)}
                className="focus-ring rounded text-accent hover:underline"
              >
                {supersededByDoc.title}
              </button>
            </dd>
          </div>
        )}
      </dl>
      {doc.problems && doc.problems.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-300">
          {doc.problems.map((p) => (
            <li key={p}>⚠ {p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Docs() {
  const [params, setParams] = useSearchParams();
  const docs = useApi(() => api.getDocs(), []);
  const docList = docs.status === "ok" ? docs.data.docs : [];

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [truthFilter, setTruthFilter] = useState("");
  const [selectedSource, setSelectedSource] = useState<string | undefined>(
    params.get("doc") ?? undefined,
  );

  // Deep link: honor ?doc= on mount / when it changes externally.
  useEffect(() => {
    const fromUrl = params.get("doc");
    if (fromUrl) setSelectedSource(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(source: string) {
    setSelectedSource(source);
    setParams({ doc: source }, { replace: true });
  }

  const selectedDoc = docList.find((d) => d.source === selectedSource);
  const content = useApi(
    () => (selectedSource ? api.getDocContent(selectedSource) : Promise.resolve<string | null>(null)),
    [selectedSource],
  );

  const docTypes = useMemo(
    () => Array.from(new Set(docList.map((d) => d.doc_type))).sort(),
    [docList],
  );
  const truthStates = useMemo(
    () => Array.from(new Set(docList.map((d) => d.truth_state))).sort(),
    [docList],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return docList.filter((d) => {
      if (typeFilter && d.doc_type !== typeFilter) return false;
      if (truthFilter && d.truth_state !== truthFilter) return false;
      if (q && !d.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docList, search, typeFilter, truthFilter]);

  return (
    <Panel
      title="Docs"
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="focus-ring rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:border-accent/50"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="focus-ring rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-accent/50"
          >
            <option value="">All types</option>
            {docTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={truthFilter}
            onChange={(e) => setTruthFilter(e.target.value)}
            className="focus-ring rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-accent/50"
          >
            <option value="">All truth states</option>
            {truthStates.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      }
    >
      {docs.status === "loading" && <Spinner label="Loading /api/docs…" />}
      {docs.status === "error" &&
        (docs.httpStatus === 404 ? (
          <EmptyState
            title="No document inventory yet"
            detail="This repo has no docs/.index plane. Run `worklog ia-index` in the target repo and reload."
          />
        ) : (
          <ErrorState message={docs.error} />
        ))}
      {docs.status === "ok" && (
        <div className="flex h-full min-h-0 gap-4">
          <div className="w-72 shrink-0 overflow-auto">
            {filtered.length === 0 && <EmptyState title="No docs match" />}
            <ul className="flex flex-col gap-1">
              {filtered.map((d) => (
                <li key={d.wiki_key}>
                  <button
                    type="button"
                    onClick={() => navigate(d.source)}
                    className={`focus-ring w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                      d.source === selectedSource
                        ? "border-accent/50 bg-accent/10 text-slate-100"
                        : "border-transparent text-slate-300 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{d.title}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge axis="truth_state" value={d.truth_state} />
                      <span className="text-[10px] text-slate-500">{d.doc_type}</span>
                      {d.date && <span className="text-[10px] text-slate-600">{d.date}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 flex-1 overflow-auto">
            {!selectedDoc && <EmptyState title="Select a doc" detail="Pick a document from the list to view it." />}
            {selectedDoc && (
              <>
                <IdentityHeader doc={selectedDoc} docs={docList} onNavigate={navigate} />
                {content.status === "loading" && <Spinner label="Loading content…" />}
                {content.status === "error" && <ErrorState message={content.error} />}
                {content.status === "ok" && content.data && (
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripFrontmatter(content.data)}</ReactMarkdown>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
