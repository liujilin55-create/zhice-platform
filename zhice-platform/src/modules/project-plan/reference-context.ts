import type { WorkspaceProject } from "@/modules/workspace/types";
import { projectScopeKey, projectBinding } from "@/modules/workspace/types";
import { sameBinding } from "@/shared/contracts/competition-binding";
import type { PlanContext, SurveySession } from "./types";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([key, entry]) => entry !== undefined && !["updatedAt", "createdAt", "fetchedAt"].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Every writing input belongs to the reference version, including custom topics. */
export function chapterReferenceContextKey(
  project: WorkspaceProject,
  session: SurveySession,
  instructions = "",
  context?: PlanContext | null,
  currentContent = "",
): string {
  const relevantContext = context && sameBinding(context.binding, projectBinding(project)) ? {
    competitionName: context.competitionName, trackName: context.trackName,
    sources: context.sources, criteria: context.criteria, evidence: context.evidence,
    verificationStatus: context.verificationStatus,
  } : null;
  const content = stable({
    scopeKey: projectScopeKey(project), name: project.name, profile: project.studentProfile,
    preparation: project.preparation, reportId: project.reportId,
    slots: session.slots, instructions: instructions.trim(), currentContent,
    context: relevantContext,
  });
  let first = 2166136261;
  let second = 5381;
  for (let index = 0; index < content.length; index++) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `chapter-reference-v1:${content.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}
