export type LlmRequest = {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
};

export type LlmGenerateArgs = LlmRequest & { signal: AbortSignal };

export interface LlmClient {
  generate(args: LlmGenerateArgs): Promise<{ text: string }>;
}

export type LlmFailureKind = "timeout" | "unavailable" | "invalid_output";

export type LlmResult =
  | { ok: true; text: string }
  | { ok: false; kind: LlmFailureKind };

type Outcome =
  | { tag: "response"; value: { text: unknown } }
  | { tag: "rejected" }
  | { tag: "aborted" };

function toGenerateArgs(request: LlmRequest, signal: AbortSignal): LlmGenerateArgs {
  return {
    system: request.system,
    user: request.user,
    maxOutputTokens: request.maxOutputTokens,
    temperature: request.temperature,
    signal,
  };
}

function abortPromise(signal: AbortSignal): Promise<Outcome> {
  return new Promise<Outcome>((resolve) => {
    if (signal.aborted) {
      resolve({ tag: "aborted" });
      return;
    }
    signal.addEventListener("abort", () => resolve({ tag: "aborted" }), { once: true });
  });
}

async function runGenerate(client: LlmClient, args: LlmGenerateArgs): Promise<Outcome> {
  try {
    const value = await client.generate(args);
    return { tag: "response", value };
  } catch {
    // The error is dropped on purpose: it may contain an API key.
    return { tag: "rejected" };
  }
}

function readText(value: unknown): LlmResult {
  if (typeof value !== "object" || value === null || !("text" in value)) {
    return { ok: false, kind: "invalid_output" };
  }
  const text: unknown = value.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    return { ok: false, kind: "invalid_output" };
  }
  return { ok: true, text };
}

export async function callLlm(
  client: LlmClient,
  request: LlmRequest,
  timeoutMs: number,
): Promise<LlmResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const outcome = await Promise.race([
      runGenerate(client, toGenerateArgs(request, controller.signal)),
      abortPromise(controller.signal),
    ]);
    if (timedOut || outcome.tag === "aborted") return { ok: false, kind: "timeout" };
    if (outcome.tag === "rejected") return { ok: false, kind: "unavailable" };
    return readText(outcome.value);
  } finally {
    clearTimeout(timer);
  }
}
