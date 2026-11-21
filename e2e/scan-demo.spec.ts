import { expect, test } from "@playwright/test";
import { ScanSuccessSchema, SafeErrorSchema } from "../src/lib/scan/response";

/**
 * Server-side scan, end to end. The app runs with GITHUB_DEMO_USERNAME=fixture-user
 * and GITHUB_API_BASE_URL pointing at a local mock GitHub server (see
 * playwright.config.ts and e2e/support/mock-github-server.mjs). The mock records
 * every request, so we can prove nothing reached the real api.github.com.
 */
const MOCK_GITHUB_URL = "http://127.0.0.1:3101";

test("POST /api/scan with demo:true returns a valid demo scan from the mocked GitHub", async ({
  request,
}) => {
  await request.delete(`${MOCK_GITHUB_URL}/__requests`);

  const response = await request.post("/api/scan", { data: { demo: true } });
  expect(response.status()).toBe(200);

  const body = ScanSuccessSchema.parse(await response.json());
  expect(body.mode).toBe("demo");
  expect(body.repos.map((repo) => repo.name)).toEqual(["alpha-app", "beta-lib"]);
  expect(body.skippedForks).toBe(1);

  // The mock saw only GET requests for the fixture account, and nothing else.
  const received: string[] = await (await request.get(`${MOCK_GITHUB_URL}/__requests`)).json();
  expect(received.length).toBeGreaterThan(0);
  expect(received.every((entry) => entry.startsWith("GET "))).toBe(true);
  expect(received).toContain("GET /users/fixture-user/repos");
  expect(received).toContain("GET /repos/fixture-user/alpha-app/commits");
  expect(received).toContain("GET /repos/fixture-user/beta-lib/readme");
  // Every request went to the mock (it is the only place that records), none to GitHub.
  expect(JSON.stringify(received)).not.toContain("api.github.com");
});

test("POST /api/scan rejects a non-boolean includeForks with a Safe_Error", async ({ request }) => {
  const response = await request.post("/api/scan", { data: { includeForks: "yes" } });
  expect(response.status()).toBe(400);

  const body = SafeErrorSchema.parse(await response.json());
  expect(body.error.code).toBe("validation_error");
  expect(body.error.message.length).toBeGreaterThan(0);
});
