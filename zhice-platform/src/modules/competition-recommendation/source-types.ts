import { z } from "zod";
import { requirementSourceSchema, scoringClauseSchema } from "@/shared/contracts/competition-binding";
export const competitionSourceResponseSchema = z.object({ source: requirementSourceSchema.nullable(), criteria: z.array(scoringClauseSchema), warnings: z.array(z.string()), cached: z.boolean() });
export type CompetitionSourceResponse = z.infer<typeof competitionSourceResponseSchema>;
