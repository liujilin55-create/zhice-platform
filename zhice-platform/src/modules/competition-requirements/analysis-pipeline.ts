import { analysisResponseSchema, competitionRequirementsSchema, guidanceReportSchema, type AnalysisResponse, type CompetitionRequirements, type GuidanceReport, type Paper } from "./types";
import { normalizePartialAnalysis } from "./partial-analysis";
import type { AnalysisEvent, AnalysisStep } from "./stream-types";
import type { CompetitionBinding, RequirementSource, ScoringClause } from "@/shared/contracts/competition-binding";
export type AnalysisOptions = { binding: CompetitionBinding; sourceId: string; sources: RequirementSource[]; scoringClauses: ScoringClause[] };

export type ModelAnalysis = { requirements: CompetitionRequirements; report: GuidanceReport };
export type ModelUpdate = { type: "partial"; value: unknown } | { type: "complete"; value: ModelAnalysis };
export type AnalysisDependencies = {
  parse: (file: File, signal: AbortSignal) => Promise<{ text: string; parser: string; isImage: boolean; warnings: string[] }>;
  ocr: (file: File, signal: AbortSignal) => Promise<string>;
  keywords: (text: string, major: string, notes: string) => string[];
  search: (keywords: string[], text: string, signal: AbortSignal) => Promise<Paper[]>;
  demoRequirements: (text: string, major: string, notes: string) => CompetitionRequirements;
  demoReport: (requirements: CompetitionRequirements, papers: Paper[], major: string) => GuidanceReport;
  model: (input: { text: string; major: string; notes: string; keywords: string[]; papers: Paper[]; signal: AbortSignal }) => AsyncIterable<ModelUpdate>;
  capture: (result: AnalysisResponse, originalText: string) => Promise<NonNullable<AnalysisResponse["traceability"]>>;
};

