import { competitions } from "./data";
import { competitionPreparationFit } from "@/modules/preparation/domain";
import type { Competition, CompetitionMatch, RecommendationInput } from "./types";

const majorSynonyms: Record<string, string[]> = {
  "木材科学与工程": ["木材", "竹材", "材料", "林业", "创新创业", "乡村振兴"],
  "计算机科学与技术": ["计算机", "编程", "算法", "AI", "人工智能", "数学建模", "软件工程"],
  "软件工程": ["软件工程", "计算机", "编程", "算法", "AI", "人工智能"],
  "人工智能": ["人工智能", "AI", "计算机", "算法", "数据科学", "数学建模"],
  "数据科学": ["数据科学", "计算机", "数学建模", "人工智能", "数据分析"],
  "信息安全": ["信息安全", "计算机", "编程", "算法"],
  "数学": ["数学", "数学建模", "数据科学", "算法", "优化"],
  "自动化": ["自动化", "电子信息", "物联网", "嵌入式", "系统设计"],
  "电子信息": ["电子信息", "物联网", "嵌入式", "硬件", "系统设计"],
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s··+]/g, "");
const tokensFrom = (value: string) => value.split(/[，,、/\s]+/).map(normalize).filter(Boolean);

function expandedMajorTokens(major: string) {
  const normalized = normalize(major);
  const matched = Object.entries(majorSynonyms).find(([key]) => normalize(key) === normalized);
  return new Set([normalized, ...(matched?.[1] ?? [])].map(normalize));
}

function overlap(inputTokens: Set<string>, values: string[]) {
  return values.filter((value) => inputTokens.has(normalize(value)));
}

export function checkEligibility(competition: Competition, input: RecommendationInput): { eligible: boolean; reasons: string[]; warnings: string[] } {
  const reasons: string[] = []; const warnings: string[] = [];
  const expired = competition.campusCatalog?.status === "expired" || Boolean(competition.signupDeadline && Date.parse(competition.signupDeadline) <= Date.parse(input.now || new Date().toISOString()));
  if (expired) return { eligible: Boolean(input.includeExpired), reasons: ["报名已截止或目录已过期"], warnings: ["已过期，仅供历史参考，不能据此报名。"] };
  if (competition.dataMode === "demo" || competition.verificationStatus !== "verified") {
    return { eligible: true, reasons, warnings: ["资格、报名日期与团队人数尚未核验，仅供候选发现，不代表可报名。"] };
  }
  const grade = input.profile?.grade || input.grade;
  const major = input.profile?.major || input.major;
  if (competition.gradeRestrictions.length && grade !== "不限" && !competition.gradeRestrictions.some((g) => g === grade || ["不限", "全校", "本科生"].includes(g) && grade !== "研究生")) reasons.push("不符合年级限制");
  if (competition.majorRestrictions.length && !competition.majorRestrictions.some((value) => ["不限", "全部", "全专业"].includes(value) || normalize(major).includes(normalize(value)))) reasons.push("不符合专业限制");
  const size = input.profile ? input.profile.hasTeam ? input.profile.teamSize : 1 : null;
  if (size != null) {
    if (competition.teamSize.min != null && size < competition.teamSize.min) reasons.push("团队人数不足");
    if (competition.teamSize.max != null && size > competition.teamSize.max) reasons.push("团队人数超出限制");
  } else if (competition.teamSize.min != null || competition.teamSize.max != null) warnings.push("需补充团队人数，资格尚未确认");
  const now = Date.parse(input.now || new Date().toISOString());
  if (competition.registrationStatus === "closed" || competition.signupDeadline && Date.parse(competition.signupDeadline) <= now) reasons.push("报名已截止");
  if (competition.registrationStatus === "upcoming" || competition.signupStart && Date.parse(competition.signupStart) > now) reasons.push("报名尚未开始");
  if (competition.registrationStatus === "unknown" || !competition.signupDeadline) warnings.push("报名状态或截止时间待核验");
  return { eligible: reasons.length === 0, reasons, warnings };
}

