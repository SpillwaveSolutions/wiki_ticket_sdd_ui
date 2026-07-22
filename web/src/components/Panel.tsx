import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

/** Shared shell every panel renders into: title + optional toolbar + content well. */
export default function Panel({ title, toolbar, children }: PanelProps) {
  return (
    <section className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        {toolbar}
      </header>
      <div className="glass min-h-0 flex-1 overflow-auto rounded-xl p-4">{children}</div>
    </section>
  );
}
