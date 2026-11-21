/** Test-only fake LlmClient. Scripted per attempt; records every request. */
import type { LlmClient, LlmGenerateArgs } from "@/lib/llm";

export type FakeLlmStep = { text: string } | { reject: string } | { hang: true };

export type RecordedRequest = Omit<LlmGenerateArgs, "signal">;

export type FakeLlm = {
  client: LlmClient;
  requests: RecordedRequest[];
};

/** The last step repeats when there are more calls than steps. */
export function createFakeLlm(steps: readonly FakeLlmStep[]): FakeLlm {
  const requests: RecordedRequest[] = [];
  const client: LlmClient = {
    async generate(args) {
      const { signal, ...rest } = args;
      void signal;
      requests.push(rest);
      const step = steps[Math.min(requests.length - 1, steps.length - 1)];
      if (step === undefined) throw new Error("no scripted step");
      if ("reject" in step) throw new Error(step.reject);
      if ("hang" in step) return new Promise<{ text: string }>(() => undefined);
      return { text: step.text };
    },
  };
  return { client, requests };
}
