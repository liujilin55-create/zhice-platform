"use client";

import { VerificationActions, VerificationText } from "@/modules/verification";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertTriangle, BookOpen, Check, Clipboard, CloudUpload, Download, ExternalLink, FileCheck2, FileSearch, FileText, Lightbulb, ScanText, Sparkles, Target, WandSparkles } from "lucide-react";
import { type AnalysisResponse, type GuidanceReport, type Paper } from "./types";
import { useEvidenceStore } from "@/modules/evidence-center";
import { requirementStyles as styles } from "./competition-requirements.styles";

import { useAnalysis } from "./hooks/use-analysis";
import { AnalysisProgress } from "./components/analysis-progress";
import { useWorkspaceStore } from "@/modules/workspace";
import { RequirementCoverage } from "./components/requirement-coverage";
import { AnalysisLiveResults } from "./components/analysis-live-results";
import { findCompetition } from "@/modules/competition-recommendation";
import { useCompetitionSource } from "./hooks/use-competition-source";
import { CompetitionSourcePanel } from "./components/competition-source-panel";
import { verificationLabels } from "@/shared/contracts/competition-binding";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function reportMarkdown(result: AnalysisResponse) {
  const { requirements, report, papers } = result;
  return `# ${requirements.title}\n\n> AI 建议，仅供参考。请以比赛官方通知和人工核对结果为准。\n\n## 比赛要求解读\n\n${requirements.summary}\n\n### 主题\n${requirements.theme}\n\n### 任务目标\n${requirements.taskGoals.map((item) => `- ${item}`).join("\n")}\n\n### 提交物\n${requirements.deliverables.map((item) => `- ${item}`).join("\n")}\n\n### 评分标准\n${requirements.scoringCriteria.map((item) => `- ${item}`).join("\n")}\n\n### 关键词与技术方向\n${requirements.keywords.join("、")}\n${requirements.technologyDirections.map((item) => `- ${item}`).join("\n")}\n\n## 推荐选题方向\n${report.topicDirections.map((item) => `### ${item.title}\n${item.reason}\n\n预期产出：${item.expectedOutput}`).join("\n\n")}\n\n## 技术路线\n${report.technicalRoute.map((item) => `- ${item}`).join("\n")}\n\n## 评分点对应建议\n${report.scoringSuggestions.map((item) => `- **${item.criterion}**：${item.action}`).join("\n")}\n\n## 创新点建议\n${report.innovationPoints.map((item) => `- ${item}`).join("\n")}\n\n## 备赛计划\n${report.plan.map((item) => `### ${item.phase}（${item.days}）\n${item.tasks.map((task) => `- ${task}`).join("\n")}`).join("\n\n")}\n\n## 参考文献\n${papers.map((paper) => `- [${paper.title}](${paper.url})（${paper.year}，${paper.authors.join("、")}）`).join("\n")}\n\n## 风险与注意事项\n${report.risks.map((item) => `- ${item}`).join("\n")}`;
}

function EvidenceLinks({ traceability, blockId }: { traceability: AnalysisResponse["traceability"]; blockId: string }) {
  const openEvidence = useEvidenceStore((state) => state.openEvidence);
  const ids = traceability?.links?.[blockId] ?? [];
  if (!ids.length) return <span className={styles.traceMissing}>待补充证据</span>;
  return <div className={styles.traceLinks}>{ids.map((id, index) => <span key={id}><Link href={"/?view=evidence&evidence=" + encodeURIComponent(id)} onClick={() => openEvidence(id)} className={styles.traceLink}><FileSearch size={12} />证据 {index + 1}</Link><VerificationActions id={"citation-" + id + "-" + blockId} subject={"证据与结论的关联：" + id + " / " + blockId} href={"/?view=evidence&evidence=" + encodeURIComponent(id)} /></span>)}</div>;
}

