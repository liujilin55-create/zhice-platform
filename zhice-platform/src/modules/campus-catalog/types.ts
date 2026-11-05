import { z } from "zod";

export const reviewStatusSchema = z.enum(["pending", "verified", "expired", "conflict"]);
export const reviewLabels = { pending: "待核验", verified: "已确认", expired: "已过期", conflict: "来源冲突" } as const;
export const knownValue = (s: string | null | undefined) => Boolean(s?.trim() && !/待核验|待补充|未知|不详|unknown/i.test(s));
const text = z.string().trim().max(2000);
const list = z.array(z.string().trim().min(1).max(200)).max(100).default([]);
const url = z.string().url().refine((s) => /^https?:\/\//i.test(s), "链接必须为 HTTP(S)").nullable().default(null);
export const directoryInputSchema = z.object({
  name: text.min(1), academicYear: z.union([z.literal("待核验"), z.string().regex(/^\d{4}-\d{4}$/, "学年度格式为 2026-2027")]),
  externalLevel: text.nullable().default(null), campusRecognitionLevel: text.nullable().default(null),
  colleges: list, majors: list, grades: list, tracks: list,
  campusRegistration: text.nullable().default(null), campusDeadline: z.string().datetime({ offset: true }).nullable().default(null),
  officialUrl: url, campusUrl: url, sourceFile: text.nullable().default(null), sourcePage: z.number().int().positive().nullable().default(null),
  sourceText: z.string().max(60000).default(""), organizer: text.nullable().default(null), supervisingDepartment: text.nullable().default(null), affiliatedDepartment: text.nullable().default(null), frequencyNote: text.nullable().default(null),
  keywords: list, skills: list, resources: list, mentors: list, goals: list,
  teamMin: z.number().int().positive().nullable().default(null), teamMax: z.number().int().positive().nullable().default(null),
  weeklyHours: z.number().nonnegative().nullable().default(null), budget: z.number().nonnegative().nullable().default(null),
  submissionMaterials: list,
}).refine((v) => v.academicYear === "待核验" || Number(v.academicYear.slice(5)) === Number(v.academicYear.slice(0, 4)) + 1, "学年度必须连续")
  .refine((v) => v.teamMin == null || v.teamMax == null || v.teamMin <= v.teamMax, "人数上下限冲突");
export type DirectoryInput = z.infer<typeof directoryInputSchema>;
export const reviewSchema = z.object({
  target: z.enum(["competition", "recognition", "officialLink", "provenance", "rights"]),
  status: reviewStatusSchema, note: z.string().trim().min(5).max(2000), at: z.string(),
});
export const directoryRecordSchema = z.object({
  id: z.string(), editionId: z.string(), version: z.number(), importedAt: z.string(),
  data: directoryInputSchema, verificationStatus: reviewStatusSchema, lastVerified: z.string().nullable(),
  reviews: z.array(reviewSchema),
});
export type DirectoryRecord = z.infer<typeof directoryRecordSchema>;
export const pageKinds = ["cover", "agenda", "problem", "data", "solution", "process", "architecture", "business", "team", "plan", "closing"] as const;
export const layoutRuleSchema = z.object({ kind: z.enum(pageKinds), arrangement: z.enum(["title", "list", "columns", "steps", "chart"]), titleSize: z.number().min(20).max(40), bodySize: z.number().min(12).max(24) });
export const visualConfigSchema = z.object({
  colors: z.object({ background: z.string().regex(/^[\dA-Fa-f]{6}$/), surface: z.string().regex(/^[\dA-Fa-f]{6}$/), accent: z.string().regex(/^[\dA-Fa-f]{6}$/), text: z.string().regex(/^[\dA-Fa-f]{6}$/), muted: z.string().regex(/^[\dA-Fa-f]{6}$/) }),
  fonts: z.object({ heading: z.string().min(1).max(80), body: z.string().min(1).max(80) }),
  layouts: z.array(layoutRuleSchema).length(11).refine((v) => new Set(v.map((r) => r.kind)).size === 11, "必须提供全部 11 种页面布局"),
  chartStyle: z.enum(["bar", "line"]), coverLayout: z.enum(["left", "center"]), closingLayout: z.enum(["left", "center"]),
});
export const templateInputSchema = z.object({
  name: text.min(1), sourceCompetition: text.min(1), competitionId: z.string().nullable().default(null), year: z.number().int().min(2000).max(2100), tracks: list,
  sourceFile: text.min(1), sourceUrl: url, sourcePage: z.number().int().positive().nullable().default(null),
  usageRights: z.enum(["unknown", "reference_only", "derivation_allowed", "owned"]), authorizationNote: text.min(1), authorizationSource: text.nullable().default(null),
  type: text.min(1), scenarios: list, config: visualConfigSchema,
});
export const templateRecordSchema = z.object({
  templateId: z.string(), version: z.number(), importedAt: z.string(), data: templateInputSchema,
  sourceHash: z.string().nullable(), extraction: z.object({ slideCount: z.number(), method: z.string() }).nullable(),
  preview: z.object({ kind: z.literal("platform-vector"), pageKinds: z.array(z.enum(pageKinds)), description: z.string() }).default({ kind: "platform-vector", pageKinds: [...pageKinds], description: "平台自绘版式预览，不含原作品内容" }),
  verificationStatus: reviewStatusSchema, lastVerified: z.string().nullable(), reviews: z.array(reviewSchema),
});
export type TemplateRecord = z.infer<typeof templateRecordSchema>;
export type VisualConfig = z.infer<typeof visualConfigSchema>;
export const catalogDatabaseSchema = z.object({ revision: z.number(), records: z.array(directoryRecordSchema), templates: z.array(templateRecordSchema) });
export const directoryPreviewSchema = z.object({ token: z.string(), revision: z.number(), rows: z.array(z.object({ row: z.number(), action: z.enum(["add", "version", "skip"]), data: directoryInputSchema, warnings: z.array(z.string()) })), warnings: z.array(z.string()) });
export type DirectoryPreview = z.infer<typeof directoryPreviewSchema>;
export function latestReview(reviews: z.infer<typeof reviewSchema>[], target: z.infer<typeof reviewSchema>["target"]) { return reviews.filter((r) => r.target === target).at(-1); }
export function formalTemplate(record: TemplateRecord) {
  return record.verificationStatus === "verified" && latestReview(record.reviews, "provenance")?.status === "verified" && latestReview(record.reviews, "rights")?.status === "verified"
    && ["derivation_allowed", "owned"].includes(record.data.usageRights) && Boolean(record.data.authorizationSource)
    && Boolean(record.data.sourceUrl || record.sourceHash);
}
export const defaultVisualConfig: VisualConfig = {
  colors: { background: "18213A", surface: "243152", accent: "818CF8", text: "F8FAFC", muted: "CBD5E1" }, fonts: { heading: "Aptos", body: "Aptos" },
  layouts: pageKinds.map((kind) => ({ kind, arrangement: kind === "cover" || kind === "closing" ? "title" : kind === "data" ? "chart" : kind === "process" || kind === "plan" ? "steps" : kind === "architecture" || kind === "business" || kind === "team" ? "columns" : "list", titleSize: 28, bodySize: 17 })),
  chartStyle: "bar", coverLayout: "left", closingLayout: "center",
};
