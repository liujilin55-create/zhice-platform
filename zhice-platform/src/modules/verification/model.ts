import { z } from "zod";

export const verificationTaskSchema = z.object({
  id: z.string(), scope: z.string(), subject: z.string(), fingerprint: z.string(),
  source: z.string().default(""), href: z.string().default("/?view=verification"),
});
export const verificationRecordSchema = verificationTaskSchema.extend({
  outcome: z.enum(["verified", "pending", "conflict"]).default("verified"),
  value: z.string().trim().min(1).max(2000), reviewer: z.string().trim().min(1).max(80),
  source: z.string().trim().min(3).max(2000), note: z.string().trim().min(8).max(3000), confirmedAt: z.string().datetime(),
});
export type VerificationTask = z.infer<typeof verificationTaskSchema>;
export type VerificationRecord = z.infer<typeof verificationRecordSchema>;
export function textFingerprint(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
export function verificationKey(task: Pick<VerificationTask, "scope" | "id" | "fingerprint">) { return `${task.scope}:${task.id}:${task.fingerprint}`; }
export function safeVerificationHref(href?: string) { return href && !/[\u0000-\u0020\\]/.test(href) && (/^https?:\/\//i.test(href) || /^\/(?!\/)/.test(href) || href.startsWith("#")) ? href : "/?view=verification"; }
export function matchingRecord(task: VerificationTask, records: Record<string, VerificationRecord>) { return records[verificationKey(task)]; }
