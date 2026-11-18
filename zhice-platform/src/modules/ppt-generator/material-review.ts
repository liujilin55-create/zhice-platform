import type { WorkspaceProject } from "@/modules/workspace/types";
import { projectScopeKey } from "@/modules/workspace/types";
import type { Competition } from "@/modules/competition-recommendation/types";
import type { PlanDocument } from "@/shared/contracts/plan-document";
import type { PptCheck, PptOutline } from "./types";

export type MaterialReviewItem = {
  id: string; title: string; state: "ready" | "missing" | "review"; detail: string; href: string;
};

export function buildMaterialReview(input: {
  project: WorkspaceProject | null;
  competition: Competition | null;
  plan: PlanDocument | null;
  draftChapterCount?: number;
  outline: PptOutline | null;
  checks: PptCheck[];
  stale: boolean;
}): MaterialReviewItem[] {
  const { project, competition, plan, outline, checks, stale } = input;
  if (!project) return [{ id: "project", title: "备赛项目", state: "missing", detail: "先创建一个项目，材料会按项目独立保存。", href: "/?view=competitions" }];
  const filled = (text: string) => Boolean(text.trim()) && !/^(待补充|待填写|未知|未填写)$/.test(text.trim());
  const profileReady = [project.studentProfile.school, project.studentProfile.major, project.studentProfile.competitionGoal].every(filled);
  const track = competition?.tracks.find((item) => item.trackId === project.selectedTrackId);
  const selectionReady = Boolean(competition && track && project.competitionConfirmedAt);
  const topicReady = Boolean(project.preparation.topicTitle.trim());
  const topicCurrent = project.preparation.topicBinding === projectScopeKey(project);
  const chapterCount = plan?.chapters.filter((chapter) => chapter.blocks.some((block) => block.text.trim())).length || input.draftChapterCount || 0;
  const unreviewedBlocks = plan?.chapters.flatMap((chapter) => chapter.blocks.filter((block) => !chapter.confirmed || !block.confirmed || block.marker !== "generated")).length || 0;
  const sourceReady = Boolean(plan?.sources.length && plan.sources.every((source) => source.verificationStatus === "verified") && plan.scoringRequirements.length);
  const errors = checks.filter((check) => check.severity === "error");
  const pendingSlides = outline?.slides.filter((slide) => slide.bullets.some((text) => /【(?:待核验|建议补充|AI\s*推断)/.test(text))).length || 0;
  return [
    { id: "profile", title: "画像与目标", state: profileReady ? "ready" : "missing", detail: profileReady ? `${project.studentProfile.school} · ${project.studentProfile.major}` : "学校、专业或参赛目标还未填写完整。", href: "/?view=competitions" },
    { id: "competition", title: "比赛与赛道", state: selectionReady ? "ready" : "missing", detail: selectionReady ? `${competition!.name} · ${track!.name}` : "尚未确认有效的比赛与赛道，可以先制作通用草稿。", href: "/?view=competitions" },
    { id: "topic", title: "项目方向", state: !topicReady ? "missing" : topicCurrent ? "ready" : "review", detail: !topicReady ? "补充项目方向，便于计划书与演示文稿保持一致。" : topicCurrent ? project.preparation.topicTitle : "方向已有草稿，比赛选择变化后请重新核对适配性。", href: "/?view=topics" },
    { id: "research", title: "案例与论文来源", state: project.preparation.research.length ? "review" : "missing", detail: project.preparation.research.length ? `已加入 ${project.preparation.research.length} 份参考资料；提交前请核对原文是否支持你的结论。` : "尚未加入参考依据，可在第二步检索论文或登记资料。", href: "/?view=topics" },
    { id: "document", title: "计划书正文", state: !chapterCount ? "missing" : unreviewedBlocks || !plan ? "review" : "ready", detail: !chapterCount ? "还没有计划书正文，可直接在第三步生成或编辑草稿。" : `${chapterCount} 个章节已保存${unreviewedBlocks ? `，其中 ${unreviewedBlocks} 个内容块仍含待补或未核验内容` : !plan ? "，当前为未绑定比赛的通用草稿" : ""}。`, href: "/?view=plan" },
    { id: "official", title: "赛事来源与评分要求", state: sourceReady ? "ready" : "review", detail: sourceReady ? "已有核验过的来源与评分原句，请留意适用届次。" : "赛事来源或评分要求尚未完成核对；草稿中的建议不能视作官方要求。", href: "/?view=requirements" },
    { id: "presentation", title: "演示文稿", state: !outline ? "missing" : stale || errors.length || pendingSlides ? "review" : "ready", detail: !outline ? "尚未生成演示大纲，在“演示制作”中即可开始。" : stale ? "源材料已更新，请重新生成大纲后导出。" : errors.length ? `${outline.slides.length} 页大纲中有 ${errors.length} 项一致性问题需要修改。` : pendingSlides ? `${outline.slides.length} 页大纲已生成，${pendingSlides} 页仍保留待补或待核验标记。` : `${outline.slides.length} 页大纲已生成，未发现自动检查可识别的结构问题。`, href: "/?view=ppt" },
  ];
}
