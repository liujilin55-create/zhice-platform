import { z } from "zod";

export const preparationSchema = z.object({
  demo: z.boolean().default(false),
  entry: z.enum(["new", "existing"]).default("new"),
  answers: z.record(z.string(), z.string().max(2000)).default({}),
  topicId: z.string().nullable().default(null),
  topicTitle: z.string().max(160).default(""),
  topicBinding: z.string().nullable().default(null),
  topicConfirmedAt: z.string().nullable().default(null),
  research: z.array(z.object({ title: z.string(), url: z.string().url(), excerpt: z.string(), kind: z.enum(["paper", "case"]), source: z.string() })).max(30).default([]),
});
export type Preparation = z.infer<typeof preparationSchema>;
