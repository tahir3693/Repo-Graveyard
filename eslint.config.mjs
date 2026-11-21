import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const PURE_MESSAGE =
  "Scoring is a pure function with no I/O or AI (tech.md, Scoring).";

function defaultExportSelectors() {
  const message = "Use named exports under src/lib (tech.md, Code style).";
  return [
    { selector: "ExportDefaultDeclaration", message },
    {
      selector: "ExportNamedDeclaration > ExportSpecifier[exported.name='default']",
      message,
    },
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Octokit is only imported inside src/lib/github/ (the requester). This block comes
  // before the later no-restricted-imports blocks (client guard, scoring), which replace
  // it for their files and repeat the octokit bans themselves.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/github/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "octokit",
              message: "Only src/lib/github/ may import octokit.",
            },
          ],
          patterns: [
            {
              group: ["@octokit/*"],
              message: "Only src/lib/github/ may import @octokit/*.",
            },
          ],
        },
      ],
    },
  },
  // GitHub ingestion code validates external data with Zod, so no type assertions and no
  // non-null assertions. Tests may cast fixtures. `as const` is always allowed.
  {
    files: ["src/lib/github/**/*.ts"],
    ignores: ["**/*.test.ts", "**/test-utils/**"],
    rules: {
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  // Security: client code must never import server-only modules or read the environment.
  // Tokens and API keys (GITHUB_SECRET, AUTH_SECRET, LLM_API_KEY, GITHUB_DEMO_TOKEN, user
  // access tokens) stay on the server. See .kiro/steering/tech.md ("Server and secrets").
  {
    files: ["src/components/**/*.{ts,tsx}", "src/lib/graveyard/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "octokit", message: "GitHub calls are server-only." },
            { name: "@google/genai", message: "LLM calls are server-only." },
            {
              name: "next-auth",
              message:
                "Server-side Auth.js stays on the server. Use next-auth/react in client code.",
            },
          ],
          patterns: [
            {
              group: ["@octokit/*"],
              message: "GitHub calls are server-only.",
            },
            {
              group: ["next-auth/jwt", "next-auth/next", "next-auth/providers/*"],
              message: "Session tokens and providers are server-only.",
            },
            {
              group: [
                "@/lib/llm",
                "@/lib/llm-gemini",
                "@/lib/github/*",
                "@/lib/e2e/*",
              ],
              message: "Server-only module. Call the app's own API route instead.",
            },
            {
              group: [
                "@/lib/resurrection/*",
                "!@/lib/resurrection/plan",
                "!@/lib/resurrection/response",
                "!@/lib/resurrection/copy",
                "!@/lib/resurrection/limits",
                "!@/lib/resurrection/errors",
              ],
              message:
                "Server-only resurrection module. Only plan, response, copy, limits and errors are client-safe.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Do not read process.env in client code. Secrets must never reach the browser.",
        },
      ],
    },
  },
  // src/app pages and layouts (anything outside src/app/api) must not import LLM or
  // server-only resurrection modules. Route handlers under src/app/api keep access. This
  // block replaces the octokit block for these files, so it repeats the octokit bans.
  {
    files: ["src/app/**/*.{ts,tsx}"],
    ignores: ["src/app/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "octokit", message: "Only src/lib/github/ may import octokit." },
            { name: "@google/genai", message: "LLM calls are server-only." },
          ],
          patterns: [
            {
              group: ["@octokit/*"],
              message: "Only src/lib/github/ may import @octokit/*.",
            },
            {
              group: ["@/lib/llm", "@/lib/llm-gemini", "@/lib/e2e/*"],
              message: "Server-only module. Only route handlers under src/app/api may use it.",
            },
            {
              group: [
                "@/lib/resurrection/*",
                "!@/lib/resurrection/plan",
                "!@/lib/resurrection/response",
                "!@/lib/resurrection/copy",
                "!@/lib/resurrection/limits",
                "!@/lib/resurrection/errors",
              ],
              message:
                "Server-only resurrection module. Only plan, response, copy, limits and errors are client-safe.",
            },
          ],
        },
      ],
    },
  },
  // Named exports only under src/lib (tech.md "Code style"). A later block that sets
  // no-restricted-syntax for the same files replaces this one, so those blocks repeat
  // these selectors.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", ...defaultExportSelectors()],
    },
  },
  // src/lib/graveyard is also client code: keep the process.env ban next to the default-export ban.
  {
    files: ["src/lib/graveyard/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...defaultExportSelectors(),
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Do not read process.env in client code. Secrets must never reach the browser.",
        },
      ],
    },
  },
  // Scoring and epitaphs are pure: no I/O, no clock reads, no randomness, no AI.
  // The current time is passed in as an argument. See .kiro/steering/tech.md ("Scoring").
  {
    files: ["src/lib/scoring.ts", "src/lib/epitaphs.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "fs",
            "node:fs",
            "fs/promises",
            "node:fs/promises",
            "http",
            "https",
            "node:http",
            "node:https",
            "octokit",
            "@google/genai",
            "openai",
            "@anthropic-ai/sdk",
            "ai",
          ].map((name) => ({ name, message: PURE_MESSAGE })),
          patterns: [{ group: ["@octokit/*"], message: PURE_MESSAGE }],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: PURE_MESSAGE },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: PURE_MESSAGE },
        {
          object: "Date",
          property: "now",
          message: "Pass the current time in as an argument (tech.md, Scoring).",
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...defaultExportSelectors(),
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Pass the current time in as an argument (tech.md, Scoring).",
        },
      ],
    },
  },
  // Plan text and repository text are untrusted: never render them as HTML.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "react/no-danger": "error",
    },
  },
]);

export default eslintConfig;
