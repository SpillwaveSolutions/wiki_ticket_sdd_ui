import { Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar";
import SideNav from "./components/SideNav";
import { PANELS } from "./lib/panels";

export default function App() {
  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <TopBar />
      <div className="flex min-h-0 flex-1 gap-4">
        <SideNav />
        <main className="min-h-0 flex-1">
          <Routes>
            {PANELS.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Routes>
        </main>
      </div>
    </div>
  );
}
