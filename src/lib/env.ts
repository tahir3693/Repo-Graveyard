export type EnvRecord = Record<string, string | undefined>;

export type AuthEnv = { githubId: string; githubSecret: string; authSecret: string };
export type DemoConfig = { username: string; token: string | null };

const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function readTrimmed(env: EnvRecord, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

export function readAuthEnv(env: EnvRecord): AuthEnv | null {
  const githubId = readTrimmed(env, "GITHUB_ID");
  const githubSecret = readTrimmed(env, "GITHUB_SECRET");
  const authSecret = readTrimmed(env, "AUTH_SECRET");
  if (githubId === null || githubSecret === null || authSecret === null) {
    return null;
  }
  return { githubId, githubSecret, authSecret };
}

export function readDemoConfig(env: EnvRecord): DemoConfig | null {
  const username = readTrimmed(env, "GITHUB_DEMO_USERNAME");
  if (username === null || !USERNAME_PATTERN.test(username)) {
    return null;
  }
  return { username, token: readTrimmed(env, "GITHUB_DEMO_TOKEN") };
}
