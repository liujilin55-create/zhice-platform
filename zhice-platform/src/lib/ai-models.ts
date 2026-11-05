export type AvailableAiModel = { id: string; ownedBy: string };

export class AiModelsError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AiModelsError";
    this.status = status;
  }
}

export async function listAiModels(config: { apiKey: string; baseUrl: string }, upstreamFetch: typeof fetch = globalThis.fetch): Promise<AvailableAiModel[]> {
  if (!config.apiKey.trim()) throw new AiModelsError("请先填写 API Key，或使用已保存的密钥。", 400);
  let url: URL;
  try {
    url = new URL(`${config.baseUrl.trim().replace(/\/+$/, "")}/models`);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
  } catch {
    throw new AiModelsError("Base URL 无效，请填写完整的 API 地址。", 400);
  }

  let response: Response;
  try {
    response = await upstreamFetch(url, { headers: { Authorization: `Bearer ${config.apiKey.trim()}`, Accept: "application/json" }, signal: AbortSignal.timeout(12000), cache: "no-store", redirect: "error" });
  } catch {
    throw new AiModelsError("获取模型列表失败，请检查 API 地址与网络后重试。", 502);
  }

  if (!response.ok) {
    if ([401, 403].includes(response.status)) throw new AiModelsError("平台拒绝访问模型列表，请核对 API Key、账户权限及所属平台。", 400);
    if ([404, 405].includes(response.status)) throw new AiModelsError("此接口未提供模型列表，请从供应商控制台复制 API 模型 ID 或 Endpoint ID。", 400);
    if (response.status === 429) throw new AiModelsError("模型列表请求过于频繁，请稍后重试。", 429);
    throw new AiModelsError(`模型列表接口返回 HTTP ${response.status}，请稍后重试。`, 502);
  }

  let payload: unknown;
  try { payload = await response.json(); } catch { throw new AiModelsError("模型列表响应不是 JSON，请检查 Base URL。", 502); }
  if (!payload || typeof payload !== "object" || !("data" in payload) || !Array.isArray(payload.data)) throw new AiModelsError("平台未返回兼容的模型列表，请从供应商控制台复制模型 ID。", 502);

  const models: AvailableAiModel[] = [];
  const ids = new Set<string>();
  for (const entry of payload.data) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id.trim() || ids.has(entry.id)) continue;
    ids.add(entry.id);
    models.push({ id: entry.id, ownedBy: typeof entry.owned_by === "string" ? entry.owned_by : "" });
  }
  return models.sort((first, second) => first.id.localeCompare(second.id));
}
