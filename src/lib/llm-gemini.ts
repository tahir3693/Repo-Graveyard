import type { GenerateContentConfig } from "@google/genai";
import type { LlmClient, LlmGenerateArgs } from "./llm";

export type GeminiClientOptions = { apiKey: string; model: string };

/**
 * The config sent to the model. It has exactly these five keys. There are no
 * tools, tool config, function declarations or thinking config: the model
 * cannot trigger any action.
 */
export function buildGeminiConfig(args: LlmGenerateArgs): GenerateContentConfig {
  return {
    systemInstruction: args.system,
    maxOutputTokens: args.maxOutputTokens,
    temperature: args.temperature,
    abortSignal: args.signal,
    responseMimeType: "application/json",
  };
}

export function createGeminiClient({ apiKey, model }: GeminiClientOptions): LlmClient {
  let ai: Promise<InstanceType<typeof import("@google/genai").GoogleGenAI>> | null = null;

  function getClient() {
    if (ai === null) {
      ai = import("@google/genai").then(
        ({ GoogleGenAI }) =>
          new GoogleGenAI({
            apiKey,
            // Our own retry logic decides retries.
            httpOptions: { retryOptions: { attempts: 1 } },
          }),
      );
    }
    return ai;
  }

  return {
    async generate(args: LlmGenerateArgs): Promise<{ text: string }> {
      const client = await getClient();
      const res = await client.models.generateContent({
        model,
        contents: args.user,
        config: buildGeminiConfig(args),
      });
      return { text: res.text ?? "" };
    },
  };
}
