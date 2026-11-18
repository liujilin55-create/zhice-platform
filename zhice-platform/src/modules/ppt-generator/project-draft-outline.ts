import type { PlanChapter } from "@/modules/project-plan/types";
import { isPendingClaim, PPT_TOPICS } from "./plan-outline";
import type { PlanPptOptions, PptCheck, PptOutline, PptSlide } from "./types";

export function projectDraftKey(projectName: string, chapters: PlanChapter[]) {
  const value = JSON.stringify([projectName, chapters.map(({ id, content }) => [id, content])]);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function excerpts(content: string) {
  return content.split(/\n|(?<=[。；！？])/).map((line) => line.replace(/^[#>*\-\s]+/, "").replace(/【已生成】/g, "").trim())
    .filter((line) => line.length >= 3 && !/^【评分原文与来源】/.test(line))
    .map((line) => isPendingClaim(line) ? line.slice(0, 105) : `【待核验】${line.slice(0, 98)}`);
}

/** Unbound drafts remain project-owned and explicitly unverified; no competition is invented. */
export function createProjectDraftOutline(projectId: string, projectName: string, chapters: PlanChapter[], options: PlanPptOptions): PptOutline {
  const relevant = chapters.filter((chapter) => !chapter.binding && chapter.content.trim());
  const summary = relevant.filter((chapter) => ["executive-summary", "project-intro"].includes(chapter.id)).flatMap((chapter) => excerpts(chapter.content)).slice(0, 2);
  const slides: PptSlide[] = [{ id: crypto.randomUUID(), title: projectName, layout: "cover", bullets: summary.length ? summary : ["【建议补充】填写项目目标与核心方案"], speakerNotes: "【待核验】本稿来自尚未绑定比赛的计划书草稿，提交前需核对赛事与资料。", topicIds: ["cover"] }];
  const groups = Array.from({ length: Math.min(options.pages - 1, PPT_TOPICS.length) }, () => [] as typeof PPT_TOPICS[number][]);
  PPT_TOPICS.forEach((topic, index) => groups[Math.min(groups.length - 1, Math.floor(index * groups.length / PPT_TOPICS.length))].push(topic));
  for (const group of groups) {
    const bullets = [...new Set(group.flatMap((topic) => {
      const preferred = relevant.filter((chapter) => (topic.chapters as readonly string[]).includes(chapter.id));
      const content = (preferred.length ? preferred : relevant.filter((chapter) => topic.keywords.test(chapter.content))).flatMap((chapter) => excerpts(chapter.content));
      return content.length ? content.slice(0, group.length > 1 ? 2 : 3) : [`【建议补充】${topic.title}暂无正文`];
    }))].slice(0, 5);
    slides.push({ id: crypto.randomUUID(), title: group.map((topic) => topic.title).join(" · "), bullets, speakerNotes: bullets.join("\n"), layout: group.some((topic) => topic.id === "summary") ? "closing" : "content", topicIds: group.map((topic) => topic.id) });
  }
  while (slides.length < options.pages) slides.splice(slides.length - 1, 0, { id: crypto.randomUUID(), title: "资料与验证计划", bullets: ["【建议补充】补充原始来源和实际验证结果"], speakerNotes: "【建议补充】说明资料来源与下一步验证安排。", layout: "content" });
  return { title: projectName, subtitle: "未绑定比赛的计划书草稿", slides, draftSource: { projectId, contentKey: projectDraftKey(projectName, relevant) } };
}

export function checkProjectDraftOutline(outline: PptOutline): PptCheck[] {
  const checks: PptCheck[] = [{ code: "unbound-draft", severity: "warning", message: "当前为未绑定比赛的草稿，所有要点须保留待核验标记；选赛后可回第三步带入正文。" }];
  for (const slide of outline.slides) {
    if (slide.bullets.some((text) => !isPendingClaim(text)) || slide.speakerNotes.split(/\n/).some((line) => line.trim() && !isPendingClaim(line))) checks.push({ code: "draft-marker", severity: "error", message: "尚未绑定比赛的草稿需在每条要点和备注前保留【待核验】或【建议补充】标记。", slideId: slide.id });
    if (slide.bullets.join("").length > 380 || slide.bullets.some((text) => text.length > 110)) checks.push({ code: "capacity", severity: "error", message: "页面文字过多，请精简或拆分。", slideId: slide.id });
  }
  return checks;
}