function PaperCard({ paper, traceability, index }: { paper: Paper; traceability: AnalysisResponse["traceability"]; index: number }) {
  return <article className={styles.card}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><BookOpen size={15} /></div><div className="min-w-0"><h4 className="text-[13px] font-bold leading-5 text-slate-800">{paper.title}</h4><p className="mt-1 text-[10px] text-slate-400">{paper.authors.slice(0, 3).join("、")} · {paper.year} · {paper.source}</p></div></div>
      <div className="shrink-0 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-center"><div className="text-[15px] font-bold text-emerald-700">{paper.relevanceScore}</div><div className="text-[9px] text-emerald-600">相关度</div></div>
    </div>
    <p className="mt-3 line-clamp-3 text-[11px] leading-5 text-slate-500"><VerificationText text={paper.abstract} /></p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1.5">{paper.matchedKeywords.slice(0, 3).map((keyword) => <span key={`${paper.id}-${keyword}`} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500">#{keyword}</span>)}</div><a className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800" href={paper.url} target="_blank" rel="noreferrer">查看来源<ExternalLink size={11} /></a></div>
    <EvidenceLinks traceability={traceability} blockId={"reference-" + index} />
  </article>;
}

function ReportPanel({ report, requirements, traceability }: { report: GuidanceReport; requirements: AnalysisResponse["requirements"]; traceability: AnalysisResponse["traceability"] }) {
  return <div className="space-y-4">
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex items-center gap-2 text-[12px] font-bold text-indigo-800"><Sparkles size={14} />参赛指导摘要</div><p className="mt-2 text-[12px] leading-6 text-indigo-900/75"><VerificationText text={report.overview} /></p><EvidenceLinks traceability={traceability} blockId="overview" /></div>
    <section className={styles.panel}><div className={styles.sectionTitle}><Target size={16} className="text-indigo-600" />推荐选题方向</div><div className="mt-4 space-y-3">{report.topicDirections.map((item, index) => <div key={item.title} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="text-[12px] font-bold text-slate-800">{item.title}</div><p className="mt-1 text-[11px] leading-5 text-slate-500"><VerificationText text={item.reason} /></p><div className="mt-2 text-[10px] font-semibold text-indigo-600">预期产出：{item.expectedOutput}</div><EvidenceLinks traceability={traceability} blockId={"topic-" + index} /></div>)}</div></section>
    <section className={styles.panel}><div className={styles.sectionTitle}><WandSparkles size={16} className="text-emerald-600" />技术路线</div><ol className="mt-4 space-y-2">{report.technicalRoute.map((item, index) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-slate-600"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">{index + 1}</span><div><VerificationText text={item} /><EvidenceLinks traceability={traceability} blockId={"route-" + index} /></div></li>)}</ol><div className="mt-3 flex flex-wrap gap-1.5">{requirements.technologyDirections.slice(0, 5).map((item) => <span key={item} className={styles.pill}><VerificationText text={item} /></span>)}</div></section>
    <section className={styles.panel}><div className={styles.sectionTitle}><FileCheck2 size={16} className="text-orange-500" />评分点对应建议</div><div className="mt-4 space-y-2">{report.scoringSuggestions.map((item, index) => <div key={item.criterion} className="rounded-xl border-l-2 border-orange-300 bg-orange-50/60 px-3 py-2.5"><div className="text-[11px] font-bold text-slate-800">{item.criterion}</div><div className="mt-1 text-[11px] leading-5 text-slate-600"><VerificationText text={item.action} /></div><EvidenceLinks traceability={traceability} blockId={"score-" + index} /></div>)}</div></section>
    <section className={styles.panel}><div className={styles.sectionTitle}><ScanText size={16} className="text-violet-600" />10 天 / 4 周计划</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{report.plan.map((item, index) => <div key={item.phase} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2"><div className="text-[11px] font-bold text-slate-800">{item.phase}</div><span className="text-[10px] text-indigo-600">{item.days}</span></div><ul className="mt-2 space-y-1">{item.tasks.map((task) => <li key={task} className="flex gap-1.5 text-[10px] leading-4 text-slate-500"><Check size={11} className="mt-0.5 shrink-0 text-emerald-500" /><VerificationText text={task} /></li>)}</ul><EvidenceLinks traceability={traceability} blockId={"plan-" + index} /></div>)}</div></section>
    <section className={styles.panel}><div className={styles.sectionTitle}><Lightbulb size={16} />创新点建议</div><div className={styles.reportList}>{report.innovationPoints.map((item, index) => <div key={index} className={styles.reportItem}><VerificationText text={item} /><EvidenceLinks traceability={traceability} blockId={"innovation-" + index} /></div>)}</div></section>
    <section className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4"><div className="flex items-center gap-2 text-[12px] font-bold text-rose-800"><AlertTriangle size={14} />风险与注意事项</div><ul className="mt-3 space-y-2">{report.risks.map((risk, index) => <li key={risk} className="flex gap-2 text-[11px] leading-5 text-rose-800/75"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-400" /><div><VerificationText text={risk} /><EvidenceLinks traceability={traceability} blockId={"risk-" + index} /></div></li>)}</ul></section>
  </div>;
}

