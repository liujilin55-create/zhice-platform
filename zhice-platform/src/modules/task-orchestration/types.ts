export type OrchestrationStatus = "todo" | "active" | "blocked" | "done";
export type OrchestrationPriority = "high" | "medium" | "low";
export type OrchestrationTask = { id: string; title: string; description: string; owner: string; due: string; tag: string; priority: OrchestrationPriority; status: OrchestrationStatus; dependencies: string[]; checklist: string[]; sample?: boolean; projectId?: string };
import { z } from "zod";

export const orchestrationTaskSchema = z.object({
  id: z.string(), title: z.string(), description: z.string(), owner: z.string(), due: z.string(), tag: z.string(),
  priority: z.enum(["high", "medium", "low"]), status: z.enum(["todo", "active", "blocked", "done"]),
  dependencies: z.array(z.string()), checklist: z.array(z.string()), sample: z.boolean().optional(), projectId: z.string().optional(),
});
