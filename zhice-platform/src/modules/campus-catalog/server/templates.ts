import "server-only";
import { readCatalog } from "./repository";
import { formalTemplate } from "../types";
import { builtinTemplateSchema } from "@/modules/ppt-generator/types";

export async function resolveRenderTemplate(templateId: string) {
  if (builtinTemplateSchema.safeParse(templateId).success) return { templateId, version: 1, source: "知策台平台原创布局", authorization: "平台自有配置；未使用获奖作品原始内容", config: undefined };
  const record = (await readCatalog()).templates.find((t) => t.templateId === templateId);
  if (!record || !formalTemplate(record)) throw new Error("模板来源或授权未确认、已过期或冲突；仅可参考，禁止作为正式生成模板。");
  return { templateId, version: record.version, source: `${record.data.sourceCompetition} · ${record.data.year} · ${record.data.sourceFile} · ${record.data.sourceUrl || "已上传文件哈希登记"}`, authorization: `${record.data.authorizationNote} · 依据：${record.data.authorizationSource}`, config: record.data.config };
}
