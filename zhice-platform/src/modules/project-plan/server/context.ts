import "server-only";
import { readEvidenceDatabase } from "@/modules/evidence-center/server";
import { resolveCompetition } from "@/modules/campus-catalog/server/catalog";
import { cachedCompetitionSource } from "@/modules/competition-recommendation/server/sources";
import { sameBinding, bindingKey } from "@/shared/contracts/competition-binding";
import { PLAN_CHAPTERS, planContextSchema, type PlanContext, type PlanWorkspace } from "../types";

export async function getPlanContext(reportId?: string | null, workspace?: PlanWorkspace): Promise<PlanContext> {
  const empty = { reportId: null, title: "尚未选择比赛", mode: null, criteria: [], evidence: [], blockers: ["请先选择比赛和赛道"] };
  if (!workspace) return planContextSchema.parse(empty);
  const competition = (await resolveCompetition(workspace.binding.competitionId));
  const track = competition?.tracks.find((item) => item.trackId === workspace.binding.trackId);
  if (!competition || !track) return planContextSchema.parse(empty);
  const database = reportId ? await readEvidenceDatabase() : null;
  const candidate = database?.reports.find((item) => item.id === reportId);
  const report = candidate && sameBinding(candidate.binding, workspace.binding) && candidate.mode !== "sample" ? candidate : null;
  const cached = await cachedCompetitionSource(competition.competitionId, track.trackId);
  // An explicit upload override must not silently reintroduce cached official criteria.
  const sources = report ? report.sources : cached ? [cached.source] : [];
  const eligibleCache = cached && sources.some((source) => source.sourceId === cached.source.sourceId && source.contentHash === cached.source.contentHash) ? cached : null;
  const currentSources = eligibleCache ? sources.map((source) => source.sourceId === eligibleCache.source.sourceId ? eligibleCache.source : source) : sources;
  const criteria = (eligibleCache?.criteria || []).filter((clause) => clause.verificationStatus === "verified" && ["official", "campus"].includes(clause.origin) && eligibleCache!.source.text.includes(clause.text));
  const warnings: string[] = [];
  if (reportId && !report) warnings.push("该报告不属于当前项目、比赛、赛道或选择版本，已排除。");
  if (report?.mode === "demo") warnings.push("原分析为演示建议；其生成评分点不作为官方条款。");
  const conflicts = competition.verificationStatus === "conflict" || track.verificationStatus === "conflict" || currentSources.some((source) => source.verificationStatus === "conflict");
  const verificationStatus = conflicts ? "conflict" : criteria.length && (!competition.campusCatalog || competition.campusCatalog.status === "verified") ? "verified" : "pending";
  const blockers: string[] = [];
  if (!workspace.selectionConfirmedAt) blockers.push("请先确认比赛与赛道");
  if (!criteria.length) blockers.push("缺少已人工核验的官方评分原句，可先生成待核验草稿");
  if (track.verificationStatus !== "verified") blockers.push("当前赛道资料待核验，通用演示赛道只能生成草稿");
  if (competition.campusCatalog && competition.campusCatalog.status !== "verified") blockers.push("当前学校目录记录待核验、过期或冲突，仅允许草稿");
  if (conflicts) blockers.push("来源存在冲突，需先解决冲突");
  const links = database?.citations.filter((link) => link.reportId === report?.id) || [];
  const preparation = workspace.preparation?.topicBinding === bindingKey(workspace.binding) ? workspace.preparation : undefined;
  const evidence = database?.records.filter((item) => item.sourceMode !== "sample" && item.status !== "deprecated" && links.some((link) => link.evidenceId === item.id)).map((item) => ({ id: item.id, title: item.title, source: item.source, excerpt: item.excerpt, kind: item.kind, href: "/?view=evidence&evidence=" + encodeURIComponent(item.id) })) || [];
  if (preparation) evidence.push(...preparation.research.map((item, index) => ({ id: `topic-reference-${index}`, title: item.title, source: item.source + "（学生选入，适配性需核验）", excerpt: item.excerpt, kind: item.kind === "paper" ? "academicPaper" as const : "caseStudy" as const, href: item.url })));
  return planContextSchema.parse({ preparation, binding: workspace.binding, competitionName: competition.name, trackName: track.name, studentProfile: workspace.studentProfile, reportId: report?.id || null, title: preparation?.topicTitle || competition.name, mode: report?.mode || null, criteria, sources: currentSources, evidence, verificationStatus, canGenerateFormal: blockers.length === 0, blockers, warnings });
}
export function chapterTitle(id: string) { return PLAN_CHAPTERS.find((chapter) => chapter.id === id)?.title || id; }
