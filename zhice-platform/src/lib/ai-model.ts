import { createOpenAI } from "@ai-sdk/openai";
import type { AiFeatureConfig } from "./ai-config";

type ModelConfig = Pick<AiFeatureConfig, "apiKey" | "baseUrl" | "model">;
type ModelOptions = {
  fetch?: typeof globalThis.fetch;
  onTemperatureAdjustment?: (temperature: number) => void;
};

function requiredTemperature(message: string): number | undefined {
  // Only react to an explicit fixed-value restriction, not range or auth errors.
  const match = message.match(/\btemperature\b[\s\S]{0,180}?\bonly\s+(?:the\s+)?(?:default\s*\(\s*)?([0-9]+(?:\.[0-9]+)?)\s*\)?\s*(?:value\s+)?(?:is\s+)?(?:allowed|supported)\b/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 2 ? value : undefined;
}

async function temperatureRestriction(response: Response) {
  const text = await response.clone().text();
  try {
    const payload = JSON.parse(text) as { error?: { message?: unknown } | string; message?: unknown };
    const message = typeof payload.error === "string" ? payload.error : payload.error?.message ?? payload.message;
    return typeof message === "string" ? requiredTemperature(message) : undefined;
  } catch {
    return requiredTemperature(text);
  }
}

export function createAiModel(config: ModelConfig, options: ModelOptions = {}) {
  const upstreamFetch = options.fetch ?? globalThis.fetch;
  let fixedTemperature: number | undefined;

  const compatibleFetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body !== "string") return upstreamFetch(input, init);
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(init.body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return upstreamFetch(input, init);
      body = parsed as Record<string, unknown>;
    } catch {
      return upstreamFetch(input, init);
    }

    // Remember the restriction within this model instance (including Agent steps).
    if (fixedTemperature !== undefined) body.temperature = fixedTemperature;
    const response = await upstreamFetch(input, { ...init, body: JSON.stringify(body) });
    if (![400, 422].includes(response.status) || typeof body.temperature !== "number") return response;

    const required = await temperatureRestriction(response);
    if (required === undefined || body.temperature === required) return response;

    fixedTemperature = required;
    options.onTemperatureAdjustment?.(required);
    // Retry only a rejected request, before any output is consumed, exactly once.
    return upstreamFetch(input, { ...init, body: JSON.stringify({ ...body, temperature: required }) });
  };

  const provider = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl, fetch: compatibleFetch });
  // Domestic OpenAI-compatible endpoints use /chat/completions, not /responses.
  return provider.chat(config.model);
}
