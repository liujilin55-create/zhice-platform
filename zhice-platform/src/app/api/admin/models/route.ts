import { NextResponse } from "next/server";
import { hasAdminCookie } from "@/lib/admin-auth";
import { AI_FEATURES, getAiConfig, type AiFeatureId } from "@/lib/ai-config";
import { AiModelsError, listAiModels } from "@/lib/ai-models";

export async function POST(request: Request) {
  if (!hasAdminCookie(request)) return NextResponse.json({ ok: false, error: "请先登录后台。" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { featureId?: unknown; config?: { apiKey?: unknown; baseUrl?: unknown; clearApiKey?: unknown } };
  if (typeof body.featureId !== "string" || !AI_FEATURES.some((feature) => feature.id === body.featureId)) return NextResponse.json({ ok: false, error: "未知的功能区。" }, { status: 400 });
  const config = await getAiConfig(body.featureId as AiFeatureId);
  const incoming = body.config ?? {};
  const apiKey = incoming.clearApiKey === true ? "" : typeof incoming.apiKey === "string" && incoming.apiKey.trim() ? incoming.apiKey.trim() : config.apiKey;
  const baseUrl = typeof incoming.baseUrl === "string" ? incoming.baseUrl.trim() : config.baseUrl;
  try {
    const models = await listAiModels({ apiKey, baseUrl });
    return NextResponse.json({ ok: true, models });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof AiModelsError ? error.message : "获取模型列表失败，请重试。" }, { status: error instanceof AiModelsError ? error.status : 502 });
  }
}
