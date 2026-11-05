import { promises as fs } from "node:fs";
import path from "node:path";
import type { AiProvider } from "./ai-providers";
export { providerPresets } from "./ai-providers";
export type { AiProvider } from "./ai-providers";

export const AI_FEATURES = [
  { id: "projectOverview", label: "项目总览 Copilot", description: "风险分析、任务拆解、评分点解释与项目快照", defaultPrompt: "你是知策台项目总览 Copilot。围绕比赛评分细则、证据、任务和交付物回答，优先给出可执行的下一步。无法确认时明确标注待核实。" },
  { id: "competitionRecommendation", label: "比赛推荐", description: "专业与兴趣匹配、推荐理由和候选排序", defaultPrompt: "你是知策台竞赛顾问。根据用户专业、年级、兴趣、级别和时间偏好解释比赛匹配原因，不编造报名时间和官网信息。" },
  { id: "competitionRequirements", label: "比赛要求分析", description: "赛题结构化、论文检索与备赛指导报告", defaultPrompt: "你是高校竞赛研究与产品方案专家。严格依据比赛通知提取要求，并生成可验证、可执行的参赛指导；不确定的信息标为待核实。" },
  { id: "evidenceCenter", label: "证据中心", description: "证据摘要、引用核验与资料归纳", defaultPrompt: "你是知策台证据研究员。只根据资料原文归纳证据，保留来源、页码和链接；无法从原文确认的内容不得臆测。" },
  { id: "taskOrchestration", label: "任务编排", description: "任务拆解、依赖识别和验收标准生成", defaultPrompt: "你是知策台项目执行教练。把目标拆成有负责人、截止时间、依赖和验收标准的任务，优先处理阻塞风险。" },
  { id: "deliverableCheck", label: "成果检查", description: "提交文件检查、评分点覆盖与修复建议", defaultPrompt: "你是知策台交付质检员。依据比赛评分细则和交付文件内容检查完整性、证据覆盖、AI 能力和可演示性，输出分数、证据和修复建议。" },
  { id: "pptGenerator", label: "一键生成 PPT", description: "DOCX 内容提炼、页级大纲和演讲备注", defaultPrompt: "你是 PPT Master 的 Strategist。把 DOCX 材料转换为清晰、可编辑、适合答辩的中文 PPT 大纲，每页包含标题、3-5 个要点和演讲备注。" },
  { id: "projectPlan", label: "项目计划书编写", description: "问卷结构化、评分对齐和分章节计划书生成", defaultPrompt: "你是知策台项目计划书教练。通过动态追问把参赛想法转成结构化槽位，依据赛事评分要求暴露信息缺口和风险，再分章节生成带有【已生成】、【建议补充】、【AI推断，请核验】标记的计划书。不得编造赛事条款、市场规模或团队事实。" },
] as const;

export type AiFeatureId = (typeof AI_FEATURES)[number]["id"];

export type AiFeatureConfig = {
  provider: AiProvider;
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

type StoredConfig = Partial<Record<AiFeatureId, Partial<AiFeatureConfig>>>;

const configFile = path.join(process.cwd(), "data", "ai-config.json");

function envValue(name: string) {
  return process.env[name]?.trim() || "";
}

function envDefaults(): Partial<AiFeatureConfig> {
  return {
    provider: (envValue("AI_PROVIDER") as AiProvider) || "custom",
    enabled: true,
    apiKey: envValue("OPENAI_API_KEY"),
    baseUrl: envValue("OPENAI_BASE_URL"),
    model: envValue("OPENAI_MODEL") || "deepseek-chat",
  };
}

function isStoredConfig(value: unknown): value is StoredConfig {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readStoredConfig(): Promise<StoredConfig> {
  try {
    const raw = await fs.readFile(configFile, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isStoredConfig(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function featureMeta(featureId: AiFeatureId) {
  return AI_FEATURES.find((feature) => feature.id === featureId) ?? AI_FEATURES[0];
}

export async function getAiConfig(featureId: AiFeatureId): Promise<AiFeatureConfig> {
  const stored = await readStoredConfig();
  const feature = featureMeta(featureId);
  const environment = envDefaults();
  const saved = stored[featureId] ?? {};
  return {
    provider: saved.provider || environment.provider || "custom",
    enabled: saved.enabled ?? true,
    apiKey: saved.apiKey || environment.apiKey || "",
    baseUrl: saved.baseUrl ?? environment.baseUrl ?? "",
    model: saved.model || environment.model || "deepseek-chat",
    systemPrompt: saved.systemPrompt || feature.defaultPrompt,
    temperature: typeof saved.temperature === "number" ? saved.temperature : 0.3,
    maxTokens: typeof saved.maxTokens === "number" ? saved.maxTokens : 2400,
  };
}

export async function getAllAiConfigs() {
  const entries = await Promise.all(AI_FEATURES.map(async (feature) => [feature.id, await getAiConfig(feature.id)] as const));
  return Object.fromEntries(entries) as Record<AiFeatureId, AiFeatureConfig>;
}

export async function saveAiConfigPatch(featureId: AiFeatureId, patch: Partial<AiFeatureConfig>) {
  const stored = await readStoredConfig();
  const previous = stored[featureId] ?? {};
  const next: Partial<AiFeatureConfig> = { ...previous, ...patch };
  if (patch.apiKey === undefined) next.apiKey = previous.apiKey;
  stored[featureId] = next;
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify(stored, null, 2), "utf8");
  return getAiConfig(featureId);
}

export function maskApiKey(apiKey: string) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "••••••••";
  return `${apiKey.slice(0, 3)}••••••••${apiKey.slice(-4)}`;
}

export function publicConfig(featureId: AiFeatureId, config: AiFeatureConfig) {
  const meta = featureMeta(featureId);
  return {
    id: featureId,
    label: meta.label,
    description: meta.description,
    provider: config.provider,
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    model: config.model,
    systemPrompt: config.systemPrompt,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    hasApiKey: Boolean(config.apiKey),
    maskedApiKey: maskApiKey(config.apiKey),
    source: config.apiKey ? "configured" : "offline",
  };
}
