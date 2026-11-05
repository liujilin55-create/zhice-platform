"use client";
import { VerificationActions, VerificationText } from "@/modules/verification";
import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { useOverviewSnapshot } from "@/modules/project-overview";
import { useWorkspaceStore } from "@/modules/workspace";
import { coverageStyles as s } from "./requirement-coverage.styles";

export function RequirementCoverage() {
  const params = useSearchParams();
  const target = params.get("criterion");
  const reportId = useWorkspaceStore((state) => state.project?.reportId || null);
  const snapshot = useOverviewSnapshot(reportId, !reportId, Boolean(target));
  useEffect(() => {
    if (!target || !snapshot.data) return;
    const element = document.getElementById("coverage-" + target);
    element?.focus({ preventScroll: true }); element?.scrollIntoView({ block: "center" });
  }, [target, snapshot.data]);
  if (!target) return null;
  return <section className={s.panel} aria-label="评分点覆盖详情"><h3 className={s.title}><LayoutGrid size={16} />评分点覆盖详情</h3><p className={s.hint}>{reportId ? "来自关联的指导报告。建议与引用仍需结合官方规则核验。" : "当前为通用备赛维度，上传比赛要求后会提取正式评分点。"}</p>
    {snapshot.loading && <p className={s.hint}>正在定位评分维度…</p>}{snapshot.error && <p className={s.error}>{snapshot.error}</p>}
    <div className={s.grid}>{snapshot.data?.coverage.map((row) => <article id={"coverage-" + row.id} tabIndex={-1} key={row.id} className={s.row + (target === row.id ? " " + s.active : "")}><h4 className={s.heading}>{row.label}</h4><span className={s.badge}>{row.state === "covered" ? "已覆盖且有证据" : row.state === "partial" ? <VerificationActions id={"coverage-" + row.id} subject={row.label + "：" + row.reason} href={row.href} /> : "未开始"}</span><p className={s.text}>{row.suggestion || "请先上传完整的比赛要求，生成对应的评分建议。"}</p><p className={s.text}><VerificationText text={row.reason} href={row.href} /> · {row.evidenceCount} 份关联原文</p>{reportId && <Link href={"/reports/" + encodeURIComponent(reportId) + "#" + encodeURIComponent(row.id)} className={s.link}>打开报告与原文证据 →</Link>}</article>)}</div>
  </section>;
}
