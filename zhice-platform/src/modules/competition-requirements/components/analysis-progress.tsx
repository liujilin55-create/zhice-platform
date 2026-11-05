import { VerificationText } from "@/modules/verification";
import { AlertTriangle, Check, LoaderCircle, Radio, Square, Workflow } from "lucide-react";
import { ANALYSIS_STEPS } from "../stream-types";
import type { AnalysisState } from "../analysis-state";
import { progressStyles as s, stepStyles } from "./analysis-progress.styles";

type Props = Pick<AnalysisState, "status" | "steps" | "preview" | "logs" | "error"> & { elapsed: number; quietSeconds: number; onCancel: () => void };
export function AnalysisProgress({ status, steps, preview, logs, error, elapsed, quietSeconds, onCancel }: Props) {
  const busy = status === "running";
  const done = ANALYSIS_STEPS.filter(({ id }) => ["done", "warning"].includes(steps[id].status)).length;
  const active = ANALYSIS_STEPS.filter(({ id }) => steps[id].status === "running").at(-1);
  const title = busy ? "正在构建你的参赛指导" : status === "complete" ? "参赛指导已生成" : status === "cancelled" ? "本次分析已取消" : "分析暂时中断";
  const message = active ? steps[active.id].message : status === "complete" ? "可阅读完整结果、导出报告或查看证据。" : "已接收内容保留在下方，可点击上方按钮重新分析。";
  return <section className={s.panel} aria-label="分析进度">
    <div className={s.header}>
      <div><h3 className={s.title}><Workflow size={17} />{title}</h3><p className={s.subtitle}>结果随处理进度出现，可以先阅读，再继续等待后续内容。</p></div>
      <div className={s.tools}><span className={s.time}>已用 {elapsed} 秒</span>{preview.file && <a className={s.read} href={status === "complete" ? "#analysis-results" : "#analysis-live-results"}>{status === "complete" ? "查看完整结果 ↓" : "先看已生成内容 ↓"}</a>}{busy && <button type="button" className={s.cancel} onClick={onCancel}><Square size={11} className={s.inlineIcon} /> 取消本次分析</button>}</div>
    </div>
    <ol className={s.grid}>{ANALYSIS_STEPS.map((step, index) => {
      const current = steps[step.id];
      const variant = stepStyles[current.status];
      const label = { waiting: "待处理", running: "进行中", done: "已完成", warning: "需核验", error: "已中断" }[current.status];
      return <li key={step.id} className={s.step + " " + variant.card} aria-current={current.status === "running" ? "step" : undefined} aria-label={step.label + "：" + label}>
        <div className={s.label}><span className={s.icon + " " + variant.icon}>{current.status === "done" ? <Check size={13} /> : current.status === "running" ? <LoaderCircle size={13} className={s.spinner} /> : current.status === "warning" || current.status === "error" ? <AlertTriangle size={12} /> : index + 1}</span>{step.label}</div>
        <p className={s.detail}><VerificationText text={current.status === "waiting" ? step.detail : current.message} /></p>
      </li>;
    })}</ol>
    <div className={s.current} role="status" aria-live="polite"><Radio size={16} className={s.statusIcon} /><span><VerificationText text={message} />{busy && quietSeconds >= 15 && " 当前步骤仍在处理，收到新内容后会自动显示，无需刷新页面。"}</span></div>
    <div className={s.footer}><span>{done} / {ANALYSIS_STEPS.length} 个阶段已处理</span><span>正文 {preview.characterCount} 字 · 关键词 {preview.keywords.length} 个 · 论文 {preview.papers?.length ?? 0} 篇</span></div>
    {!!logs.length && <details className={s.logs}><summary className={s.logTitle}>查看最近处理动态</summary><ul>{logs.map((log, index) => <li key={index}><VerificationText text={log} /></li>)}</ul></details>}
    {error && <p role="alert" className={s.error}><VerificationText text={error} /></p>}
  </section>;
}
