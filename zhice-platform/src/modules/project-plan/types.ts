import { z } from "zod";
import { competitionBindingSchema, requirementSourceSchema, scoringClauseSchema, verificationStatusSchema } from "@/shared/contracts/competition-binding";
import { studentProfileSchema } from "@/modules/workspace/types";
import { preparationSchema, type Preparation } from "@/shared/contracts/preparation";
export const planWorkspaceSchema = z.object({ binding: competitionBindingSchema, studentProfile: studentProfileSchema, preparation: preparationSchema.optional(), selectionConfirmedAt: z.string().nullable(), reportId: z.string().nullable(), intent: z.enum(["draft", "formal"]).default("draft") });
export type PlanWorkspace = z.infer<typeof planWorkspaceSchema>;

export const planSlotIdSchema = z.enum([
  "oneLineDescription", "targetPain", "differentiation", "technicalRoute", "team", "progress", "goal",
]);
export type PlanSlotId = z.infer<typeof planSlotIdSchema>;
export const planSlotSchema = z.object({
  id: planSlotIdSchema, label: z.string(), priority: z.enum(["P0", "P1", "P2"]), value: z.string().nullable(),
  status: z.enum(["empty", "captured", "needsVerification"]),
});
export const planSlotMapSchema = z.object({
  oneLineDescription: planSlotSchema, targetPain: planSlotSchema, differentiation: planSlotSchema,
  technicalRoute: planSlotSchema, team: planSlotSchema, progress: planSlotSchema, goal: planSlotSchema,
});
export type PlanSlot = z.infer<typeof planSlotSchema>;
export type PlanSlotMap = z.infer<typeof planSlotMapSchema>;

export const planMessageSchema = z.object({ id: z.string(), role: z.enum(["user", "assistant"]), content: z.string(), createdAt: z.string() });
export type PlanMessage = z.infer<typeof planMessageSchema>;
export const surveySessionSchema = z.object({
  binding: competitionBindingSchema.optional(),
  id: z.string(), messages: z.array(planMessageSchema), slots: planSlotMapSchema,
  currentSlot: planSlotIdSchema.nullable(), complete: z.boolean(), updatedAt: z.string(), mode: z.enum(["ai", "local"]),
});
export type SurveySession = z.infer<typeof surveySessionSchema>;

export const capturedSlotSchema = z.object({ slot: planSlotIdSchema, value: z.string() }).nullable();
export const surveyTurnSchema = z.object({
  reply_to_user: z.string(), current_slot: planSlotIdSchema.nullable(), captured: capturedSlotSchema,
  survey_complete: z.boolean(), mode: z.enum(["ai", "local"]),
});
export type SurveyTurn = z.infer<typeof surveyTurnSchema>;

export const completenessItemSchema = z.object({ dimension: z.string(), status: z.enum(["sufficient", "partial", "missing"]), detail: z.string(), nextAction: z.string() });
export const alignmentItemSchema = z.object({ criterion: z.string(), coverage: z.enum(["covered", "partial", "missing"]), detail: z.string(), missing: z.string(), action: z.string(), criterionId: z.string().optional(), sourceId: z.string().optional(), sourceUrl: z.string().url().nullable().optional(), sourceQuote: z.string().optional(), verificationStatus: verificationStatusSchema.optional() });
export const riskItemSchema = z.object({ question: z.string(), suggestion: z.string() });
export const chapterReadinessSchema = z.object({ id: z.string(), title: z.string(), status: z.enum(["ready", "partial", "blocked"]), reason: z.string() });
export const planReportSchema = z.object({
  binding: competitionBindingSchema.optional(), projectId: z.string().optional(), competitionId: z.string().optional(), reportId: z.string().optional(), requirementsReportId: z.string().nullable().optional(),
  verificationStatus: verificationStatusSchema.default("pending"), generationStatus: z.enum(["draft", "formal"]).default("draft"), sources: z.array(requirementSourceSchema).default([]),
  completeness: z.array(completenessItemSchema), alignment: z.array(alignmentItemSchema), risks: z.array(riskItemSchema),
  chapters: z.array(chapterReadinessSchema), summary: z.string(), mode: z.enum(["ai", "local"]), createdAt: z.string(),
});
export type PlanReport = z.infer<typeof planReportSchema>;

export const planChapterSchema = z.object({
  binding: competitionBindingSchema.optional(), generationStatus: z.enum(["draft", "formal"]).default("draft"), sourceIds: z.array(z.string()).default([]),
  id: z.string(), title: z.string(), status: z.enum(["draft", "confirmed", "partial", "blocked"]), content: z.string(),
  mode: z.enum(["ai", "local"]).optional(), updatedAt: z.string(), evidenceIds: z.array(z.string()).optional(),
});
export type PlanChapter = z.infer<typeof planChapterSchema>;

