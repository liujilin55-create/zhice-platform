import { VerificationActions, VerificationText } from "@/modules/verification";
import Link from "next/link";
import { ArrowUpRight, LayoutGrid } from "lucide-react";
import type { OverviewSnapshot } from "../../../dashboard-types";
import { coverageTones, dashboardStyles as s } from "../dashboard.styles";

export function CoverageMatrix({ snapshot, loading }: { snapshot: OverviewSnapshot | null; loading: boolean }) {
  const count = snapshot?.coverage.filter((row) => row.state === "covered").length ?? 0;
  return <section className={s.panel} aria-label="评分点矩阵"><div className={s.sectionHeader}><div><h3 className={s.title}><LayoutGrid size={17} />评分点矩阵</h3><p className={s.subtitle}>让每一条建议，都有可以追溯的依据。</p></div><span className={s.count}>{count} / {snapshot?.coverage.length ?? "—"} 已覆盖</span></div>
    {loading ? <p className={s.empty}>正在读取评分与证据关联…</p> : !snapshot ? <p className={s.empty}>评分资料暂不可用，请稍后重试。</p> : <div className={s.coverageGrid}>{snapshot.coverage.map((row, index) => <article key={row.id} className={s.criterion} aria-label={row.label + "：" + ({ covered: "已覆盖且有证据", partial: "建议待核验", idle: "未开始" }[row.state])}>
      <div className={s.row}><span className={s.ordinal}>{String(index + 1).padStart(2, "0")}</span><ArrowUpRight size={14} className={s.arrow} /></div><h4 className={s.criterionTitle}><Link href={row.href}>{row.label} ↗</Link></h4><span className={s.status + " " + coverageTones[row.state]}><span className={s.dot} />{row.state === "covered" ? "已覆盖且有证据" : row.state === "partial" ? <VerificationActions id={"coverage-" + row.id} subject={row.label + "：" + row.reason} href={row.href} /> : "未开始"}</span><p className={s.reason}><VerificationText text={row.reason} href={row.href} /></p><p className={s.evidence}>{row.evidenceCount ? row.evidenceCount + " 份关联原文 · 查看详情" : "查看评分详情与下一步"}</p>
    </article>)}</div>}
    <div className={s.legend}><span className={s.legendItem + " " + coverageTones.covered}><span className={s.dot} />有确认依据</span><span className={s.legendItem + " " + coverageTones.partial}><span className={s.dot} />证据需复核</span><span className={s.legendItem + " " + coverageTones.idle}><span className={s.dot} />未开始</span></div>
    <p className={s.matrixFoot}>{snapshot?.reportMode === "demo" ? "当前关联演示报告，建议与维度需人工核验。" : snapshot?.reportId ? "覆盖状态根据报告引用与证据确认情况计算。" : "当前展示通用备赛维度；上传后替换为比赛实际评分点。"}</p>
  </section>;
}
