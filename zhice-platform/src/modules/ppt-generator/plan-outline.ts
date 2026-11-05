import { confirmedBlocks, type PlanDocument, type DocumentReference } from "@/shared/contracts/plan-document";
import type { PlanPptOptions, PptCheck, PptOutline, PptSlide } from "./types";

export const PPT_TOPICS = [
  { id: "problem", title: "问题与痛点", chapters: ["project-intro", "executive-summary"], keywords: /痛点|问题|困难/ },
  { id: "users", title: "目标用户", chapters: ["market-analysis", "product-design"], keywords: /用户|客户|学生|人群/ },
  { id: "solution", title: "核心方案", chapters: ["product-design", "project-intro"], keywords: /方案|功能|平台|产品/ },
  { id: "innovation", title: "创新点", chapters: ["project-intro", "technical-route"], keywords: /创新|差异|独特|溯源/ },
  { id: "technology", title: "技术路线", chapters: ["technical-route"], keywords: /技术|算法|架构|模型|开发/ },
  { id: "validation", title: "验证结果", chapters: ["technical-route", "executive-summary"], keywords: /验证|测试|实验|结果|样本|准确/ },
  { id: "resources", title: "资源与落地", chapters: ["market-analysis", "project-intro", "finance"], keywords: /资源|落地|预算|设备|导师|实验室/ },
  { id: "team", title: "团队与分工", chapters: ["team"], keywords: /团队|分工|成员/ },
  { id: "schedule", title: "实施计划", chapters: ["project-intro", "finance"], keywords: /计划|阶段|周|进度|里程碑/ },
  { id: "risk", title: "风险与应对", chapters: ["risk-response"], keywords: /风险|应对|失败|依赖/ },
  { id: "summary", title: "总结", chapters: ["conclusion", "executive-summary"], keywords: /总结|价值|目标|预期/ },
] as const;
export const isPendingClaim = (text: string) => /^(?:【待核验】|【建议补充】|【AI\s*推断[，,]?\s*请核验】)/.test(text.trim());
const clean = (text: string) => text.trim().replace(/^[#>*\-\s]+/, "");
const fragments = (text: string) => text.split(/(?<=[。；！？])\s*|\n/).map(clean).filter((text) => text.length >= 3 && text.length <= 105);
const normalizedSentence = (text: string) => clean(text).replace(/[。；！？.!?;]+$/, "").replace(/\s+/g, " ");
const supports = (source: string, text: string) => [source, ...fragments(source)].some((sentence) => normalizedSentence(sentence) === normalizedSentence(text));
const numbers = (text: string) => text.match(/\d+(?:[,.]\d+)*(?:\s*(?:%|％|万|亿|元|人|次|个|小时|天|周|月|年))?/g) || [];

/** Reconstruct provenance from the saved document; client supplied claims are never trusted. */
export function traceOutline(outline: PptOutline, document: PlanDocument): PptOutline {
  const blocks = confirmedBlocks(document);
  return { ...outline, slides: outline.slides.map((slide) => {
    const claims = slide.bullets.map((text) => {
      const matches = isPendingClaim(text) ? [] : blocks.filter((block) => supports(block.text, text));
      return { text, origin: isPendingClaim(text) || !matches.length ? "pending" as const : matches.some((block) => block.origin === "user") ? "user" as const : "ai" as const, confirmed: matches.length > 0, blockIds: matches.map((block) => block.id), chapterIds: [...new Set(matches.map((block) => block.chapterId))], evidenceIds: [...new Set(matches.flatMap((block) => block.evidenceIds))], sourceIds: [...new Set(matches.flatMap((block) => block.sourceIds))] };
    });
    return { ...slide, claims, chapterIds: [...new Set(claims.flatMap((claim) => claim.chapterIds))], evidenceIds: [...new Set(claims.flatMap((claim) => claim.evidenceIds))], sourceIds: [...new Set(claims.flatMap((claim) => claim.sourceIds))] };
  }) };
}

export function createPlanOutline(document: PlanDocument, reference: DocumentReference, options: PlanPptOptions, choices: Record<string, string[]> = {}): PptOutline {
  const blocks = confirmedBlocks(document);
  const pages = options.pages - 1;
  const topics = [...PPT_TOPICS];
  if (options.focus === "technical") topics.sort((a, b) => Number(["technology", "innovation", "validation"].includes(b.id)) - Number(["technology", "innovation", "validation"].includes(a.id)));
  const groups = Array.from({ length: Math.min(pages, topics.length) }, () => [] as typeof topics);
  topics.forEach((topic, index) => groups[Math.min(groups.length - 1, Math.floor(index * groups.length / topics.length))].push(topic));
  const summary = blocks.filter((block) => ["executive-summary", "conclusion"].includes(block.chapterId)).flatMap((block) => fragments(block.text)).slice(0, 2);
  const slides: PptSlide[] = [{ id: crypto.randomUUID(), title: document.projectName, layout: "cover", bullets: summary.length ? summary : ["【建议补充】本稿摘自已确认章节，未核验内容保留标记"], speakerNotes: summary.length ? summary.join("\n") : "【建议补充】介绍项目名称与汇报主题，正文事实见后续各页的计划书来源。", topicIds: ["cover"] }];
  for (const group of groups) {
    const bullets: string[] = [];
    for (const topic of group) {
      const matched = blocks.filter((block) => topic.keywords.test(block.text));
      const eligible = matched.length ? matched : ["technology", "solution", "team", "summary"].includes(topic.id) ? blocks.filter((block) => (topic.chapters as readonly string[]).includes(block.chapterId)) : [];
      const selected = choices[topic.id]?.flatMap((id) => eligible.filter((block) => block.id === id)) || [];
      const candidates = selected.length ? selected : [...eligible].sort((a, b) => Number(topic.keywords.test(b.text)) - Number(topic.keywords.test(a.text)));
      const snippets = candidates.flatMap((block) => fragments(block.text)).filter((text) => !bullets.includes(text));
      bullets.push(...snippets.slice(0, group.length > 1 ? 2 : 3));
      if (!snippets.length) bullets.push(`【建议补充】${topic.title}缺少已确认素材，请回计划书补充`);
    }
    slides.push({ id: crypto.randomUUID(), title: group.map((topic) => topic.title).join(" · "), layout: group.some((topic) => topic.id === "summary") ? "closing" : "content", topicIds: group.map((topic) => topic.id), bullets: bullets.slice(0, 5), speakerNotes: bullets.slice(0, 5).join("\n") });
  }
  const extraPages = [{ title: "评分点与证据", match: /评分|证据/, topic: "scoring" }, { title: "验证细节", match: /验证|测试|实验|结果/, topic: "validation" }, { title: "资源与推进安排", match: /资源|计划|预算|阶段/, topic: "schedule" }];
  for (let index = 0; slides.length < options.pages; index++) {
    const extra = extraPages[index % extraPages.length];
    const snippets = blocks.filter((block) => extra.match.test(block.text)).flatMap((block) => fragments(block.text)).slice(0, 3);
    const bullets = snippets.length ? snippets : [`【建议补充】${extra.title}缺少已确认素材`];
    slides.splice(slides.length - 1, 0, { id: crypto.randomUUID(), title: extra.title, bullets, speakerNotes: bullets.join("\n"), layout: "content", topicIds: [extra.topic] });
  }
  return traceOutline({ title: document.projectName, subtitle: document.title, slides, planSource: reference }, document);
}

export function checkPlanOutline(outline: PptOutline, document: PlanDocument): PptCheck[] {
  const checks: PptCheck[] = []; const blocks = confirmedBlocks(document);
  if (outline.title !== document.projectName || outline.slides[0]?.title !== document.projectName) checks.push({ code: "project-name", severity: "error", message: "PPT 标题和封面必须与当前计划书的项目名称一致。" });
  if (new Set(outline.slides.map((slide) => slide.id)).size !== outline.slides.length) checks.push({ code: "duplicate-slide", severity: "error", message: "页面标识重复，请重新生成。" });
  if (document.chapters.some((chapter) => !chapter.confirmed)) checks.push({ code: "unconfirmed-chapters", severity: "warning", message: "未确认章节已排除，PPT 默认仅使用已确认章节。" });
  if (document.chapters.some((chapter) => chapter.blocks.some((block) => !block.confirmed))) checks.push({ code: "unconfirmed-blocks", severity: "warning", message: "待补数据和未确认推断不作为事实引用。" });
  const traced = traceOutline(outline, document);
  for (const slide of traced.slides) {
    if (!slide.title.trim() || !slide.bullets.length || slide.bullets.every((text) => !text.trim())) checks.push({ code: "blank-page", severity: "error", message: "存在空白页面。", slideId: slide.id });
    if (slide.title.length > (slide.layout === "cover" ? 120 : 45) || slide.bullets.some((text) => text.length > 110) || slide.bullets.join("").length > 380) checks.push({ code: "capacity", severity: "error", message: "页面文字超出建议容量，请精简或拆页。", slideId: slide.id });
    for (const claim of slide.claims || []) {
      if (isPendingClaim(claim.text)) { checks.push({ code: "pending-claim", severity: "warning", message: "页面含显式待补充或待核验内容，导出时保留标记。", slideId: slide.id }); continue; }
      if (!claim.confirmed) {
        checks.push({ code: numbers(claim.text).length ? "number-mismatch" : "unsupported-claim", severity: "error", message: numbers(claim.text).length ? "数字或其所属结论不在已确认原文中；请回计划书核实，或加【待核验】标记。" : "该结论没有已确认原文支持；请回计划书确认，或加【待核验】标记。", slideId: slide.id });
      } else if (claim.origin === "ai" && !claim.evidenceIds.length) checks.push({ code: "no-evidence", severity: "warning", message: "该 AI 内容虽已由用户确认，但尚未关联证据。", slideId: slide.id });
    }
    for (const text of [slide.title === document.projectName ? "" : slide.title, ...slide.speakerNotes.split(/\n/).filter((line) => !isPendingClaim(line))]) {
      if (numbers(text).length && !blocks.some((block) => supports(block.text, text))) checks.push({ code: "notes-number", severity: "error", message: "标题或演讲备注中的数字及结论缺少已确认原文支持。", slideId: slide.id });
    }
    if (slide.speakerNotes.split(/\n/).some((text) => text.trim() && !isPendingClaim(text) && !blocks.some((block) => supports(block.text, text)))) checks.push({ code: "unsupported-notes", severity: "error", message: "演讲备注含未确认结论，请回计划书确认或加【待核验】标记。", slideId: slide.id });
    if (slide.title !== document.projectName && !isPendingClaim(slide.title) && /达到|增长|提升|实现了|获得|证实|验证了|降低|提高|领先|成功|冠军|首创|第一|唯一/.test(slide.title) && !blocks.some((block) => supports(block.text, slide.title))) checks.push({ code: "unsupported-title", severity: "error", message: "页面标题中的结论没有已确认原文支持。", slideId: slide.id });
  }
  if (!document.sources.length || document.sources.some((source) => source.verificationStatus !== "verified")) checks.push({ code: "unverified-source", severity: "warning", message: "赛事来源缺失、待核验或冲突，不得将此稿描述为官方评分结论。" });
  if (!document.scoringRequirements.length) checks.push({ code: "no-rubric", severity: "warning", message: "没有已核验评分要求，无法判断评分覆盖。" });
  for (const criterion of document.scoringRequirements) {
    const cited = blocks.filter((block) => block.sourceIds.includes(criterion.sourceId) && (block.text.includes(criterion.title) || block.text.includes(criterion.text)));
    if (!cited.length || !traced.slides.some((slide) => slide.claims?.some((claim) => claim.blockIds.some((id) => cited.some((block) => block.id === id))))) checks.push({ code: "rubric-gap", severity: "warning", message: `评分点“${criterion.title}”缺少页面与确认材料的关联。` });
  }
  return checks;
}
