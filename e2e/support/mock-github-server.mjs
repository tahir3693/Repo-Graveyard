// Minimal local stand-in for api.github.com, used only by the e2e run.
// The app's Octokit client is pointed here through GITHUB_API_BASE_URL.
// GET /__requests lists every request received; DELETE /__requests clears the list.
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_GITHUB_PORT ?? 3101);
const USERNAME = "fixture-user";
const received = [];

const repo = (name, extra = {}) => ({
  name,
  html_url: `https://github.com/${USERNAME}/${name}`,
  description: `${name} fixture`,
  fork: false,
  archived: false,
  stargazers_count: 3,
  open_issues_count: 1,
  language: "TypeScript",
  pushed_at: "2023-03-01T10:00:00Z",
  default_branch: "main",
  owner: { login: USERNAME },
  ...extra,
});

const REPOS = [repo("alpha-app"), repo("beta-lib", { stargazers_count: 12 }), repo("forked-thing", { fork: true })];
const COMMITS = [{ commit: { committer: { date: "2023-03-01T10:00:00Z" } } }];

function route(pathname) {
  if (pathname === "/users/fixture-user/repos") return REPOS;
  if (/^\/repos\/fixture-user\/[^/]+\/commits$/.test(pathname)) return COMMITS;
  if (/^\/repos\/fixture-user\/[^/]+\/commits\/main\/check-runs$/.test(pathname)) {
    return { total_count: 1, check_runs: [{ conclusion: "success" }] };
  }
  if (/^\/repos\/fixture-user\/[^/]+\/readme$/.test(pathname)) return { name: "README.md" };
  return null;
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/__requests") {
    if (req.method === "DELETE") received.length = 0;
    return send(res, 200, received);
  }
  if (url.pathname === "/") return send(res, 200, { ok: true });
  received.push(`${req.method} ${url.pathname}`);
  const body = req.method === "GET" ? route(url.pathname) : null;
  if (body === null) return send(res, 404, { message: "Not Found" });
  return send(res, 200, body);
}).listen(PORT, "127.0.0.1");
