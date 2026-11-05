import type { EvidenceDatabase } from "@/modules/evidence-center";
import type { OverviewSnapshot } from "./dashboard-types";

const defaults = ["创新性", "技术实现", "文档规范", "答辩"];
export function buildOverviewSnapshot(database: EvidenceDatabase, reportId?: string | null, empty = false): OverviewSnapshot {
  const report = empty ? undefined : reportId ? database.reports.find((item) => item.id === reportId && item.mode !== "sample") : undefined;
  const blocks = report?.blocks.filter((block) => block.id.startsWith("score-")) ?? [];
  const links = database.citations.filter((link) => link.reportId === report?.id);
  const records = database.records.filter((record) => record.status !== "deprecated" && links.some((link) => link.evidenceId === record.id));
  const real = records.filter((record) => record.sourceMode !== "sample");
  const coverage = (blocks.length ? blocks : defaults.map((label, index) => ({ id: "score-" + index, heading: label, text: "" }))).map((block) => {
    const support = links.filter((link) => link.blockId === block.id && real.some((record) => record.id === link.evidenceId));
    const verified = report?.mode === "ai" && support.some((link) => link.verification === "confirmed" && real.some((record) => record.id === link.evidenceId && record.status === "confirmed"));
    const suggestion = block.text.trim();
    return { id: block.id, label: block.heading.replace(/^评分点\s*·\s*/, ""), state: verified ? "covered" as const : suggestion ? "partial" as const : "idle" as const,
      reason: verified ? "建议已关联到确认过的真实证据" : suggestion ? report?.mode === "demo" ? "演示建议，需基于原文重新核验" : "已有建议，引用与适用性仍需确认" : "上传比赛要求后提取正式评分维度",
      suggestion, evidenceCount: new Set(support.map((link) => link.evidenceId)).size,
      href: "/?view=requirements" + (report ? "&report=" + encodeURIComponent(report.id) : "") + "&criterion=" + encodeURIComponent(block.id) + "#coverage-" + encodeURIComponent(block.id),
    };
  });
  return { projectName: report?.title.replace(/\s*·\s*指导报告$/, "") || "传智杯 · AI Web 赛道", reportId: report?.id ?? null, reportMode: report?.mode === "ai" ? "ai" : report ? "demo" : null, reportCreatedAt: report?.createdAt ?? null,
    coverage, evidenceCount: real.length, confirmedCount: real.filter((record) => record.status === "confirmed").length,
    keywords: [...new Set(real.flatMap((record) => record.tags).filter((tag) => !/比赛规则/.test(tag)))].slice(0, 5), updatedAt: new Date().toISOString(),
  };
}
