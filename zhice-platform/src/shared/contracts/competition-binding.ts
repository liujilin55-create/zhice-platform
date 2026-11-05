import { z } from "zod";

export const verificationStatusSchema = z.enum(["verified", "pending", "conflict"]);
export const verificationLabels = { verified: "已核验", pending: "待核验", conflict: "来源冲突" } as const;
export const competitionBindingSchema = z.object({
  projectId: z.string().min(1).max(180), competitionId: z.string().min(1).max(120),
  trackId: z.string().min(1).max(160), revision: z.string().min(1).max(180),
});
export type CompetitionBinding = z.infer<typeof competitionBindingSchema>;
export function bindingKey(binding: CompetitionBinding) { return [binding.projectId, binding.competitionId, binding.trackId, binding.revision].map(encodeURIComponent).join("::"); }
export function sameBinding(a: CompetitionBinding | null | undefined, b: CompetitionBinding | null | undefined) {
  return Boolean(a && b && bindingKey(a) === bindingKey(b));
}
export const requirementSourceSchema = z.object({
  sourceId: z.string(), competitionId: z.string(), trackId: z.string().nullable(), title: z.string(),
  kind: z.enum(["official", "campus", "upload", "demo"]), url: z.string().url().nullable(),
  text: z.string(), contentHash: z.string(), verificationStatus: verificationStatusSchema,
  lastVerified: z.string().nullable(), fetchedAt: z.string(), warnings: z.array(z.string()),
});
export type RequirementSource = z.infer<typeof requirementSourceSchema>;
export const scoringClauseSchema = z.object({
  id: z.string(), title: z.string(), text: z.string(), sourceId: z.string(), sourceUrl: z.string().url().nullable(),
  verificationStatus: verificationStatusSchema, origin: z.enum(["official", "campus", "upload", "demo"]),
});
export type ScoringClause = z.infer<typeof scoringClauseSchema>;
export const analysisBindingSchema = competitionBindingSchema.extend({ sourceId: z.string(), reportId: z.string(), verificationStatus: verificationStatusSchema });