export const planContextEvidenceSchema = z.object({ id: z.string(), title: z.string(), source: z.string(), excerpt: z.string(), kind: z.string(), href: z.string() });
export const planContextSchema = z.object({
  preparation: preparationSchema.optional(),
  binding: competitionBindingSchema.nullable().default(null), competitionName: z.string().default("尚未选择比赛"), trackName: z.string().default("尚未选择赛道"), studentProfile: studentProfileSchema.nullable().default(null),
  verificationStatus: verificationStatusSchema.default("pending"), sources: z.array(requirementSourceSchema).default([]),
  canGenerateFormal: z.boolean().default(false), blockers: z.array(z.string()).default([]), warnings: z.array(z.string()).default([]),
  reportId: z.string().nullable(), title: z.string(), mode: z.enum(["ai", "demo", "sample"]).nullable(),
  criteria: z.array(scoringClauseSchema), evidence: z.array(planContextEvidenceSchema),
});
export type PlanContext = z.infer<typeof planContextSchema>;

export const planEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), mode: z.enum(["ai", "local"]) }),
  z.object({ type: z.literal("survey_partial"), reply: z.string(), currentSlot: planSlotIdSchema.nullable(), captured: capturedSlotSchema, complete: z.boolean() }),
  z.object({ type: z.literal("survey"), turn: surveyTurnSchema, session: surveySessionSchema }),
  z.object({ type: z.literal("report_partial"), report: z.record(z.string(), z.unknown()) }),
  z.object({ type: z.literal("report"), report: planReportSchema }),
  z.object({ type: z.literal("chapter_delta"), chapterId: z.string(), text: z.string() }),
  z.object({ type: z.literal("chapter"), chapter: planChapterSchema }),
  z.object({ type: z.literal("replace"), scope: z.enum(["survey", "report", "chapter"]), message: z.string() }),
  z.object({ type: z.literal("heartbeat") }),
  z.object({ type: z.literal("complete") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type PlanEvent = z.infer<typeof planEventSchema>;

export const planExportResponseSchema = z.object({ ok: z.literal(true), format: z.enum(["markdown", "docx"]), filename: z.string(), content: z.string(), encoding: z.enum(["utf8", "base64"]).default("utf8") });

export const PLAN_SLOTS: Array<Pick<PlanSlot, "id" | "label" | "priority">> = [
  { id: "oneLineDescription", label: "项目一句话描述", priority: "P0" },
  { id: "targetPain", label: "目标用户与痛点", priority: "P0" },
  { id: "differentiation", label: "核心差异化", priority: "P0" },
  { id: "technicalRoute", label: "技术路线概要", priority: "P1" },
  { id: "team", label: "团队构成与分工", priority: "P1" },
  { id: "progress", label: "当前进展与资源", priority: "P2" },
  { id: "goal", label: "参赛目标", priority: "P2" },
];
export const PLAN_CHAPTERS = [
  { id: "executive-summary", title: "执行总结" }, { id: "project-intro", title: "项目介绍" },
  { id: "market-analysis", title: "市场分析" }, { id: "product-design", title: "产品与用户" },
  { id: "technical-route", title: "技术路线" }, { id: "team", title: "团队与分工" },
  { id: "business-model", title: "商业模式" }, { id: "finance", title: "财务预测" },
  { id: "risk-response", title: "风险应对" }, { id: "conclusion", title: "结语与参赛目标" },
] as const;

export function preparationChapters(preparation?: Preparation) {
  const titles: Record<string, string> = { "executive-summary": "项目摘要", "project-intro": "产业问题与项目背景", "market-analysis": "需求调研与应用场景", "product-design": "材料与产品方案", "technical-route": "工艺路线与性能验证", team: "团队分工与资源条件", "business-model": "应用路径与产业价值", finance: "预算与成本测算", "risk-response": "风险与验证缺口", conclusion: "参赛目标与材料准备" };
  return PLAN_CHAPTERS.map((chapter) => ({ ...chapter, title: preparation?.topicId ? titles[chapter.id] : chapter.title }));
}

export function emptyPlanSlots(): PlanSlotMap {
  return Object.fromEntries(PLAN_SLOTS.map((slot) => [slot.id, { ...slot, value: null, status: "empty" }])) as PlanSlotMap;
}
export function emptySurveySession(): SurveySession {
  return { id: crypto.randomUUID(), messages: [], slots: emptyPlanSlots(), currentSlot: "oneLineDescription", complete: false, updatedAt: new Date().toISOString(), mode: "local" };
}
