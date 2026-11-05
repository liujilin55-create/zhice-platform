import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateObject } from "ai";
import { createAiModel } from "@/lib/ai-model";
import { z } from "zod";
import { createDemoOutline, targetPagesFor } from "@/modules/ppt-generator/data";
import { MAX_DOCX_BYTES, parseDocx } from "@/modules/ppt-generator/parser";
import { resolveRenderTemplate } from "@/modules/campus-catalog/server/templates";
import { renderPptx } from "@/modules/ppt-generator/render";
import { pptHistoryEntrySchema, pptOutlineSchema, pptPageRangeSchema, pptTemplateSchema, planPptOptionsSchema, type ParsedDocx, type PptHistoryEntry, type PptOutline, type PptTemplate } from "@/modules/ppt-generator/types";
import { getAiConfig } from "@/lib/ai-config";
import { documentReferenceSchema } from "@/shared/contracts/plan-document";
import { bindingKey, competitionBindingSchema } from "@/shared/contracts/competition-binding";
import { PlanDocumentError } from "@/modules/project-plan/server/document-repository";
import { generatePlanPpt, inspectPlanPpt } from "@/modules/ppt-generator/server/plan-service";
import { buildPptMasterPlan, masterArtifactUrls, readMasterAsset, writePptMasterProject } from "@/modules/ppt-generator/server/ppt-master";

export const maxDuration = 60;

const storageDirectory = path.join(process.cwd(), "public", "generated-ppts");
const projectIdSchema = z.string().min(1).max(180).regex(/^[a-zA-Z0-9_-]+$/);
const projectDirectory = (projectId: string) => path.join(storageDirectory, "projects", projectId);
const historyFile = (projectId: string) => path.join(projectDirectory(projectId), "history.json");
const aiOutlineSchema = z.object({ title: z.string(), subtitle: z.string(), slides: z.array(z.object({ title: z.string(), bullets: z.array(z.string()), speakerNotes: z.string(), layout: z.enum(["cover", "agenda", "content", "section", "closing"]).optional() })) });

