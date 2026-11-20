import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  // Plan text and repository text are untrusted: never render them as HTML.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "react/no-danger": "error",
    },
  },
]);

export default eslintConfig;