export function CompetitionRequirements() {
  const project = useWorkspaceStore((state) => state.project);
  const selected = findCompetition(project?.selectedCompetitionId);
  const source = useCompetitionSource(project?.selectedCompetitionId || null, project?.selectedTrackId || null);
  const [sourceMode, setSourceMode] = useState<"supplement" | "override">("supplement");
  const profile = useWorkspaceStore((state) => state.project?.studentProfile);
  const [file, setFile] = useState<File | null>(null);
  const [major, setMajor] = useState(profile?.major || "");
  const [notes, setNotes] = useState("");
  const analysis = useAnalysis();
  const { result, busy } = analysis;
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const handoff = useWorkspaceStore((state) => state.pendingUpload);
  useEffect(() => {
    if (!handoff || handoff.target !== "requirements") return;
    queueMicrotask(() => {
      if (useWorkspaceStore.getState().pendingUpload?.id !== handoff.id) return;
      setFile(handoff.file); setError(null);
      useWorkspaceStore.getState().consumeUpload(handoff.id);
    });
  }, [handoff]);

  const chooseFile = (nextFile: File | null) => {
    if (!nextFile || busy) return;
    const accepted = /\.(pdf|doc|docx|png|jpe?g|webp)$/i.test(nextFile.name);
    if (!accepted) { setError("仅支持 PDF、Word（DOC/DOCX）或 PNG/JPG/WEBP 图片。"); return; }
    if (nextFile.size > 15 * 1024 * 1024) { setError("文件大小不能超过 15 MB。"); return; }
    setError(null); setFile(nextFile); analysis.reset();
  };
  const onInput = (event: ChangeEvent<HTMLInputElement>) => chooseFile(event.target.files?.[0] ?? null);
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(false); chooseFile(event.dataTransfer.files?.[0] ?? null); };

  const analyze = async () => {
    if (!file && !source.data?.source?.text) { setError("请先加载官方正文或上传补充资料。"); return; }
    setError(null);
    await analysis.start(file, major, notes, source.data?.source?.sourceId || null, sourceMode);
  };

  const copyReport = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(reportMarkdown(result));
    setError("报告 Markdown 已复制到剪贴板。");
    window.setTimeout(() => setError(null), 2200);
  };
  const downloadReport = () => {
    if (!result) return;
    const blob = new Blob([reportMarkdown(result)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${result.requirements.title || "比赛指导报告"}.md`; anchor.click(); URL.revokeObjectURL(url);
  };

  if (!selected || !project?.selectedTrackId) return <section className={styles.panel}><h2 className={styles.sectionTitle}>请先选择比赛和赛道</h2><p className="my-4 text-sm text-slate-500">比赛要求分析必须属于当前备赛项目和具体比赛。</p><Link href="/?view=competitions" className="text-sm text-indigo-600">去选择比赛 →</Link></section>;
  return <div className={styles.page}>
    <section className={styles.panel}><h2 className={styles.sectionTitle}>{selected.name}</h2><p className="mt-2 text-xs text-slate-500">项目：{project.name} · 赛道：<VerificationText text={selected.tracks.find((item) => item.trackId === project.selectedTrackId)?.name} href="/?view=requirements#source-verification" /> · <VerificationText text={verificationLabels[selected.verificationStatus]} href="/?view=requirements#source-verification" /></p><Link className="mt-3 inline-block text-xs text-indigo-600" href="/?view=competitions">更换比赛 / 确认赛道 →</Link></section>
    <CompetitionSourcePanel data={source.data} loading={source.loading} error={source.error} onVerify={source.verify} onReload={source.reload} />
    <section className={styles.panel}><label className={styles.label} htmlFor="source-mode">上传资料的使用方式</label><select id="source-mode" className={styles.field} value={sourceMode} onChange={(event) => setSourceMode(event.target.value as typeof sourceMode)}><option value="supplement">补充官方资料（保留两种来源）</option><option value="override">使用上传文件覆盖本次分析来源（需核实来源）</option></select><p className="mt-2 text-xs text-slate-500">没有上传文件时使用上方官方正文。覆盖不会把上传资料标为官方事实。</p></section>
    <RequirementCoverage />
    <section className={styles.hero}><div className="absolute -right-16 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" /><div className="absolute bottom-[-110px] left-[40%] h-64 w-64 rounded-full bg-violet-400/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end"><div><div className="mb-3 flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-400/15 px-3 py-1.5 text-[11px] font-semibold text-indigo-200"><FileSearch size={13} />比赛要求分析</span><span className="text-[11px] text-slate-400">多模态解析 · 论文检索 · 可追溯报告</span></div><h2 className="max-w-2xl text-[27px] font-semibold tracking-tight sm:text-[31px]">把一份比赛通知，变成<br /><span className="text-indigo-300">一套能拿分的参赛路线。</span></h2><p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-400">上传 PDF、Word 或图片，知策台会提取评分点、检索论文，并生成选题、技术路线、备赛计划和风险提醒。</p></div><div className="grid grid-cols-3 gap-2 sm:gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 sm:p-4"><div className="text-[10px] text-slate-400">解析层</div><div className="mt-2 text-[18px] font-semibold">OCR + 文本</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 sm:p-4"><div className="text-[10px] text-slate-400">检索层</div><div className="mt-2 text-[18px] font-semibold">论文排序</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 sm:p-4"><div className="text-[10px] text-slate-400">输出层</div><div className="mt-2 text-[18px] font-semibold">可执行报告</div></div></div></div></section>

    <section className={styles.panel}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className={styles.sectionTitle}><CloudUpload size={16} className="text-indigo-600" />上传比赛要求</div><p className="mt-1 text-[11px] text-slate-400">支持 PDF、DOC/DOCX、PNG、JPG、WEBP，单文件不超过 15 MB</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-semibold text-emerald-700"><Sparkles size={12} />后台 API 可配置</span></div><div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_.92fr]"><div><input ref={inputRef} disabled={busy} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" className="hidden" onChange={onInput} /><div role="button" aria-disabled={busy} tabIndex={busy ? -1 : 0} onClick={() => { if (!busy) inputRef.current?.click(); }} onKeyDown={(event) => { if (!busy && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={(event) => { event.preventDefault(); if (!busy) setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={onDrop} className={`flex min-h-[168px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 text-center transition ${isDragging ? "border-indigo-400 bg-indigo-50" : file ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30"}`}><div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${file ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"}`}>{file ? <FileText size={21} /> : <CloudUpload size={21} />}</div>{file ? <><div className="mt-3 text-[13px] font-bold text-slate-800">{file.name}</div><div className="mt-1 text-[10px] text-slate-500">{formatBytes(file.size)} · {busy ? "正在分析当前文件" : "点击可重新选择"}</div></> : <><div className="mt-3 text-[13px] font-bold text-slate-700">拖拽文件到这里，或点击选择</div><div className="mt-1 text-[10px] text-slate-400">建议上传包含完整评分细则和时间节点的原始通知</div></>}</div></div><div className="space-y-4"><div><label className={styles.label} htmlFor="analysis-major">你的专业</label><input id="analysis-major" value={major} disabled={busy} onChange={(event) => setMajor(event.target.value)} className={styles.field} placeholder="例如：计算机科学与技术" /></div><div><label className={styles.label} htmlFor="analysis-notes">补充说明（可选）</label><textarea id="analysis-notes" value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} className={`${styles.field} min-h-[76px] resize-y`} placeholder="例如：我们只有 2 人，擅长 Next.js，希望 10 天内完成演示" /></div><button type="button" onClick={() => void analyze()} disabled={(!file && !source.data?.source?.text) || busy || source.loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><WandSparkles size={15} />{busy ? "正在分析 · 可先阅读下方内容" : analysis.status === "error" || analysis.status === "cancelled" ? "重新分析这份文件" : result ? "重新分析这份文件" : "开始解析并生成指导"}</button></div></div>{error && <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] ${error.includes("已复制") ? "border border-emerald-100 bg-emerald-50 text-emerald-700" : "border border-rose-100 bg-rose-50 text-rose-700"}`}><AlertTriangle size={14} />{error}</div>}</section>

    {analysis.status !== "idle" && <AnalysisProgress status={analysis.status} steps={analysis.steps} preview={analysis.preview} logs={analysis.logs} error={analysis.error} elapsed={analysis.elapsed} quietSeconds={analysis.quietSeconds} onCancel={analysis.cancel} />}
    {!result && analysis.status !== "idle" && <AnalysisLiveResults preview={analysis.preview} busy={busy} warnings={analysis.warnings} />}

    {result && <section className={styles.panel}><h3 className={styles.sectionTitle}>报告归属与来源 · <VerificationText text={verificationLabels[result.binding?.verificationStatus || "pending"]} href="/?view=requirements#source-verification" /></h3><p className="mt-2 break-all text-xs leading-6 text-slate-500">项目：{result.projectId} · 比赛：{result.competitionId}<br />来源：{result.sourceId}<br />报告：{result.reportId}</p>{result.sources.map((item) => <p key={item.sourceId} className="mt-2 text-xs text-amber-700">{item.kind === "official" ? "官方来源正文" : "上传资料"} · {item.title} · <VerificationText text={verificationLabels[item.verificationStatus]} source={item.url || item.title} href={item.url || "/?view=requirements#source-verification"} /> {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-indigo-600">打开来源</a>}</p>)}<Link href="/?view=plan" className="mt-4 inline-block text-sm text-indigo-600">使用当前比赛编写计划书 →</Link></section>}
    {result && <section id="analysis-results" className="scroll-mt-24 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><FileCheck2 size={17} className="text-emerald-600" />分析结果已生成 <span className={result.mode === "ai" ? "rounded-full bg-indigo-50 px-2 py-1 text-[10px] text-indigo-700" : "rounded-full bg-orange-50 px-2 py-1 text-[10px] text-orange-700"}>{result.mode === "ai" ? "AI 结构化" : "离线演示"}</span></div><p className="mt-1 text-[11px] text-slate-400">{result.file.name} · {result.file.parser} · 已识别 {result.requirements.keywords.length} 个关键词</p></div><div className="flex flex-wrap items-center gap-2">{result.traceability && <Link href={"/reports/" + encodeURIComponent(result.traceability.reportId)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-indigo-700"><FileSearch size={13} />打开可溯源报告</Link>}<button type="button" onClick={() => void copyReport()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"><Clipboard size={13} />复制 Markdown</button><button type="button" onClick={downloadReport} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-indigo-700"><Download size={13} />导出 Markdown</button></div></div><div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-800"><span className="font-bold">AI 建议，仅供参考：</span>请在提交前以官方比赛通知为准，逐项人工核对截止时间、作品格式和评审规则。{result.warnings.length > 0 && <span className="ml-1"><VerificationText text={result.warnings[0]} /></span>}</div><div className="grid gap-5 xl:grid-cols-[minmax(0,1.04fr)_minmax(360px,.96fr)]"><div className="space-y-5"><section className={styles.panel}><div className="flex items-start justify-between gap-3"><div><div className={styles.sectionTitle}><FileCheck2 size={16} className="text-indigo-600" />结构化比赛要求</div><p className="mt-1 text-[11px] text-slate-400">从原始通知中抽取的可执行信息</p></div><span className={styles.pill}>{result.requirements.theme}</span></div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-[12px] leading-6 text-slate-600"><VerificationText text={result.requirements.summary} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><div className="mb-2 text-[11px] font-bold text-slate-700">任务目标</div><ul className="space-y-2">{result.requirements.taskGoals.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-slate-500"><Check size={12} className="mt-0.5 shrink-0 text-emerald-500" /><VerificationText text={item} /></li>)}</ul></div><div><div className="mb-2 text-[11px] font-bold text-slate-700">提交物</div><ul className="space-y-2">{result.requirements.deliverables.map((item) => <li key={item} className="flex gap-2 text-[11px] leading-5 text-slate-500"><Check size={12} className="mt-0.5 shrink-0 text-indigo-500" /><VerificationText text={item} /></li>)}</ul></div></div><div className="mt-4"><div className="mb-2 text-[11px] font-bold text-slate-700">关键词</div><div className="flex flex-wrap gap-1.5">{result.requirements.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">#{keyword}</span>)}</div></div><div className="mt-4"><div className="mb-2 text-[11px] font-bold text-slate-700">时间节点</div><div className="grid gap-2 sm:grid-cols-2">{result.requirements.timeline.map((item) => <div key={item.milestone} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-700"><span><VerificationText text={item.milestone} /></span><span className="text-indigo-600"><VerificationText text={item.date} /></span></div><div className="mt-1 text-[10px] leading-4 text-slate-500"><VerificationText text={item.description} /></div></div>)}</div></div></section><section><div className="mb-3 flex items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-[14px] font-bold text-slate-900"><BookOpen size={16} className="text-indigo-600" />相关论文 <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] text-indigo-700">{result.papers.length} 篇</span></div><p className="mt-1 text-[11px] text-slate-400">按关键词重合、摘要相似度、年份与引用数综合排序</p></div><span className="text-[10px] text-slate-400">来源：{result.papers[0]?.source || "本地缓存"}</span></div><div className="space-y-3">{result.papers.map((paper, index) => <PaperCard key={paper.id} paper={paper} traceability={result.traceability} index={index} />)}</div></section></div><ReportPanel report={result.report} requirements={result.requirements} traceability={result.traceability} /></div></section>}

    {!result && analysis.status === "idle" && <section className="grid gap-4 md:grid-cols-3"><div className={styles.panel}><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><ScanText size={17} /></div><div className="mt-3 text-[13px] font-bold text-slate-800">1. 文件解析</div><p className="mt-1 text-[11px] leading-5 text-slate-500">PDF / Word 直接提取文本，图片交给 OCR，保留解析方式和异常提示。</p></div><div className={styles.panel}><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><BookOpen size={17} /></div><div className="mt-3 text-[13px] font-bold text-slate-800">2. 证据检索</div><p className="mt-1 text-[11px] leading-5 text-slate-500">根据关键词检索论文，用摘要相似度、年份和引用数排序，展示来源链接。</p></div><div className={styles.panel}><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Lightbulb size={17} /></div><div className="mt-3 text-[13px] font-bold text-slate-800">3. 参赛指导</div><p className="mt-1 text-[11px] leading-5 text-slate-500">把评分点翻译成选题、路线、创新点和 10 天 / 4 周执行计划。</p></div></section>}
  </div>;
}
