import { z } from "zod";
import { competitionRequirementsSchema, guidanceReportSchema, type CompetitionRequirements, type GuidanceReport } from "./types";

export const emptyRequirements = (): CompetitionRequirements => ({
  title: "", summary: "", theme: "", taskGoals: [], deliverables: [], scoringCriteria: [],
  keywords: [], technologyDirections: [], timeline: [],
});
export const emptyReport = (): GuidanceReport => ({
  overview: "", topicDirections: [], technicalRoute: [], scoringSuggestions: [],
  innovationPoints: [], plan: [], risks: [], references: [],
});

// Partial JSON is provisional. Validate each field/item at the network edge,
// including unfinished final array items, rather than casting it to a full result.
export function normalizePartialAnalysis(value: unknown) {
  const root = z.object({ requirements: z.unknown().optional(), report: z.unknown().optional() }).safeParse(value);
  if (!root.success) return {};
  const requirementsInput = z.record(z.string(), z.unknown()).safeParse(root.data.requirements);
  const reportInput = z.record(z.string(), z.unknown()).safeParse(root.data.report);
  const normalizeFields = (shape: Record<string, z.ZodType>, input: Record<string, unknown>, defaults: Record<string, unknown>) => {
    const output = { ...defaults };
    for (const [key, schema] of Object.entries(shape)) {
      const raw = input[key];
      if (schema instanceof z.ZodArray && Array.isArray(raw)) {
        output[key] = raw.flatMap((item) => {
          const parsed = z.safeParse(schema.element, item);
          return parsed.success ? [parsed.data] : [];
        });
      } else {
        const parsed = schema.safeParse(raw);
        if (parsed.success) output[key] = parsed.data;
      }
    }
    return output;
  };
  return {
    requirements: requirementsInput.success ? competitionRequirementsSchema.parse(normalizeFields(competitionRequirementsSchema.shape, requirementsInput.data, emptyRequirements())) : undefined,
    report: reportInput.success ? guidanceReportSchema.parse(normalizeFields(guidanceReportSchema.shape, reportInput.data, emptyReport())) : undefined,
  };
}
