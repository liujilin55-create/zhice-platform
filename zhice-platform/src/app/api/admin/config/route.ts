import { NextResponse } from "next/server";
import { hasAdminCookie } from "@/lib/admin-auth";
import { AI_FEATURES, getAllAiConfigs, publicConfig, saveAiConfigPatch, type AiFeatureConfig, type AiFeatureId, type AiProvider } from "@/lib/ai-config";
import { providerPresets } from "@/lib/ai-providers";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "请先登录后台。" }, { status: 401 });
}

function isFeatureId(value: string): value is AiFeatureId {
  return AI_FEATURES.some((feature) => feature.id === value);
}

function safeNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export async function GET(request: Request) {
  if (!hasAdminCookie(request)) return unauthorized();
  const configs = await getAllAiConfigs();
  return NextResponse.json({ ok: true, features: Object.fromEntries(AI_FEATURES.map((feature) => [feature.id, publicConfig(feature.id, configs[feature.id])])) });
}

export async function PUT(request: Request) {
  if (!hasAdminCookie(request)) return unauthorized();
  const body = await request.json().catch(() => ({})) as { features?: Record<string, Partial<AiFeatureConfig> & { clearApiKey?: boolean }> };
  if (!body.features || typeof body.features !== "object") return NextResponse.json({ ok: false, error: "配置数据格式不正确。" }, { status: 400 });

  for (const [featureId, incoming] of Object.entries(body.features)) {
    if (!isFeatureId(featureId) || !incoming || typeof incoming !== "object") continue;
    const patch: Partial<AiFeatureConfig> = {
      provider: Object.hasOwn(providerPresets, String(incoming.provider)) ? incoming.provider as AiProvider : "custom",
      enabled: incoming.enabled !== false,
      baseUrl: String(incoming.baseUrl || "").trim(),
      model: String(incoming.model || "").trim(),
      systemPrompt: String(incoming.systemPrompt || "").trim().slice(0, 12000),
      temperature: safeNumber(incoming.temperature, 0.3, 0, 2),
      maxTokens: Math.round(safeNumber(incoming.maxTokens, 2400, 256, 16000)),
    };
    if (incoming.clearApiKey) patch.apiKey = "";
    else if (typeof incoming.apiKey === "string" && incoming.apiKey.trim()) patch.apiKey = incoming.apiKey.trim();
    await saveAiConfigPatch(featureId, patch);
  }

  const configs = await getAllAiConfigs();
  return NextResponse.json({ ok: true, features: Object.fromEntries(AI_FEATURES.map((feature) => [feature.id, publicConfig(feature.id, configs[feature.id])])) });
}
