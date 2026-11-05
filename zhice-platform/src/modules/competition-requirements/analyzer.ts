import Fuse from "fuse.js";
import { demoPapers, demoReport, demoRequirements } from "./data";
import { competitionRequirementsSchema, guidanceReportSchema, paperSchema, type CompetitionRequirements, type GuidanceReport, type Paper } from "./types";

const keywordAliases: Record<string, string[]> = {
  "人工智能": ["AI", "大模型", "Agent", "机器学习"],
  "智能体": ["Agent", "工具调用", "自主规划"],
  "检索": ["RAG", "知识库", "检索增强"],
  "图像": ["多模态", "OCR", "视觉模型"],
  "计算机": ["编程", "软件工程", "Web", "算法", "AI", "数学建模"],
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_—–-]/g, "");

export function extractKeywords(text: string, major: string, notes: string) {
  const majorRelated = Object.entries(keywordAliases)
    .filter(([key]) => major.includes(key) || key.includes(major))
    .flatMap(([, aliases]) => aliases);
  const pool = [
    ...demoRequirements.keywords,
    ...demoRequirements.technologyDirections,
    major, ...majorRelated,
    "计算机", "算法", "数据分析", "数学建模", "创新创业", "可解释性", "论文", "Web", "产品设计", "校园服务",
  ];
  const source = `${text} ${major} ${notes}`;
  const matched = pool.filter((keyword) => source.toLowerCase().includes(keyword.toLowerCase()));
  const expanded = matched.flatMap((keyword) => keywordAliases[keyword] ?? []);
  return Array.from(new Set([...matched, ...expanded])).slice(0, 12);
}

export function createDemoRequirements(text: string, major: string, notes: string): CompetitionRequirements {
  const keywords = extractKeywords(text, major, notes);
  return competitionRequirementsSchema.parse({
    ...demoRequirements,
    keywords: keywords.length ? keywords : demoRequirements.keywords,
    summary: major ? `${demoRequirements.summary} 当前分析将结合“${major}”专业背景给出更具体的路线建议。` : demoRequirements.summary,
  });
}

function scorePaper(paper: Paper, keywords: string[], text: string) {
  const source = normalize(`${paper.title} ${paper.abstract} ${paper.matchedKeywords.join(" ")}`);
  const matches = keywords.filter((keyword) => source.includes(normalize(keyword)));
  const abstractOverlap = text ? Math.min(1, matches.length / Math.max(3, keywords.length)) : 0.35;
  const recency = Math.max(0, Math.min(1, (paper.year - 2018) / 8));
  const citations = Math.min(1, Math.log10(paper.citationCount + 1) / 5);
  const relevanceScore = Math.round(Math.min(99, 45 + matches.length * 9 + abstractOverlap * 18 + recency * 10 + citations * 8));
  return { ...paper, relevanceScore, matchedKeywords: Array.from(new Set([...paper.matchedKeywords, ...matches])).slice(0, 5) };
}

export function rankPapers(keywords: string[], text: string, papers: Paper[] = demoPapers) {
  return papers.map((paper) => scorePaper(paper, keywords, text)).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 6);
}

export async function searchAcademicPapers(keywords: string[], text: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const endpoint = process.env.ACADEMIC_API_URL || "https://api.semanticscholar.org/graph/v1/paper/search";
  if (!keywords.length) return rankPapers(demoRequirements.keywords, text);

  try {
    const url = new URL(endpoint);
    const materialQuery = /竹|木质|缓冲|育苗|板材/.test(keywords.join(" "));
    url.searchParams.set("query", materialQuery ? /育苗/.test(keywords.join(" ")) ? "bamboo fiber nursery containers wet strength" : /板材/.test(keywords.join(" ")) ? "bamboo wood residues composite board mechanical properties" : "bamboo fiber molded pulp cushioning packaging compression moisture" : keywords.slice(0, 6).join(" "));
    url.searchParams.set("limit", "6");
    url.searchParams.set("fields", "title,authors,year,abstract,url,citationCount,externalIds");
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`academic api ${response.status}`);
    const payload = await response.json() as { data?: Array<{ paperId?: string; title?: string; authors?: Array<{ name?: string }>; year?: number; abstract?: string; url?: string; citationCount?: number }> };
    const remote = (payload.data ?? []).filter((paper) => paper.title && paper.url).map((paper, index) => paperSchema.parse({
      id: paper.paperId || `academic-${index}`,
      title: paper.title,
      authors: (paper.authors ?? []).map((author) => author.name).filter((name): name is string => Boolean(name)).slice(0, 4),
      year: paper.year || 2020,
      abstract: paper.abstract || "摘要暂未提供，建议打开来源页面核对。",
      url: paper.url,
      source: "Semantic Scholar",
      citationCount: paper.citationCount || 0,
      relevanceScore: 0,
      matchedKeywords: [],
    }));
    if (remote.length) return rankPapers(keywords, text, remote);
  } catch {
    signal?.throwIfAborted();
    // Academic APIs are best-effort. The local cache keeps the demo useful during rate limits or offline judging.
  }
  const related = demoPapers.filter((paper) => keywords.some((keyword) => normalize(`${paper.title} ${paper.abstract} ${paper.matchedKeywords.join(" ")}`).includes(normalize(keyword))));
  return rankPapers(keywords, text, related);
}

export function createDemoReport(requirements: CompetitionRequirements, papers: Paper[], major: string): GuidanceReport {
  return guidanceReportSchema.parse({
    ...demoReport,
    overview: `${demoReport.overview}${major ? ` 结合${major}专业，优先选择能体现数据、算法或 AI 工程能力的切入点。` : " 建议补充专业信息后再收窄技术路线。"}`,
    references: papers.slice(0, 4).map((paper) => `${paper.title}（${paper.year}，${paper.authors[0] || "未知作者"} 等）`),
    scoringSuggestions: demoReport.scoringSuggestions.map((item) => item.criterion === "AI 技术深度" ? { ...item, action: `${item.action} 当前识别到的关键词包括：${requirements.keywords.slice(0, 4).join("、")}。` } : item),
  });
}

export function findTextMatches(query: string, papers: Paper[]) {
  return new Fuse(papers, { keys: ["title", "abstract", "matchedKeywords"], threshold: 0.5 }).search(query).map((result) => result.item);
}