function buildRecommendation(competition: Competition, input: RecommendationInput): CompetitionMatch {
  const majorTokens = expandedMajorTokens(input.major);
  const interestTokens = new Set(input.interests.flatMap(tokensFrom));
  const majorMatches = overlap(majorTokens, competition.majorTags);
  const interestMatches = overlap(interestTokens, [...competition.keywords, ...competition.majorTags]);
  const reasons: CompetitionMatch["reasons"] = [];
  let score = 0;

  if (majorMatches.length > 0) {
    score += Math.min(28, 12 + majorMatches.length * 5);
    reasons.push({ label: "专业标签匹配", detail: `${input.major} 对应 ${majorMatches.slice(0, 3).join("、")} 方向` });
  }
  if (interestMatches.length > 0) {
    score += Math.min(14, interestMatches.length * 5);
    reasons.push({ label: "兴趣方向匹配", detail: `覆盖 ${interestMatches.slice(0, 3).join("、")} 关键词` });
  }
  if (input.levelPreference === "不限" || input.levelPreference === competition.level) {
    score += 6;
    reasons.push({ label: "级别偏好匹配", detail: `符合${competition.level}赛事偏好` });
  }
  if (input.timePreference === "不限" || input.timePreference === competition.timeMode) {
    score += 5;
    reasons.push({ label: "时间偏好匹配", detail: `比赛采用${competition.timeMode}方式` });
  }
  if (input.grade === "不限" || competition.suitableGrades.includes(input.grade)) {
    score += 3;
    reasons.push({ label: "年级信息", detail: competition.verificationStatus === "verified" ? "已通过已知年级条件筛选" : "年级资格需以本届通知确认" });
  }
  const profile = input.profile;
  const includesAny = (text: string, values: string[]) => values.filter((value) => normalize(text).includes(normalize(value)));
  if (profile) {
    const matchedSkills = includesAny(profile.skills.join("、"), competition.fit.skills);
    if (matchedSkills.length) { score += Math.min(12, matchedSkills.length * 4); reasons.push({ label: "技能基础", detail: "已有技能覆盖 " + matchedSkills.slice(0, 3).join("、") }); }
    else if (competition.fit.skills.length) reasons.push({ label: "技能提升", detail: "建议补齐 " + competition.fit.skills.slice(0, 2).join("、") + "，这些是准备方向推测" });
    const teamMatches = includesAny(profile.teamCapabilities, competition.fit.team);
    if (profile.hasTeam) { score += 3 + Math.min(5, teamMatches.length * 2); reasons.push({ label: "团队能力", detail: teamMatches.length ? "团队已有 " + teamMatches.join("、") + " 经验" : "已组队，分工与人数仍需核对" }); }
    const mentors = includesAny(profile.mentors, competition.fit.mentor);
    if (mentors.length) { score += 5; reasons.push({ label: "导师支持", detail: "导师方向与 " + mentors.join("、") + " 相符" }); }
    const resources = includesAny(Object.values(profile.resources).join("、"), competition.fit.resources);
    if (resources.length) { score += 6; reasons.push({ label: "资源基础", detail: "可用资源涉及 " + resources.join("、") }); }
    if (competition.fit.weeklyHours != null) { if (profile.weeklyHours >= competition.fit.weeklyHours) score += 5; reasons.push({ label: "时间投入", detail: `每周 ${profile.weeklyHours} 小时；准备参考 ${competition.fit.weeklyHours} 小时（非官方要求）` }); }
    else reasons.push({ label: "时间投入", detail: `每周可投入 ${profile.weeklyHours} 小时，赛事工作量尚未核实` });
    if (competition.fit.budget != null) { if (profile.budget >= competition.fit.budget) score += 4; reasons.push({ label: "预算适配", detail: `预算 ${profile.budget} 元，准备参考 ${competition.fit.budget} 元（非报名费）` }); }
    else reasons.push({ label: "预算信息", detail: `预算 ${profile.budget} 元；报名费及材料成本待核验` });
    const goals = includesAny(profile.competitionGoal, competition.fit.goals);
    if (goals.length) { score += 8; reasons.push({ label: "参赛目标", detail: "目标与 " + goals.join("、") + " 方向相符" }); }
    if (profile.school.trim() === "福建农林大学" && competition.campusRecognitionLevel && (competition.campusSourceUrl || competition.campusCatalog?.sourceFile && competition.campusCatalog.sourcePage) && (competition.campusCatalog ? competition.campusCatalog.recognitionVerified && !["conflict", "expired"].includes(competition.campusCatalog.status) : competition.verificationStatus === "verified")) {
      score += 14;
      if (/认定|学分|奖项|保研|获奖/.test(profile.competitionGoal)) score += 8;
      reasons.push({ label: "校内认定", detail: `${competition.recognitionYear} 年：${competition.campusRecognitionLevel}，需确认适用本届` });
    } else reasons.push({ label: "校内认定", detail: "福建农林大学校内等级与认定年份未核验，不计入认定加分" });
  }
  if (competition.campusCatalog && !competition.majorTags.length) reasons.push({ label: "目录适用范围", detail: "目录未提供专业限制，适用资格仍需核对本届通知" });
  const planningFit = competitionPreparationFit(competition.name, input.profile);
  if (planningFit.score) { score += planningFit.score; reasons.push({ label: "专业与资源准备建议", detail: planningFit.reason + "（平台建议，非官方资格认定）" }); }
  const boundedScore = Math.min(99, Math.max(0, score));
  const incomplete = !competition.majorTags.length && competition.verificationStatus !== "verified";
  return { ...competition, matchScore: boundedScore, relevance: boundedScore >= 65 ? "高" : boundedScore >= 40 ? "中" : "低", category: incomplete ? "资料待完善" : boundedScore >= 65 ? "高匹配" : boundedScore >= 40 ? "提升型" : "挑战型", eligibilityWarnings: checkEligibility(competition, input).warnings, reasons };
}

export function matchCompetitions(input: RecommendationInput, catalog: Competition[] = competitions) {
  if (!input.major.trim() && input.interests.length === 0) return [];
  return catalog.filter((competition) => checkEligibility(competition, input).eligible)
    .map((competition) => buildRecommendation(competition, input))
    .filter((recommendation) => recommendation.reasons.some((reason) => ["专业标签匹配", "兴趣方向匹配", "目录适用范围", "专业与资源准备建议"].includes(reason.label)))
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function getFallbackCompetitions(input?: RecommendationInput, catalog: Competition[] = competitions) {
  const fallback = input || { major: "", grade: "不限" as const, interests: [], levelPreference: "不限" as const, timePreference: "不限" as const };
  return catalog.filter((competition) => checkEligibility(competition, fallback).eligible).slice(0, 3).map((competition) => buildRecommendation(competition, fallback));
}
