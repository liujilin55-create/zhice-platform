import { topicValues } from "@/modules/preparation/domain";
import { projectBinding, type WorkspaceProject } from "@/modules/workspace/types";
import { sameBinding } from "@/shared/contracts/competition-binding";
import { preparationChapters, type PlanChapter, type PlanSlotId, type SurveySession } from "./types";

/** Reuse supplied facts without making an incomplete interview look complete. */
export function sessionForDraft(session: SurveySession, project: WorkspaceProject): SurveySession {
  const binding = projectBinding(project) || undefined;
  const supplied = topicValues(project.preparation, project.studentProfile) || {
    oneLineDescription: project.name,
    goal: project.studentProfile.competitionGoal,
    team: project.studentProfile.teamCapabilities,
    progress: Object.values(project.studentProfile.resources).filter(Boolean).join("；"),
  };
  const slots = { ...session.slots };
  let changed = Boolean(binding) !== Boolean(session.binding) || Boolean(binding && !sameBinding(binding, session.binding));
  for (const [id, value] of Object.entries(supplied)) {
    const key = id as PlanSlotId;
    if (!value?.trim() || slots[key].value?.trim()) continue;
    slots[key] = { ...slots[key], value, status: /待补充|待验证|拟议|假设/.test(value) ? "needsVerification" : "captured" };
    changed = true;
  }
  if (!changed) return session;
  const currentSlot = Object.values(slots).find((slot) => slot.status !== "captured")?.id || null;
  return { ...session, binding, slots, complete: !currentSlot, currentSlot, updatedAt: new Date().toISOString() };
}

const chapterPrompts: Record<string, string> = {
  "executive-summary": "用一段话说明问题、方案、当前进展和本轮目标。",
  "project-intro": "补充问题背景、发生场景与已有调研依据。",
  "market-analysis": "填写目标对象、访谈记录、需求证据与现有替代方案。",
  "product-design": "说明产品或材料方案、主要功能、使用流程与预期成果。",
  "technical-route": "说明实现步骤、可用条件、对照方案与验证方法。",
  team: "填写实际成员、分工、指导教师与可用资源。",
  "business-model": "说明拟采用的应用路径、合作方式与价值验证计划。",
  finance: "列明真实报价、预算、用量与测算口径；不要把预测写成已实现收益。",
  "risk-response": "列出尚未解决的问题、验证安排、负责人和备选方案。",
  conclusion: "说明本轮准备目标、拟交付材料和下一步安排。",
};

export function createGeneralDraft(project: WorkspaceProject, session: SurveySession, chapterId: string): PlanChapter {
  const title = preparationChapters(project.preparation).find((chapter) => chapter.id === chapterId)?.title || chapterId;
  const supplied = Object.values(session.slots).filter((slot) => slot.value?.trim()).map((slot) => `【已生成】${slot.label}：${slot.value}`).join("\n\n");
  return {
    id: chapterId, title, status: "draft", generationStatus: "draft", sourceIds: [], evidenceIds: [], mode: "local", updatedAt: new Date().toISOString(),
    content: `# ${title}\n\n> 通用计划书草稿 · 尚未对齐具体比赛。以下为写作提纲，缺失资料保留占位。\n\n${supplied}\n\n【建议补充】${chapterPrompts[chapterId] || "补充本章节内容。"}\n____\n\n【建议补充】比赛、赛道、评分要求及提交时间：____。`,
  };
}

export function generalDraftMarkdown(title: string, chapters: PlanChapter[]) {
  return `# ${title}\n\n> 通用计划书草稿 · 尚未对齐具体比赛。待补资料与推断标记保留，提交前请在第四步集中检查。\n\n${chapters.map((chapter) => chapter.content).join("\n\n---\n\n")}`;
}
