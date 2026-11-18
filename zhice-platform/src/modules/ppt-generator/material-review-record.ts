import { z } from "zod";
import type { WorkspaceProject } from "@/modules/workspace/types";
import { projectScopeKey } from "@/modules/workspace/types";
import type { Competition } from "@/modules/competition-recommendation/types";
import type { PlanChapter } from "@/modules/project-plan";
import type { PlanDocument } from "@/shared/contracts/plan-document";
import type { ParsedDocx, PlanPptOptions, PptCheck, PptOutline, PptPageRange, PptTemplate } from "./types";

export const materialReviewRecordSchema = z.object({
  scopeKey: z.string().min(1),
  fingerprint: z.string().min(1),
  reviewedAt: z.string().datetime(),
});
export type MaterialReviewRecord = z.infer<typeof materialReviewRecordSchema>;

type MaterialSnapshot = {
  project: WorkspaceProject | null;
  competition: Competition | null;
  plan: PlanDocument | null;
  draftChapters: PlanChapter[];
  outline: PptOutline | null;
  document: ParsedDocx | null;
  checks: PptCheck[];
  stale: boolean;
  template: PptTemplate;
  pageRange: PptPageRange;
  options: PlanPptOptions;
};

// Save/fetch times do not change material content. Verification times and versions do.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([key, entry]) => entry !== undefined && key !== "updatedAt" && key !== "fetchedAt").sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function materialFingerprint(input: MaterialSnapshot): string {
  const { project } = input;
  const content = canonical({
    ...input,
    project: project ? {
      scopeKey: projectScopeKey(project), name: project.name, studentProfile: project.studentProfile,
      selectedCompetitionId: project.selectedCompetitionId, selectedTrackId: project.selectedTrackId,
      selectionRevision: project.selectionRevision, competitionConfirmedAt: project.competitionConfirmedAt,
      projectStage: project.projectStage, preparation: project.preparation,
    } : null,
  });
  // Two independent 32-bit hashes identify a UI content version, not a security signature.
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < content.length; index++) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `materials-v1:${content.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

export function hasCurrentMaterialReview(record: MaterialReviewRecord | undefined, scopeKey: string | null, fingerprint: string): record is MaterialReviewRecord {
  return Boolean(scopeKey && record?.scopeKey === scopeKey && record.fingerprint === fingerprint);
}
