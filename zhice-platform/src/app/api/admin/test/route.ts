import { generateText } from "ai";
import { createAiModel } from "@/lib/ai-model";
import { NextResponse } from "next/server";
import { hasAdminCookie } from "@/lib/admin-auth";
import { AI_FEATURES, getAiConfig, type AiFeatureConfig, type AiFeatureId } from "@/lib/ai-config";

export async function POST(request: Request) {
  if (!hasAdminCookie(request)) return NextResponse.json({ ok: false, error: "请先登录后台。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { featureId?: string; config?: Partial<AiFeatureConfig> };
  const featureId = body.featureId;
  if (!featureId || !AI_FEATURES.some((feature) => feature.id === featureId)) return NextResponse.json({ ok: false, error: "未知的功能区。" }, { status: 400 });
  const saved = await getAiConfig(featureId as AiFeatureId);
  const override = body.config || {};
  const config: AiFeatureConfig = {
    ...saved,
    provider: override.provider || saved.provider,
    enabled: override.enabled ?? saved.enabled,
    apiKey: override.apiKey?.trim() || saved.apiKey,
    baseUrl: override.baseUrl?.trim() || saved.baseUrl,
    model: override.model?.trim() || saved.model,
    systemPrompt: override.systemPrompt?.trim() || saved.systemPrompt,
    temperature: typeof override.temperature === "number" ? override.temperature : saved.temperature,
    maxTokens: typeof override.maxTokens === "number" ? override.maxTokens : saved.maxTokens,
  };
  if (!config.enabled) return NextResponse.json({ ok: false, error: "该功能区已停用。" }, { status: 400 });
  if (!config.apiKey) return NextResponse.json({ ok: false, error: "尚未配置 API Key。" }, { status: 400 });
  if (!config.baseUrl) return NextResponse.json({ ok: false, error: "尚未配置 Base URL。" }, { status: 400 });
  if (!config.model) return NextResponse.json({ ok: false, error: "尚未配置模型名称。" }, { status: 400 });
  const startedAt = Date.now();
  try {
    let adjustedTemperature: number | undefined;
    const model = createAiModel(config, { onTemperatureAdjustment: (value) => { adjustedTemperature = value; } });
    const result = await generateText({ model, system: config.systemPrompt, prompt: "请只回复：连接测试成功。", temperature: config.temperature, maxOutputTokens: Math.min(config.maxTokens, 100) });
    const adjustmentNote = adjustedTemperature === undefined ? "" : `（已按模型要求自动将 Temperature 调整为 ${adjustedTemperature}）`;
    return NextResponse.json({ ok: true, message: `${result.text || "连接测试成功"}${adjustmentNote}`, latencyMs: Date.now() - startedAt });
  } catch (error) {
    const upstreamMessage = error instanceof Error ? error.message : "模型连接失败。";
    const modelUnavailable = /not found.*model|model.*not found|model_not_found|model.*permission denied/i.test(upstreamMessage);
    const modelHint = /^Kimi K3\.1 Pro$/i.test(config.model) ? " Kimi K3.1 Pro 对应的 API 模型 ID 是 kimi-k3.1-pro。" : "";
    const message = modelUnavailable
      ? `模型 ID 不存在，或当前密钥无访问权限。请点击“获取可用模型”后选择，再测试连接。${modelHint}`
      : upstreamMessage.replaceAll(config.apiKey, "[已隐藏密钥]");
    return NextResponse.json({ ok: false, error: message.slice(0, 500), latencyMs: Date.now() - startedAt }, { status: 502 });
  }
}
