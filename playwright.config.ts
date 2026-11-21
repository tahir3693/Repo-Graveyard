import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const MOCK_GITHUB_PORT = 3101;
const MOCK_GITHUB_URL = `http://127.0.0.1:${MOCK_GITHUB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      // Uses the installed Google Chrome, so no browser download is needed.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: [
    {
      // Local stand-in for api.github.com so no scan request leaves the machine.
      command: "node e2e/support/mock-github-server.mjs",
      url: MOCK_GITHUB_URL,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { MOCK_GITHUB_PORT: String(MOCK_GITHUB_PORT) },
    },
    {
      // Production build: React Strict Mode double effects in `next dev` would send two scan requests.
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        GITHUB_API_BASE_URL: MOCK_GITHUB_URL,
        GITHUB_DEMO_USERNAME: "fixture-user",
        // Empty on purpose: process env wins over .env.local, so no real token is used.
        GITHUB_DEMO_TOKEN: "",
      },
    },
  ],
});
