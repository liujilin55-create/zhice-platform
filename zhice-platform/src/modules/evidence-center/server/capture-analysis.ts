import "server-only";
import type { AnalysisResponse } from "@/modules/competition-requirements";
import type { EvidenceDatabase } from "../types";
import { mutateEvidenceDatabase } from "./repository";

// Only exact substrings from the parser are stored as rule evidence. Model
// paraphrases and demo requirements are never relabelled as uploaded originals.
export async function captureAnalysis(result: AnalysisResponse, extractedText: string) {
  const reportId = result.reportId || "report-" + crypto.randomUUID();
  const now = new Date().toISOString();
  const ruleId = "rule-" + crypto.randomUUID();
  const raw = extractedText.trim().slice(0, 14000);
  const lines = raw.split(/\n|(?<=[。！？])/).map((line) => line.trim()).filter(Boolean);
  const matches = lines.filter((line) => /评分|评审|得分|分值|权重|score|criteria/i.test(line)).slice(0, 20);
  const rules = matches.map((text, index) => ({
    label: "评分相关原文 · " + (index + 1), text, page: "解析片段 " + (index + 1) + " · 原页码待核对",
  }));
  const blocks = [
    { id: "overview", heading: "比赛要求解读", text: result.report.overview },
    ...result.report.topicDirections.map((item, index) => ({ id: "topic-" + index, heading: "选题方向 · " + (index + 1), text: item.title + "\n" + item.reason + "\n预期产出：" + item.expectedOutput })),
    ...result.report.technicalRoute.map((text, index) => ({ id: "route-" + index, heading: "技术路线 · 第 " + (index + 1) + " 点", text })),
    ...result.report.scoringSuggestions.map((item, index) => ({ id: "score-" + index, heading: "评分点 · " + item.criterion, text: item.action })),
    ...result.report.innovationPoints.map((text, index) => ({ id: "innovation-" + index, heading: "创新点 · " + (index + 1), text })),
    ...result.report.plan.map((item, index) => ({ id: "plan-" + index, heading: item.phase + " · " + item.days, text: item.tasks.join("\n") })),
    ...result.report.risks.map((text, index) => ({ id: "risk-" + index, heading: "风险提醒 · " + (index + 1), text })),
    ...result.papers.map((paper, index) => ({ id: "reference-" + index, heading: "参考文献 · " + (index + 1), text: paper.title + "\n" + paper.authors.join("、") + " · " + paper.year + "\n" + paper.url })),
  ];
  return mutateEvidenceDatabase((database) => {
    database.reports.push({ id: reportId, title: result.requirements.title + " · 指导报告", createdAt: now, mode: result.mode, blocks, binding: result.binding, sources: result.sources || [], scoringClauses: result.scoringClauses || [] });
    for (const source of result.sources || []) {
      const evidenceId = "source-" + reportId + "-" + source.sourceId;
      database.records.push({ id: evidenceId, kind: "competitionRule", title: source.title, source: source.kind === "official" ? "官方来源正文（适用性需核验）" : "用户补充资料（待核验）", sourceUrl: source.url || undefined, sourceMode: source.kind === "official" ? "external" : "upload", occurredAt: source.fetchedAt, cachedAt: now, tags: ["比赛规则", "来源原文"], status: "pending", cacheState: "cached", relevance: 1, excerpt: source.text.slice(0, 180), body: source.text, highlightedQuotes: (result.scoringClauses || []).filter((clause) => clause.sourceId === source.sourceId && source.text.includes(clause.text)).map((clause) => clause.text) });
      for (const block of blocks.filter((item) => /^(overview|score-)/.test(item.id))) database.citations.push({ id: crypto.randomUUID(), evidenceId, reportId, blockId: block.id, verification: "pending" });
    }
    if (raw && !result.binding) {
      database.records.push({
        id: ruleId, kind: "competitionRule", title: result.file.name + " · 解析原文",
        source: "用户上传 · " + result.file.parser, sourceMode: "upload",
        occurredAt: now, cachedAt: now, pageRef: "解析文本 · 原页码待核对",
        tags: [...new Set(["比赛规则", ...result.requirements.keywords])].slice(0, 10),
        status: "pending", cacheState: "cached", relevance: 0.95,
        excerpt: matches[0] ?? raw.slice(0, 180), body: raw,
        highlightedQuotes: matches.slice(0, 5), ruleItems: rules,
      });
      // These are automatically retrieved supporting materials, not validated
      // citations. Both directions display the pending verification label.
      blocks.filter((block) => /^(overview|score-|plan-)/.test(block.id)).forEach((block) => {
        database.citations.push({ id: crypto.randomUUID(), evidenceId: ruleId, reportId, blockId: block.id, verification: "pending" });
      });
    }
    result.papers.forEach((paper, index) => {
      const existing = database.records.find((item) => item.sourceUrl === paper.url);
      const evidenceId = existing?.id ?? "paper-" + crypto.randomUUID();
      if (!existing) {
        const record: EvidenceDatabase["records"][number] = {
          id: evidenceId, kind: "academicPaper", title: paper.title,
          source: paper.source, sourceUrl: paper.url,
          sourceMode: /Semantic Scholar/i.test(paper.source) ? "external" : "sample",
          occurredAt: String(paper.year), cachedAt: now, pageRef: "摘要",
          tags: paper.matchedKeywords, status: "pending", cacheState: "cached",
          relevance: Math.max(0, Math.min(1, paper.relevanceScore / 100)),
          excerpt: paper.abstract.slice(0, 180),
          body: "从比赛要求分析保存的论文摘要。原文与适用性需人工核验。",
          highlightedQuotes: [],
          academic: { authors: paper.authors, year: paper.year, venue: paper.source, abstract: paper.abstract },
        };
        database.records.push(record);
      }
      database.citations.push({ id: crypto.randomUUID(), evidenceId, reportId, blockId: "reference-" + index, verification: "pending" });
      blocks.filter((block) => block.id.startsWith("route-") && paper.matchedKeywords.some((keyword) => keyword.length >= 2 && block.text.toLowerCase().includes(keyword.toLowerCase()))).forEach((block) => {
        database.citations.push({ id: crypto.randomUUID(), evidenceId, reportId, blockId: block.id, verification: "pending" });
      });
    });
    const reportLinks = database.citations.filter((link) => link.reportId === reportId);
    return {
      reportId,
      evidenceIds: [...new Set(reportLinks.map((link) => link.evidenceId))],
      links: Object.fromEntries(blocks.map((block) => [block.id, reportLinks.filter((link) => link.blockId === block.id).map((link) => link.evidenceId)])),
    };
  });
}