function errorResponse(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

async function readHistory(projectId: string) {
  try {
    const raw = await fs.readFile(historyFile(projectId), "utf8");
    return z.array(pptHistoryEntrySchema).parse(JSON.parse(raw));
  } catch {
    return [] as PptHistoryEntry[];
  }
}

async function writeHistory(projectId: string, entries: PptHistoryEntry[]) {
  await fs.mkdir(projectDirectory(projectId), { recursive: true });
  await fs.writeFile(historyFile(projectId), JSON.stringify(entries.slice(0, 20), null, 2), "utf8");
}

function safeFileStem(value: string) {
  return value.replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim().slice(0, 50) || "知策台项目汇报";
}

function normalizeOutline(raw: unknown, document: ParsedDocx, targetPages: number): PptOutline {
  const fallback = createDemoOutline(document, targetPages);
  const parsed = aiOutlineSchema.safeParse(raw);
  if (!parsed.success || parsed.data.slides.length < 5) return fallback;
  const slides: PptOutline["slides"] = parsed.data.slides.map((slide, index) => ({
    id: `slide-${index + 1}`,
    title: slide.title.trim() || fallback.slides[index % fallback.slides.length].title,
    bullets: slide.bullets.map((bullet) => bullet.trim()).filter(Boolean).slice(0, 5).length >= 1 ? slide.bullets.map((bullet) => bullet.trim()).filter(Boolean).slice(0, 5) : fallback.slides[index % fallback.slides.length].bullets,
    speakerNotes: slide.speakerNotes.trim() || fallback.slides[index % fallback.slides.length].speakerNotes,
    layout: index === 0 ? "cover" as const : index === targetPages - 1 ? "closing" as const : slide.layout || "content" as const,
  }));
  while (slides.length < targetPages) slides.push({ ...fallback.slides[slides.length % fallback.slides.length], id: `slide-${slides.length + 1}` });
  return pptOutlineSchema.parse({ title: parsed.data.title.trim() || fallback.title, subtitle: parsed.data.subtitle.trim() || fallback.subtitle, slides: slides.slice(0, Math.max(8, Math.min(15, targetPages))) });
}

async function generateAiOutline(document: ParsedDocx, targetPages: number, template: PptTemplate, style: string) {
  const aiConfig = await getAiConfig("pptGenerator");
  if (!aiConfig.enabled || !aiConfig.apiKey || !aiConfig.baseUrl || !aiConfig.model) return null;
  const prompt = `你是 PPT Master 的 Strategist。请把下面的 DOCX 内容设计成一份 16:9 中文项目汇报 PPT 大纲。目标页数约 ${targetPages} 页，模板风格为 ${template}，内容组织风格为 ${style}。每页必须有一个清晰标题、3-5 个短要点和演讲备注；按“问题—用户—方案—技术—AI 工作流—体验—评分点—价值—计划—总结”组织信息。不要把长段落直接塞进页面，不确定的信息标记为待核实。\n\n文档标题：${document.title}\n标题层级：${document.headings.map((item) => `${"  ".repeat(item.level - 1)}${item.text}`).join("\n")}\n段落：${document.paragraphs.join("\n").slice(0, 18000)}\n表格：${JSON.stringify(document.tables).slice(0, 6000)}\n图片数量：${document.imageCount}`;
  const result = await generateObject({ model: createAiModel(aiConfig), schema: aiOutlineSchema, prompt: `${aiConfig.systemPrompt}\n\n${prompt}`, temperature: aiConfig.temperature, maxOutputTokens: aiConfig.maxTokens });
  return result.object;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("file");
  const parsedProject = projectIdSchema.safeParse(params.get("projectId"));
  if (!parsedProject.success) return id ? errorResponse("请提供备赛项目标识。", 400) : Response.json({ history: [] });
  const projectId = parsedProject.data;
  const masterId = params.get("master");
  if (masterId) {
    const asset = params.get("asset");
    if (asset !== "manifest" && asset !== "design-spec" && asset !== "notes") return errorResponse("无效的 PPT Master 产物类型。", 400);
    try {
      const content = await readMasterAsset(projectId, masterId, asset);
      const type = asset === "manifest" ? "application/json" : "text/markdown; charset=utf-8";
      return new Response(new Uint8Array(content), { headers: { "Content-Type": type, "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset === "manifest" ? "manifest.json" : asset === "design-spec" ? "设计规范与内容大纲.md" : "total.md")}`, "Cache-Control": "private, max-age=3600" } });
    } catch (error) { return errorResponse(error instanceof Error ? error.message : "PPT Master 产物不存在。", 404); }
  }
  if (!id) return Response.json({ history: (await readHistory(projectId)).filter((entry) => !params.get("scope") || entry.bindingKey === params.get("scope")) });
  if (!/^[a-zA-Z0-9-]+$/.test(id)) return errorResponse("无效的文件标识。", 400);
  try {
    const buffer = await fs.readFile(path.join(projectDirectory(projectId), `${id}.pptx`));
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${id}.pptx`)}`, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return errorResponse("PPT 文件不存在或已被清理。", 404);
  }
}

export async function POST(request: Request) {
  try {
    const action = request.headers.get("content-type")?.includes("multipart/form-data") ? "analyze" : "render";
    if (action === "analyze") {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!projectIdSchema.safeParse(formData.get("projectId")).success) return errorResponse("请先创建备赛项目。");
      const pageRangeResult = pptPageRangeSchema.safeParse(String(formData.get("pageRange") || "8-10"));
      const templateResult = pptTemplateSchema.safeParse(String(formData.get("template") || "zhice-dark"));
      if (!(file instanceof File)) return errorResponse("请先上传 .docx 文件。");
      if (!pageRangeResult.success || !templateResult.success) return errorResponse("页数范围或模板参数无效。");
      if (file.size > MAX_DOCX_BYTES) return errorResponse("DOCX 文件大小不能超过 15 MB。");
      const document = await parseDocx(file);
      const targetPages = targetPagesFor(pageRangeResult.data);
      const style = String(formData.get("style") || "evidence");
      const warnings: string[] = [];
      if (document.paragraphs.length > 80 || document.textPreview.length > 15000) warnings.push("文档内容较长，已按页数范围提炼重点；建议在大纲中人工补充关键数据。");
      let outline = createDemoOutline(document, targetPages);
      let mode: "ai" | "demo" = "demo";
      const aiConfig = await getAiConfig("pptGenerator");
      if (aiConfig.enabled && aiConfig.apiKey && aiConfig.baseUrl && aiConfig.model) {
        try {
          const aiOutline = await generateAiOutline(document, targetPages, templateResult.data, style);
          if (aiOutline) { outline = normalizeOutline(aiOutline, document, targetPages); mode = "ai"; }
        } catch {
          warnings.push("大模型大纲生成暂时不可用，已切换到本地大纲；可以继续编辑并生成 PPT。");
        }
      } else {
        warnings.push("当前为离线演示模式。请在管理后台为“一键生成 PPT”配置国内模型 API 后生成更精确的大纲。");
      }
      outline.master = buildPptMasterPlan(outline, { sourceKind: "docx", sourceName: document.fileName, template: templateResult.data, style: optionsFromStyle(style) });
      return Response.json({ ok: true, mode, document, outline, warnings });
    }

    const body = await request.json() as { action?: string; outline?: unknown; template?: string; sourceName?: string; projectId?: string; reference?: unknown; options?: unknown; humanConfirmed?: boolean; binding?: unknown };
    const parsedProject = projectIdSchema.safeParse(body.projectId);
    if (!parsedProject.success) return errorResponse("请先创建备赛项目。");
    const projectId = parsedProject.data;
    if (body.action === "analyzePlan") {
      const reference = documentReferenceSchema.parse(body.reference); const options = planPptOptionsSchema.parse(body.options || {}); const template = pptTemplateSchema.parse(body.template || "zhice-dark");
      return Response.json(await generatePlanPpt(projectId, reference, options, AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]), template));
    }
    if (body.action !== "render" && body.action !== "check") return errorResponse("无效的 PPT 操作。");
    const outlineResult = pptOutlineSchema.safeParse(body.outline);
    const templateResult = pptTemplateSchema.safeParse(body.template || "zhice-dark");
    if (!outlineResult.success) return errorResponse("大纲格式无效，请检查每页标题和要点。");
    if (!templateResult.success) return errorResponse("模板参数无效。");
    if (outlineResult.data.slides.length > 15) return errorResponse("页数最多 15 页，请先精简大纲。");
    let outline = outlineResult.data;
    const reference = documentReferenceSchema.optional().parse(body.reference || outline.planSource);
    const owner = reference?.binding || competitionBindingSchema.optional().parse(body.binding);
    if (owner && owner.projectId !== projectId) return errorResponse("比赛绑定与当前项目不一致。");
    let checks: Awaited<ReturnType<typeof inspectPlanPpt>>["checks"] = [];
    if (reference) {
      const inspected = await inspectPlanPpt(projectId, reference, outline); outline = inspected.outline; checks = inspected.checks;
    }
    if (body.action === "check") return Response.json({ ok: true, outline, checks });
    if (body.humanConfirmed !== true) return errorResponse("请先完成 Human Gate，人工确认大纲后再生成 PPTX。", 409);
    if (checks.some((check) => check.severity === "error")) return Response.json({ error: "一致性检查未通过，请修正错误或明确标注待核验。", checks }, { status: 409 });
    const id = randomUUID();
    const fileName = `${safeFileStem(outlineResult.data.title)}-${id.slice(0, 8)}.pptx`;
    const selectedTemplate = await resolveRenderTemplate(templateResult.data);
    const buffer = await renderPptx(outline, templateResult.data, selectedTemplate.config);
    await resolveRenderTemplate(templateResult.data);
    if (reference) await inspectPlanPpt(projectId, reference, outline);
    const sourceMarkdown = reference
      ? `# ${outline.title}\n\n来源：当前项目已确认计划书\n\n${outline.slides.map((slide, index) => `## ${index + 1}. ${slide.title}\n${slide.bullets.map((bullet) => `- ${bullet}`).join("\n")}`).join("\n\n")}`
      : `# ${outline.title}\n\n来源：${String(body.sourceName || "外部 DOCX")}\n\n${outline.slides.map((slide, index) => `## ${index + 1}. ${slide.title}\n${slide.bullets.map((bullet) => `- ${bullet}`).join("\n")}`).join("\n\n")}`;
    const master = await writePptMasterProject({ projectId, outline, sourceName: String(body.sourceName || "外部 DOCX"), sourceMarkdown, sourceKind: reference ? "plan" : "docx", template: templateResult.data, designConfig: selectedTemplate.config });
    await fs.mkdir(projectDirectory(projectId), { recursive: true });
    await fs.writeFile(path.join(projectDirectory(projectId), `${id}.pptx`), buffer);
    const urls = masterArtifactUrls(projectId, master.artifactId);
    const history: PptHistoryEntry = pptHistoryEntrySchema.parse({ id, fileName, sourceName: String(body.sourceName || "未知 DOCX"), template: templateResult.data, templateId: selectedTemplate.templateId, templateVersion: selectedTemplate.version, templateSource: selectedTemplate.source, templateAuthorization: selectedTemplate.authorization, masterArtifactId: master.artifactId, masterManifestUrl: urls.manifest, masterDesignSpecUrl: urls.designSpec, masterNotesUrl: urls.notes, slideCount: outline.slides.length, createdAt: new Date().toISOString(), projectId, ...(owner ? { bindingKey: bindingKey(owner) } : {}), ...(reference ? { planSource: reference, sourceKind: "plan" } : { sourceKind: "docx" }), downloadUrl: `/api/ppt?projectId=${encodeURIComponent(projectId)}&file=${id}` });
    await writeHistory(projectId, [history, ...(await readHistory(projectId)).filter((item) => item.id !== id)]);
    return Response.json({ ok: true, history, warnings: checks.filter((check) => check.severity === "warning").map((check) => check.message) });
  } catch (error) {
    if (error instanceof PlanDocumentError) return errorResponse(error.message, error.status);
    if (error instanceof z.ZodError) return errorResponse("参数或文档来源无效，请重新选择当前计划书。");
    const message = error instanceof Error ? error.message : "PPT 生成失败，请重试。";
    const clientError = message.includes("仅支持") || message.includes("不能超过") || message.includes("无效") || message.includes("禁止作为正式") || message.includes("请先上传");
    return errorResponse(message, clientError ? 400 : 500);
  }
}

function optionsFromStyle(style: string): "story" | "technical" | "evidence" {
  return style === "story" || style === "technical" ? style : "evidence";
}
