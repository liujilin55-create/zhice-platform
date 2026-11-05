import { z } from "zod";
import { analysisBindingSchema, requirementSourceSchema, scoringClauseSchema } from "@/shared/contracts/competition-binding";

export const evidenceKindSchema = z.enum(["academicPaper", "competitionRule", "caseStudy"]);
export const evidenceStatusSchema = z.enum(["confirmed", "pending", "deprecated"]);
export const evidenceKindFilterSchema = z.enum(["all", ...evidenceKindSchema.options]);
export const evidenceCitationSchema = z.object({
  id: z.string(),
  targetType: z.enum(["guidanceReport", "projectOverview", "task"]),
  targetTitle: z.string(),
  section: z.string(),
  excerpt: z.string(),
  href: z.string(),
  verification: z.enum(["confirmed", "pending"]),
});
export const ruleEvidenceItemSchema = z.object({
  label: z.string(), text: z.string(), page: z.string(), scoreWeight: z.string().optional(),
});
export const evidenceRecordSchema = z.object({
  id: z.string(),
  kind: evidenceKindSchema,
  title: z.string(),
  source: z.string(),
  sourceUrl: z.string().url().optional(),
  sourceMode: z.enum(["sample", "external", "upload"]),
  occurredAt: z.string(),
  cachedAt: z.string(),
  pageRef: z.string().optional(),
  tags: z.array(z.string()),
  status: evidenceStatusSchema,
  cacheState: z.enum(["live", "cached", "unavailable"]),
  relevance: z.number().min(0).max(1),
  excerpt: z.string(), body: z.string(),
  highlightedQuotes: z.array(z.string()),
  ruleItems: z.array(ruleEvidenceItemSchema).optional(),
  academic: z.object({
    authors: z.array(z.string()), year: z.number(), venue: z.string(),
    doi: z.string().optional(), abstract: z.string(),
  }).optional(),
  citations: z.array(evidenceCitationSchema),
});
export const evidenceReportSchema = z.object({
  id: z.string(), title: z.string(), createdAt: z.string(),
  mode: z.enum(["sample", "demo", "ai"]),
  binding: analysisBindingSchema.optional(), sources: z.array(requirementSourceSchema).default([]), scoringClauses: z.array(scoringClauseSchema).default([]),
  blocks: z.array(z.object({ id: z.string(), heading: z.string(), text: z.string() })),
});
// Single join table drives both report [证据] buttons and reverse citations.
export const storedCitationSchema = z.object({
  id: z.string(), evidenceId: z.string(), reportId: z.string(), blockId: z.string(),
  verification: z.enum(["confirmed", "pending"]),
});
export const evidenceDatabaseSchema = z.object({
  version: z.literal(1),
  records: z.array(evidenceRecordSchema.omit({ citations: true })),
  reports: z.array(evidenceReportSchema),
  citations: z.array(storedCitationSchema),
});
export const evidenceSearchResponseSchema = z.object({
  data: z.array(evidenceRecordSchema),
  meta: z.object({
    total: z.number(), query: z.string(), kind: evidenceKindFilterSchema,
    searchedAt: z.string(), searchMode: z.literal("local-concept-expansion"),
  }),
});
export const reportResponseSchema = z.object({
  data: evidenceReportSchema,
  evidence: z.array(evidenceRecordSchema),
  citations: z.array(storedCitationSchema),
});
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceStatus = z.infer<typeof evidenceStatusSchema>;
export type EvidenceKindFilter = z.infer<typeof evidenceKindFilterSchema>;
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type EvidenceCacheState = EvidenceRecord["cacheState"];
export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;
export type RuleEvidenceItem = z.infer<typeof ruleEvidenceItemSchema>;
export type AcademicMetadata = NonNullable<EvidenceRecord["academic"]>;
export type EvidenceReport = z.infer<typeof evidenceReportSchema>;
export type EvidenceDatabase = z.infer<typeof evidenceDatabaseSchema>;
export type EvidenceSearchResponse = z.infer<typeof evidenceSearchResponseSchema>;
export type ReportResponse = z.infer<typeof reportResponseSchema>;

