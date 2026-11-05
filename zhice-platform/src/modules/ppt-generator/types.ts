import { z } from "zod";
import { documentReferenceSchema } from "@/shared/contracts/plan-document";

export const pptCheckSchema = z.object({ code: z.string(), severity: z.enum(["error", "warning"]), message: z.string(), slideId: z.string().optional() });
export type PptCheck = z.infer<typeof pptCheckSchema>;
export const slideClaimSchema = z.object({ text: z.string(), origin: z.enum(["user", "ai", "pending"]), confirmed: z.boolean(), blockIds: z.array(z.string()), chapterIds: z.array(z.string()), evidenceIds: z.array(z.string()), sourceIds: z.array(z.string()).optional() });

export const builtinTemplateSchema = z.enum(["zhice-dark", "contest", "tech-blue", "minimal"]);
export const pptTemplateSchema = z.union([builtinTemplateSchema, z.string().regex(/^tpl-[a-f0-9-]{36}$/)]);
export const pptPageRangeSchema = z.enum(["8-10", "11-13", "14-15"]);

export const pptSlideSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  bullets: z.array(z.string().min(1).max(240)).min(1).max(5),
  speakerNotes: z.string().max(1200),
  layout: z.enum(["cover", "agenda", "content", "section", "closing", "problem", "data", "solution", "process", "architecture", "business", "team", "plan"]).default("content"),
  topicIds: z.array(z.string()).optional(), chapterIds: z.array(z.string()).optional(), evidenceIds: z.array(z.string()).optional(), sourceIds: z.array(z.string()).optional(), claims: z.array(slideClaimSchema).optional(),
});

export const pptMasterPlanSchema = z.object({
  workflow: z.literal("ppt-master"),
  canvas: z.object({ format: z.literal("ppt169"), width: z.literal(1280), height: z.literal(720) }),
  strategist: z.literal("材料 → 设计规范与页级大纲"),
  executor: z.literal("页级 SVG 产物 + 原生文字形状 → 可编辑 PPTX"),
  style: z.enum(["通用灵活", "一般咨询", "顶级咨询"]),
  sourceKind: z.enum(["plan", "docx"]),
  sourceName: z.string().max(240),
  artifactId: z.string().regex(/^master-[a-f0-9-]{36}$/).optional(),
  artifactUrls: z.object({ manifest: z.string(), designSpec: z.string(), notes: z.string() }).optional(),
  design: z.object({
    palette: z.array(z.string()).min(3).max(6),
    headingFont: z.string().min(1).max(80),
    bodyFont: z.string().min(1).max(80),
    bodySizePx: z.number().int().min(14).max(24),
    iconPolicy: z.literal("平台自绘基础图形"),
    imagePolicy: z.literal("无图片时保留占位策略"),
    notesStyle: z.literal("按页讲稿，统一写入演讲者备注"),
  }),
});
export type PptMasterPlan = z.infer<typeof pptMasterPlanSchema>;

export const pptOutlineSchema = z.object({
  title: z.string().min(1).max(160),
  subtitle: z.string().max(240),
  slides: z.array(pptSlideSchema).min(5).max(20),
  planSource: documentReferenceSchema.optional(),
  reviewWarnings: z.array(z.string()).optional(),
  master: pptMasterPlanSchema.optional(),
});

export const parsedDocxSchema = z.object({
  fileName: z.string(),
  size: z.number(),
  title: z.string(),
  headings: z.array(z.object({ level: z.number(), text: z.string() })),
  paragraphs: z.array(z.string()),
  tables: z.array(z.object({ headers: z.array(z.string()), rows: z.array(z.array(z.string())) })),
  imageCount: z.number(),
  textPreview: z.string(),
});

export const pptHistoryEntrySchema = z.object({
  projectId: z.string().optional(),
  id: z.string(),
  fileName: z.string(),
  sourceName: z.string(),
  template: pptTemplateSchema,
  templateId: z.string().optional(), templateVersion: z.number().optional(), templateSource: z.string().optional(), templateAuthorization: z.string().optional(),
  masterArtifactId: z.string().regex(/^master-[a-f0-9-]{36}$/).optional(), masterManifestUrl: z.string().optional(), masterDesignSpecUrl: z.string().optional(), masterNotesUrl: z.string().optional(),
  slideCount: z.number(),
  createdAt: z.string(),
  downloadUrl: z.string(),
  bindingKey: z.string().optional(), planSource: documentReferenceSchema.optional(), sourceKind: z.enum(["plan", "docx"]).optional(),
});

export const pptAnalyzeResponseSchema = z.object({
  ok: z.literal(true),
  mode: z.enum(["ai", "demo"]),
  document: parsedDocxSchema,
  outline: pptOutlineSchema,
  warnings: z.array(z.string()),
});

export const pptRenderResponseSchema = z.object({
  ok: z.literal(true),
  history: pptHistoryEntrySchema,
  warnings: z.array(z.string()),
});

export type PptTemplate = z.infer<typeof pptTemplateSchema>;
export type PptPageRange = z.infer<typeof pptPageRangeSchema>;
export type PptSlide = z.infer<typeof pptSlideSchema>;
export type PptOutline = z.infer<typeof pptOutlineSchema>;
export type ParsedDocx = z.infer<typeof parsedDocxSchema>;
export type PptHistoryEntry = z.infer<typeof pptHistoryEntrySchema>;
export type PptAnalyzeResponse = z.infer<typeof pptAnalyzeResponseSchema>;
export type PptRenderResponse = z.infer<typeof pptRenderResponseSchema>;
export const planPptOptionsSchema = z.object({ durationMinutes: z.number().int().min(3).max(30).default(8), pages: z.number().int().min(8).max(15).default(12), focus: z.enum(["technical", "evidence", "story"]).default("evidence") });
export type PlanPptOptions = z.infer<typeof planPptOptionsSchema>;
export const planPptResponseSchema = z.object({ ok: z.literal(true), mode: z.enum(["ai", "local"]), outline: pptOutlineSchema, warnings: z.array(z.string()), checks: z.array(pptCheckSchema) });
