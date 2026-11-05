import { z } from "zod";
import { competitionBindingSchema, requirementSourceSchema, scoringClauseSchema } from "./competition-binding";

export const planBlockSchema = z.object({
  id: z.string(), text: z.string().max(20000), origin: z.enum(["user", "ai"]),
  marker: z.enum(["generated", "supplement", "inference"]), confirmed: z.boolean(),
  evidenceIds: z.array(z.string()), sourceIds: z.array(z.string()),
});
export const documentChapterSchema = z.object({
  id: z.string(), title: z.string(), aiContent: z.string(), userContent: z.string().nullable(),
  blocks: z.array(planBlockSchema), confirmed: z.boolean(), updatedAt: z.string(),
});
export const planDocumentSchema = z.object({
  documentId: z.string().min(1).max(180), binding: competitionBindingSchema,
  projectName: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(160),
  chapters: z.array(documentChapterSchema).max(30), version: z.number().int().positive(),
  confirmed: z.boolean(), updatedAt: z.string(),
  sources: z.array(requirementSourceSchema), scoringRequirements: z.array(scoringClauseSchema),
  preparationKey: z.string().nullable().optional(),
});
export const documentReferenceSchema = z.object({ documentId: z.string(), version: z.number().int().positive(), contentHash: z.string(), binding: competitionBindingSchema });
export type PlanBlock = z.infer<typeof planBlockSchema>;
export type DocumentChapter = z.infer<typeof documentChapterSchema>;
export type PlanDocument = z.infer<typeof planDocumentSchema>;
export type DocumentReference = z.infer<typeof documentReferenceSchema>;
export const contentMarkerLabels = { generated: "已生成", supplement: "建议补充", inference: "AI 推断，请核验" } as const;

export function documentText(chapter: DocumentChapter) { return chapter.userContent ?? chapter.aiContent; }
export function confirmedBlocks(document: PlanDocument) { return document.chapters.filter((chapter) => chapter.confirmed).flatMap((chapter) => chapter.blocks.filter((block) => block.confirmed && block.marker !== "supplement" && block.text.trim()).map((block) => ({ ...block, chapterId: chapter.id, chapterTitle: chapter.title }))); }

export function parseContentBlocks(text: string, origin: "user" | "ai", evidenceIds: string[], sourceIds: string[], previous: PlanBlock[] = []): PlanBlock[] {
  let marker: PlanBlock["marker"] = "generated";
  return text.split("【评分原文与来源】")[0].split(/\n+/).flatMap((line) => {
    const raw = line.trim(); if (!raw) return [];
    if (/【建议补充】/.test(raw)) marker = "supplement";
    else if (/【AI\s*推断[，,]?\s*请核验】/.test(raw)) marker = "inference";
    else if (/【已生成】/.test(raw)) marker = "generated";
    const value = raw.replace(/【(?:已生成|建议补充|AI\s*推断[，,]?\s*请核验)】/g, "").trim();
    if (!value) return [];
    const blockMarker = /_{2,}|待补充|待填写|待填/.test(value) ? "supplement" as const : marker;
    const existing = previous.find((block) => block.text === value && block.marker === blockMarker);
    return [{ id: existing?.id || crypto.randomUUID(), text: value, marker: blockMarker, origin: existing?.origin || origin, confirmed: false, evidenceIds: existing?.evidenceIds || evidenceIds, sourceIds: existing?.sourceIds || sourceIds }];
  });
}