export async function runAnalysis(
  file: File, major: string, notes: string,
  emit: (event: AnalysisEvent) => void,
  signal: AbortSignal,
  dependencies: AnalysisDependencies,
  options?: AnalysisOptions,
): Promise<AnalysisResponse> {
  const step = (id: AnalysisStep, status: "running" | "done" | "warning", message: string) => {
    signal.throwIfAborted();
    emit({ type: "step", step: id, status, message });
  };
  const warn = (message: string) => { warnings.push(message); emit({ type: "warning", message }); };
  const warnings: string[] = [];
  step("uploading", "done", "已接收文件，格式与大小检查通过");
  step("extracting", "running", "正在提取正文，图片文件将尝试文字识别");
  const parsed = await dependencies.parse(file, signal);
  signal.throwIfAborted();
  parsed.warnings.forEach(warn);
  let originalText = parsed.isImage || parsed.parser.includes("占位") ? "" : parsed.text;
  if (parsed.isImage) {
    try {
      originalText = await dependencies.ocr(file, signal);
      if (!originalText) warn("图片暂未识别到文字，将展示演示建议；请核对原图或重新上传可读文件。");
    } catch {
      signal.throwIfAborted();
      warn("图片文字识别暂时不可用，将展示演示建议；请核对原图。");
    }
  }
  const text = originalText.replace(/\u0000/g, " ").trim().slice(0, 14000);
  const fileInfo = { name: file.name, type: file.type || "application/octet-stream", size: file.size, parser: parsed.parser };
  emit({ type: "file", file: fileInfo, textPreview: text.slice(0, 1600), characterCount: text.length });
  step("extracting", text ? "done" : "warning", text ? "已提取 " + text.length + " 字，可先查看原文预览" : "未获得可读原文，后续内容需人工核对");
  step("keywords", "running", "正在结合正文与专业信息提炼检索方向");
  const keywords = dependencies.keywords(text, major, notes).filter(Boolean);
  emit({ type: "keywords", keywords });
  step("keywords", "done", "已提炼 " + keywords.length + " 个关键词");
  step("papers", "running", "正在检索相关研究，结果返回后即可先阅读");
  const papers = await dependencies.search(keywords, text, signal);
  signal.throwIfAborted();
  const cached = papers.length > 0 && papers.every((paper) => !/Semantic Scholar/i.test(paper.source));
  emit({ type: "papers", papers, cached });
  step("papers", cached ? "warning" : "done", papers.length ? "已返回 " + papers.length + " 篇论文" + (cached ? "，当前使用本地参考资料" : "并完成排序") : "暂未检索到论文，可调整关键词后重试");
  step("requirements", "running", "正在解读主题、评分要求和时间节点");
  let requirements = dependencies.demoRequirements(text, major, notes);
  let report = dependencies.demoReport(requirements, papers, major);
  let mode: AnalysisResponse["mode"] = "demo";
  const modelSteps: AnalysisStep[] = ["requirements", "topics", "route", "scoring", "plan"];
  const messages: Record<string, string> = {
    requirements: "正在解读比赛主题、提交物和评分要求",
    topics: "正在生成选题方向，内容将逐段显示",
    route: "正在设计技术路线，可先查看已生成的选题",
    scoring: "正在对齐评分点并补充创新建议",
    plan: "正在安排备赛计划、风险与参考文献",
  };
  let activeIndex = 0;
  let lastDraft = "";
  let lastSentAt = 0;
  try {
    for await (const update of dependencies.model({ text, major, notes, keywords, papers, signal })) {
      signal.throwIfAborted();
      if (update.type === "complete") {
        const finalRequirements = competitionRequirementsSchema.parse(update.value.requirements);
        const finalReport = guidanceReportSchema.parse(update.value.report);
        requirements = finalRequirements;
        report = finalReport;
        mode = "ai";
        break;
      }
      const draft = normalizePartialAnalysis(update.value);
      const generated = draft.report;
      const nextIndex = generated?.plan.length ? 4 : generated?.scoringSuggestions.length ? 3 : generated?.technicalRoute.length ? 2 : generated?.overview || generated?.topicDirections.length ? 1 : 0;
      if (nextIndex > activeIndex) {
        // Out-of-order provider output must not mark missing sections complete.
        const present = [Boolean(draft.requirements?.summary), Boolean(generated?.overview || generated?.topicDirections.length), Boolean(generated?.technicalRoute.length), Boolean(generated?.scoringSuggestions.length)];
        for (let index = 0; index < nextIndex; index++) if (present[index]) step(modelSteps[index], "done", "该部分已生成，最终校验仍在进行");
        activeIndex = nextIndex;
        step(modelSteps[activeIndex], "running", messages[modelSteps[activeIndex]]);
      }
      const serialized = JSON.stringify(draft);
      const now = Date.now();
      if (serialized !== lastDraft && (now - lastSentAt >= 100 || nextIndex > 0 && !lastDraft)) {
        emit({ type: "draft", ...draft, mode: "ai" });
        lastDraft = serialized;
        lastSentAt = now;
      }
    }
    if (mode !== "ai") warn(text ? "当前未启用可用模型，已使用演示建议；请在后台配置“比赛要求分析”的模型。" : "未提取到可读原文，当前仅展示演示建议；请重新上传可读文件。");
  } catch {
    signal.throwIfAborted();
    warn("模型生成暂时不可用，本次草稿已替换为演示建议，请核对后再使用。");
  }
  // A failed/invalid model draft must not be mixed with the replacement result.
  if (mode === "demo") emit({ type: "draft", requirements, report, mode, reset: true });
  else emit({ type: "draft", requirements, report, mode });
  for (const id of modelSteps) step(id, mode === "ai" ? "done" : "warning", mode === "ai" ? "内容已生成" : "已提供演示内容，待核验");
  step("review", "running", "正在校验报告结构，并核对参考文献链接");
  report.references = papers.slice(0, 4).map((paper) => paper.title + "（" + paper.year + "，" + (paper.authors[0] || "未知作者") + " 等）");
  const result = analysisResponseSchema.parse({
    ok: true, mode, file: fileInfo, requirements, report, papers, warnings,
    extractedTextPreview: text || "未提取到可读文本，当前结果来自演示模板和专业信息。",
    ...(options ? { projectId: options.binding.projectId, competitionId: options.binding.competitionId, sourceId: options.sourceId, reportId: "report-" + crypto.randomUUID(), sources: options.sources, scoringClauses: options.scoringClauses } : {}),
  });
  if (options) {
    const sourceConflict = options.sources.some((source) => source.verificationStatus === "conflict");
    result.binding = { ...options.binding, sourceId: options.sourceId, reportId: result.reportId!, verificationStatus: sourceConflict ? "conflict" : mode === "ai" && options.scoringClauses.length > 0 && options.sources.every((source) => source.verificationStatus === "verified") ? "verified" : "pending" };
    if (mode === "demo") result.warnings.push("演示建议不构成官方评分标准，不能用于正式赛事对齐。");
    if (sourceConflict) result.warnings.push("当前比赛来源存在冲突，请先核对并解决冲突；本报告只能作为草稿。");
    else if (result.binding.verificationStatus !== "verified") result.warnings.push("当前来源或解读待核验，仅可作为准备草稿。");
  }
  step("review", "done", "报告结构校验完成");
  step("saving", "running", "正在保存报告、原文与双向证据关联");
  signal.throwIfAborted();
  try {
    result.traceability = await dependencies.capture(result, originalText);
    step("saving", "done", "报告与证据已保存，可双向追溯");
  } catch {
    signal.throwIfAborted();
    const message = "报告已生成，但证据关联保存失败；可先复制或导出当前报告后重试。";
    result.warnings.push(message);
    emit({ type: "warning", message });
    step("saving", "warning", "报告可阅读，证据关联尚未保存");
  }
  signal.throwIfAborted();
  emit({ type: "complete", result });
  return result;
}
