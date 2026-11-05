"use client";

import { VerificationActions, VerificationText } from "@/modules/verification";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import { useEvidenceReport } from "./hooks/use-evidence-report";
import { useEvidenceStore } from "./stores/evidence.store";
import { reportStyles as styles } from "./report-page.styles";
import { bindingKey, verificationLabels } from "@/shared/contracts/competition-binding";

export function EvidenceReportPage({ reportId }: { reportId: string }) {
  const { report, loading, offline, error, retry } = useEvidenceReport(reportId);
  const openEvidence = useEvidenceStore((state) => state.openEvidence);
  useEffect(() => {
    if (!report || !window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const timer = requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(timer);
  }, [report]);
  return <main className={styles.page}>
    <div className={styles.container}>
      <Link href="/?view=evidence" className={styles.back}><ArrowLeft size={16} />返回证据中心</Link>
      <h1 className={styles.heading}>{report?.data.title ?? "指导报告"}</h1>
      {report && <p className={styles.meta}>{new Date(report.data.createdAt).toLocaleString("zh-CN")} · {report.data.mode === "ai" ? "AI 生成" : report.data.mode === "sample" ? "示例报告" : "规则兜底报告"} · {report.citations.length} 条证据关联</p>}
      {error && <div role="status" className={styles.error}><span>{offline && report ? "正在显示已缓存报告。" : ""}{error}</span><button type="button" className={styles.retry} disabled={loading} onClick={retry}>重试</button></div>}
      {loading && !report && <div role="status" className={styles.skeleton}><span className="sr-only">正在加载报告</span></div>}
      {report && <>
        {report.data.binding && <section className={styles.block} aria-label="报告归属与来源"><h2 className={styles.blockHeading}>报告归属 · <VerificationText text={verificationLabels[report.data.binding.verificationStatus]} scope={bindingKey(report.data.binding)} href="/?view=requirements" /></h2><p className={styles.text}>项目：{report.data.binding.projectId}<br />比赛：{report.data.binding.competitionId} / {report.data.binding.trackId}<br />来源：{report.data.binding.sourceId}<br />报告：{report.data.binding.reportId}</p>{report.data.sources.map((source) => <p key={source.sourceId} className={styles.text}>{source.title} · <VerificationText text={verificationLabels[source.verificationStatus]} source={source.url || source.title} href={source.url || "/?view=evidence"} scope={report.data.binding ? bindingKey(report.data.binding) : undefined} /> · {source.url ? <a href={source.url} target="_blank" rel="noreferrer">打开来源</a> : "用户上传资料（非官方来源）"}</p>)}</section>}
        <p className={styles.notice}>AI 建议，仅供参考。{report.data.mode === "sample" ? "本报告用于演示双向溯源。" : ""}自动检索到的支撑材料需要核对原文，确认是否支持当前结论；可以就近打开来源并记录核验结果。</p>
        <div className={styles.sections}>{report.data.blocks.map((block) => {
          const citations = report.citations.filter((citation) => citation.blockId === block.id);
          return <section tabIndex={-1} id={block.id} key={block.id} className={styles.block}>
            <h2 className={styles.blockHeading}>{block.heading}</h2>
            <p className={styles.text}><VerificationText text={block.text} scope={report.data.binding ? bindingKey(report.data.binding) : undefined} /></p>
            {citations.length ? <div className={styles.links}>{citations.map((citation) => {
              const evidence = report.evidence.find((item) => item.id === citation.evidenceId);
              if (!evidence) return null;
              return <div key={citation.id} className={styles.link}><Link href={"/?view=evidence&evidence=" + encodeURIComponent(evidence.id)} onClick={() => openEvidence(evidence.id)}>
                <FileText size={14} /><span>证据</span><span className={styles.linkTitle}>{evidence.title}</span></Link>
                {evidence.status === "deprecated" ? <span className={styles.deprecated}>已废弃 · 需复核</span> : citation.verification === "pending" && <VerificationActions id={"citation-" + citation.id} subject={evidence.title + "是否支持：" + block.text} source={evidence.sourceUrl || evidence.source} href={evidence.sourceUrl || "/?view=evidence&evidence=" + encodeURIComponent(evidence.id)} scope={report.data.binding ? bindingKey(report.data.binding) : undefined} />}
              </div>;
            })}</div> : <p className={styles.empty}>尚未关联可核验的证据。</p>}
          </section>;
        })}</div>
      </>}
    </div>
  </main>;
}
