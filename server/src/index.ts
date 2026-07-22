import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

function parseArgs(argv: string[]): { repo?: string; port?: number } {
  const out: { repo?: string; port?: number } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo" && argv[i + 1]) out.repo = argv[++i];
    if (argv[i] === "--port" && argv[i + 1]) out.port = Number(argv[++i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const repoPath = args.repo || process.env.WORKLOG_REPO || process.cwd();
// 4181 matches the web dev proxy's default VITE_API_PORT (web/vite.config.ts)
// — was 4180 here, silently breaking `npm run dev` out of the box.
const port = args.port || Number(process.env.PORT) || 4181;

const app = createApp(repoPath);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`wiki-ticket-ui server on http://localhost:${info.port} (repo: ${repoPath})`);
});
