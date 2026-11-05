import { z } from "zod";

export const coverageRowSchema = z.object({
  id: z.string(), label: z.string(), state: z.enum(["covered", "partial", "idle"]),
  reason: z.string(), suggestion: z.string(), evidenceCount: z.number(), href: z.string(),
});
export type CoverageRow = z.infer<typeof coverageRowSchema>;
export const overviewSnapshotSchema = z.object({ data: z.object({
  projectName: z.string(), reportId: z.string().nullable(), reportMode: z.enum(["ai", "demo"]).nullable(), reportCreatedAt: z.string().nullable(),
  coverage: z.array(coverageRowSchema), evidenceCount: z.number(), confirmedCount: z.number(),
  keywords: z.array(z.string()), updatedAt: z.string(),
}) });
export type OverviewSnapshot = z.infer<typeof overviewSnapshotSchema>["data"];
export const briefingRequestSchema = z.object({
  reportId: z.string().max(150).nullable(), empty: z.boolean(), projectName: z.string().min(1).max(120),
  tasks: z.array(z.object({ title: z.string().max(300), status: z.enum(["todo", "active", "blocked", "done"]) })).max(30),
});
export const briefingEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), mode: z.enum(["ai", "local"]) }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({ type: z.literal("replace"), text: z.string(), message: z.string(), mode: z.literal("local") }),
  z.object({ type: z.literal("complete") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type BriefingEvent = z.infer<typeof briefingEventSchema>;
