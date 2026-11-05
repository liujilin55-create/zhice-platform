import Fuse from "fuse.js";
import type { EvidenceKindFilter, EvidenceRecord } from "./types";

// Local concept expansion; deliberately not labelled embedding/vector similarity.
const concepts = [
  ["技术实现", "技术得分", "技术深度", "算法", "RAG", "检索增强", "Agent", "智能体", "工具调用", "工作流"],
  ["评分标准", "评分细则", "评审", "得分", "拿分", "分数"],
  ["创新点", "交互创新", "用户体验", "差异化", "竞品", "案例"],
  ["出处", "来源", "溯源", "可追溯", "证据", "证据链", "引用", "原文"],
  ["计划", "提交物", "截止", "时间节点", "备赛", "日程", "时间"],
];
const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, "");
function searchable(record: EvidenceRecord) {
  return normalize([record.title, record.source, record.excerpt, record.body, ...record.tags, record.academic?.abstract ?? "", ...(record.ruleItems ?? []).map((item) => item.text)].join(" "));
}
export function searchEvidence(records: EvidenceRecord[], query: string, kind: EvidenceKindFilter) {
  const scoped = kind === "all" ? records : records.filter((record) => record.kind === kind);
  const cleaned = normalize(query.trim().slice(0, 500));
  const statusOrder = (record: EvidenceRecord) => record.status === "deprecated" ? 2 : record.status === "confirmed" ? 0 : 1;
  if (!cleaned) return [...scoped].sort((a, b) => statusOrder(a) - statusOrder(b) || b.relevance - a.relevance);
  const words = query.match(/[a-z0-9-]+|[\u4e00-\u9fff]{2,}/gi) ?? [];
  const expanded = [...new Set(concepts.filter((group) => group.some((term) => cleaned.includes(normalize(term)))).flat())];
  const fuzzy = new Fuse(scoped, { keys: ["title", "tags", "excerpt", "body", "academic.abstract", "ruleItems.text"], threshold: 0.35, ignoreLocation: true, includeScore: true });
  const fuzzyScores = new Map(fuzzy.search(query).map((item) => [item.item.id, 1 - (item.score ?? 1)]));
  return scoped.map((record) => {
    const corpus = searchable(record);
    const exact = corpus.includes(cleaned) ? 1 : 0;
    const direct = words.filter((word) => corpus.includes(normalize(word))).length;
    const semantic = expanded.filter((word) => corpus.includes(normalize(word))).length;
    const score = exact * 2 + direct * 0.5 + semantic * 0.15 + (fuzzyScores.get(record.id) ?? 0);
    return { record, score };
  }).filter(({ score }) => score > 0)
    .sort((a, b) => Number(a.record.status === "deprecated") - Number(b.record.status === "deprecated") || b.score - a.score)
    .map(({ record, score }) => ({ ...record, relevance: Math.min(0.99, 0.45 + score * 0.16) }));
}

