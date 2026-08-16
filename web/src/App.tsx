import { useState } from "react";
import { Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar";
import SideNav from "./components/SideNav";
import { PANELS } from "./lib/panels";

export default function App() {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen min-w-0 flex-col gap-4 overflow-x-hidden p-4">
      <TopBar onOpenNav={() => setNavOpen(true)} />
      <div className="flex min-h-0 min-w-0 flex-1 gap-4">
        <SideNav className="hidden md:flex" />
        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden">
          <Routes>
            {PANELS.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Routes>
        </main>
      </div>
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          />
          <SideNav
            className="absolute left-4 top-4 h-[calc(100%-2rem)] shadow-xl"
            onNavigate={() => setNavOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
