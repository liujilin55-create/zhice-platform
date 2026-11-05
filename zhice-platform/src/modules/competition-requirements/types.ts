import { z } from "zod";
import { analysisBindingSchema, requirementSourceSchema, scoringClauseSchema } from "@/shared/contracts/competition-binding";

export const requirementTimelineSchema = z.object({
  milestone: z.string(),
  date: z.string(),
  description: z.string(),
});

export const competitionRequirementsSchema = z.object({
  title: z.string(),
  summary: z.string(),
  theme: z.string(),
  taskGoals: z.array(z.string()),
  deliverables: z.array(z.string()),
  scoringCriteria: z.array(z.string()),
  keywords: z.array(z.string()),
  technologyDirections: z.array(z.string()),
  timeline: z.array(requirementTimelineSchema),
});

export const paperSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number(),
  abstract: z.string(),
  url: z.string().url(),
  source: z.string(),
  citationCount: z.number(),
  relevanceScore: z.number(),
  matchedKeywords: z.array(z.string()),
});

export const planPhaseSchema = z.object({
  phase: z.string(),
  days: z.string(),
  tasks: z.array(z.string()),
});

export const guidanceReportSchema = z.object({
  overview: z.string(),
  topicDirections: z.array(z.object({
    title: z.string(),
    reason: z.string(),
    expectedOutput: z.string(),
  })),
  technicalRoute: z.array(z.string()),
  scoringSuggestions: z.array(z.object({
    criterion: z.string(),
    action: z.string(),
  })),
  innovationPoints: z.array(z.string()),
  plan: z.array(planPhaseSchema),
  risks: z.array(z.string()),
  references: z.array(z.string()),
});

export const analysisResponseSchema = z.object({
  ok: z.literal(true),
  projectId: z.string().optional(), competitionId: z.string().optional(), sourceId: z.string().optional(), reportId: z.string().optional(),
  binding: analysisBindingSchema.optional(), sources: z.array(requirementSourceSchema).default([]), scoringClauses: z.array(scoringClauseSchema).default([]),
  mode: z.enum(["ai", "demo"]),
  file: z.object({
    name: z.string(),
    type: z.string(),
    size: z.number(),
    parser: z.string(),
  }),
  requirements: competitionRequirementsSchema,
  papers: z.array(paperSchema),
  report: guidanceReportSchema,
  warnings: z.array(z.string()),
  extractedTextPreview: z.string(),
  traceability: z.object({
    reportId: z.string(),
    evidenceIds: z.array(z.string()),
    links: z.record(z.string(), z.array(z.string())).optional(),
  }).optional(),
});

export type CompetitionRequirements = z.infer<typeof competitionRequirementsSchema>;
export type Paper = z.infer<typeof paperSchema>;
export type GuidanceReport = z.infer<typeof guidanceReportSchema>;
export type AnalysisResponse = z.infer<typeof analysisResponseSchema>;
