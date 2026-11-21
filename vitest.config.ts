import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    // Unit and property tests live next to the code. Playwright owns e2e/.
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
    // `vitest run` exits 0 when no test files exist yet.
    passWithNoTests: true,
    // Blocks real network access (fetch, http, https) in every test file.
    setupFiles: ["src/test/setup.ts"],
  },
});