import type { WorkspaceProject } from "@/modules/workspace/types";
import { projectScopeKey } from "@/modules/workspace/types";

export type StepProgress = { complete: boolean; label: string };

/** Workflow progress describes saved work, not whether its claims have been verified. */
export function preparationProgress(project: WorkspaceProject, validTrack: boolean): StepProgress[] {
  const selectionSaved = validTrack && Boolean(project.competitionConfirmedAt);
  const topicSaved = Boolean(project.preparation.topicTitle.trim() && project.preparation.topicConfirmedAt && project.preparation.topicBinding === projectScopeKey(project));
  const asset = (status: WorkspaceProject["documentStatus"], draftLabel: string): StepProgress => ({
    complete: status === "confirmed" || status === "exported",
    label: status === "exported" ? "已导出" : status === "confirmed" ? "已保存" : status === "draft" ? draftLabel : "未开始",
  });
  return [
    { complete: selectionSaved, label: selectionSaved ? "已选择" : project.selectedCompetitionId ? "选择中" : "未选择" },
    { complete: topicSaved, label: topicSaved ? "已保存" : project.preparation.topicTitle || project.preparation.topicId ? "进行中" : "未开始" },
    asset(project.documentStatus, "已有草稿"),
    asset(project.pptStatus, "已有大纲"),
  ];
}
