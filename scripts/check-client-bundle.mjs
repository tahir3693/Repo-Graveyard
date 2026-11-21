// Fails if the client bundle (.next/static) contains server-only code or secret names.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), ".next", "static");
const FORBIDDEN = [
  "octokit",
  "GITHUB_SECRET",
  "AUTH_SECRET",
  "GITHUB_DEMO_TOKEN",
  "LLM_API_KEY",
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

if (!existsSync(ROOT)) {
  console.error("check-client-bundle: .next/static not found. Run `npm run build` first.");
  process.exit(2);
}

const hits = [];
let scanned = 0;
for (const file of walk(ROOT)) {
  if (!/\.(js|mjs|css|html|json|map|txt)$/.test(file)) continue;
  scanned += 1;
  const text = readFileSync(file, "utf8").toLowerCase();
  for (const term of FORBIDDEN) {
    if (text.includes(term.toLowerCase())) hits.push(`${file}: ${term}`);
  }
}

if (hits.length > 0) {
  console.error("check-client-bundle: forbidden strings found in client bundle:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log(`check-client-bundle: ${scanned} files scanned, no forbidden strings.`);
