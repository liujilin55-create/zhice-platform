"use client";

import { VerificationText } from "@/modules/verification";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AlertTriangle, Bot, Check, CheckCircle2, ChevronDown, ClipboardCheck, Clock3, Download, FileCheck2, FileText, Info, Layers3, RefreshCw, RotateCcw, ShieldCheck, Sparkles, UploadCloud, XCircle } from "lucide-react";
import { initialCheckItems, initialHistory } from "./data";
import { deliverableStyles as styles } from "./deliverable-check.styles";
import type { CheckItem, CheckStatus, DeliverableKind, DeliverableRecord } from "./types";

type SelectedFile = { name: string; sizeBytes: number; kind: DeliverableKind };
type RunState = "idle" | "running" | "complete";

const maxFileSize = 50 * 1024 * 1024;
const acceptedExtensions = [".pptx", ".pdf", ".docx", ".zip", ".png", ".jpg", ".jpeg", ".webp"];

function formatSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function kindFromName(name: string): DeliverableKind | null {
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (extension === ".pptx") return "PPTX";
  if (extension === ".pdf") return "PDF";
  if (extension === ".docx") return "DOCX";
  if (extension === ".zip") return "ZIP";
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) return "IMAGE";
  return null;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "pass") return <CheckCircle2 size={17} className="text-emerald-500" />;
  if (status === "warning") return <AlertTriangle size={17} className="text-orange-500" />;
  if (status === "fail") return <XCircle size={17} className="text-rose-500" />;
  return <span className="h-4 w-4 animate-pulse rounded-full bg-slate-200" />;
}

function StatusLabel({ status }: { status: CheckStatus }) {
  const content = status === "pass" ? ["通过", "bg-emerald-50 text-emerald-700"] : status === "warning" ? ["警告", "bg-orange-50 text-orange-700"] : status === "fail" ? ["失败", "bg-rose-50 text-rose-700"] : ["检查中", "bg-slate-100 text-slate-500"];
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${content[1]}`}>{content[0]}</span>;
}

function HistoryStatus({ status }: { status: DeliverableRecord["status"] }) {
  return <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${status === "ready" ? "bg-emerald-50 text-emerald-700" : status === "warning" ? "bg-orange-50 text-orange-700" : "bg-rose-50 text-rose-700"}`}>{status === "ready" ? "可提交" : status === "warning" ? "需优化" : "未通过"}</span>;
}

export function DeliverableCheck() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [items, setItems] = useState<CheckItem[]>(initialCheckItems);
  const [history, setHistory] = useState<DeliverableRecord[]>(initialHistory);
  const [runState, setRunState] = useState<RunState>("idle");
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState<string | null>("format");
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const score = useMemo(() => Math.round(items.reduce((total, item) => total + item.score, 0) / items.reduce((total, item) => total + item.maxScore, 0) * 100), [items]);
  const counts = useMemo(() => ({ pass: items.filter((item) => item.status === "pass").length, warning: items.filter((item) => item.status === "warning").length, fail: items.filter((item) => item.status === "fail").length }), [items]);
  const readiness = score >= 90 ? "可以提交" : score >= 75 ? "建议优化后提交" : "暂不建议提交";

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const acceptFile = (file: File) => {
    const kind = kindFromName(file.name);
    setError(null);
    if (!kind) {
      setError("暂不支持该格式，请上传 PPTX、PDF、DOCX、ZIP 或图片文件。");
      return;
    }
    if (file.size > maxFileSize) {
      setError("文件超过 50 MB，请压缩文件或拆分后重新上传。");
      return;
    }
    setFile(file);
    setSelectedFile({ name: file.name, sizeBytes: file.size, kind });
    setRunState("idle");
    setProgress(0);
    setItems(initialCheckItems.map((item) => ({ ...item, status: "pending" })));
    notify(`已接收「${file.name}」，可以开始检查`);
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) acceptFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const runCheck = async () => {
    if (!selectedFile || !file) {
      setError("请先上传一个交付文件。");
      return;
    }
    if (runState === "running") return;
    setError(null);
    setRunState("running");
    setProgress(8);
    setItems(initialCheckItems.map((item) => ({ ...item, status: "pending" })));
    for (const step of [22, 39, 57, 74, 88, 100]) {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      setProgress(step);
    }
    const body = new FormData();
    body.append("file", file);
    let resultScore = score;
    try {
      const response = await fetch("/api/deliverable-check", { method: "POST", body });
      const payload = await response.json() as { ok?: boolean; error?: string; items?: CheckItem[]; score?: number; mode?: "ai" | "demo" };
      if (!response.ok || !payload.ok || !Array.isArray(payload.items)) throw new Error(payload.error || "成果检查服务暂时不可用。");
      setItems(payload.items);
      resultScore = typeof payload.score === "number" ? payload.score : score;
      if (payload.mode === "demo") notify("检查完成，当前使用离线规则结果");
    } catch (requestError) {
      setItems(initialCheckItems);
      notify(requestError instanceof Error ? "服务暂时不可用，已使用本地检查结果" : "已使用本地检查结果");
    }
    setRunState("complete");
    const record: DeliverableRecord = { id: `history-${Date.now()}`, name: selectedFile.name, kind: selectedFile.kind, size: formatSize(selectedFile.sizeBytes), checkedAt: "刚刚", score: resultScore, status: resultScore >= 90 ? "ready" : resultScore >= 75 ? "warning" : "failed", itemCount: initialCheckItems.length };
    setHistory((current) => [record, ...current].slice(0, 5));
    notify("检查完成，已生成可执行的修复建议");
  };

  const exportReport = () => {
    if (!selectedFile) {
      setError("请先选择一个已经检查过的文件。");
      return;
    }
    const markdown = [`# 成果检查报告`, ``, `文件：${selectedFile.name}`, `检查结论：${readiness}（${score}/100）`, ``, ...items.map((item) => `## ${item.title}\n- 状态：${item.status === "pass" ? "通过" : item.status === "warning" ? "警告" : "失败"}\n- 证据：${item.evidence}${item.suggestion ? `\n- 建议：${item.suggestion}` : ""}`), ``, `> AI 建议，仅供参考。最终提交请以比赛官方要求和人工复核为准。`].join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedFile.name.replace(/\.[^.]+$/, "")}-检查报告.md`;
    link.click();
    URL.revokeObjectURL(url);
    notify("检查报告已导出");
  };

  const reset = () => {
    setFile(null);
    setSelectedFile(null);
    setItems(initialCheckItems);
    setProgress(0);
    setRunState("idle");
    setError(null);
  };

  return <div className={styles.page}>
    <section className="relative overflow-hidden rounded-[24px] bg-[#18213a] px-6 py-7 text-white shadow-xl shadow-indigo-950/10 sm:px-8"><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" /><div className="absolute bottom-[-90px] left-[45%] h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center"><div><div className="mb-3 flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200"><ClipboardCheck size={13} />成果检查</span><span className="text-[11px] text-slate-400">提交前质量门禁 · 证据覆盖 · 风险提示</span></div><h2 className="max-w-2xl text-[28px] font-semibold tracking-tight sm:text-[31px]">让每个评分点，都有证据、有成果、有下一步。</h2><p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-400">上传最终交付物，知策台会按文件完整性、评分覆盖、可信度、AI 能力和交付准备度做一次可追溯检查。</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-900 hover:bg-indigo-50"><UploadCloud size={15} className="text-indigo-600" />上传交付物<ChevronDown size={14} className="-rotate-90" /></button><button type="button" onClick={exportReport} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-[12px] font-semibold text-slate-200 hover:bg-white/10"><Download size={15} />导出检查报告</button></div></div><div className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="relative flex h-28 w-28 items-center justify-center"><svg className="h-full w-full -rotate-90" viewBox="0 0 112 112"><circle cx="56" cy="56" r="43" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="9" /><circle cx="56" cy="56" r="43" fill="none" stroke="#34d399" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 43}`} strokeDashoffset={`${2 * Math.PI * 43 * (1 - score / 100)}`} /></svg><div className="absolute text-center"><div className="text-2xl font-bold">{score}</div><div className="text-[10px] text-slate-400">总分 / 100</div></div></div><div className="min-w-[130px]"><div className="text-[11px] text-slate-400">当前结论</div><div className="mt-2 text-[17px] font-semibold text-emerald-300">{readiness}</div><div className="mt-2 text-[10px] text-slate-400">{counts.pass} 项通过 · {counts.warning} 项警告</div></div></div></div></section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <section className={styles.panel}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className={styles.sectionTitle}><Layers3 size={16} className="text-indigo-600" />上传并运行检查</div><p className="mt-1 text-[11px] text-slate-400">支持 PPTX、PDF、DOCX、ZIP 和 PNG/JPG/WebP，单文件不超过 50 MB。</p></div>{selectedFile && <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-50"><RotateCcw size={12} />重新选择</button>}</div><input ref={inputRef} type="file" accept={acceptedExtensions.join(",")} className="hidden" onChange={handleInput} /><div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => inputRef.current?.click()} className={`mt-4 cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-indigo-400 bg-indigo-50" : selectedFile ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/40"}`}><div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${selectedFile ? "bg-emerald-100 text-emerald-600" : "bg-indigo-100 text-indigo-600"}`}>{selectedFile ? <FileCheck2 size={23} /> : <UploadCloud size={23} />}</div>{selectedFile ? <><div className="mt-3 text-[13px] font-bold text-slate-800">{selectedFile.name}</div><div className="mt-1 text-[10px] text-slate-500">{selectedFile.kind} · {formatSize(selectedFile.sizeBytes)} · 点击更换文件</div></> : <><div className="mt-3 text-[13px] font-bold text-slate-800">拖放交付文件到这里</div><div className="mt-1 text-[10px] text-slate-500">或点击选择文件，检查过程会保留在当前页面</div></>}</div>{error && <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700"><XCircle size={14} />{error}</div>}{selectedFile && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-indigo-600"><FileText size={15} /></span><div><div className="text-[11px] font-semibold text-slate-700">检查对象已就绪</div><div className="mt-0.5 text-[10px] text-slate-400">将检查 8 个维度并给出修复建议</div></div></div><button type="button" disabled={runState === "running"} onClick={(event) => { event.stopPropagation(); void runCheck(); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-[11px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">{runState === "running" ? <><RefreshCw size={13} className="animate-spin" />检查中 {progress}%</> : runState === "complete" ? <><Check size={13} />重新检查</> : <><Sparkles size={13} />开始检查</>}</button></div>}{runState === "running" && <div className="mt-4"><div className="mb-1.5 flex justify-between text-[10px] text-slate-400"><span>正在读取文件、匹配评分点并核验引用…</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} /></div></div>}</section>

        <section className={styles.panel}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className={styles.sectionTitle}><ShieldCheck size={16} className="text-emerald-600" />检查结果</div><p className="mt-1 text-[11px] text-slate-400">每一项都能展开查看证据与下一步建议。</p></div><div className="flex items-center gap-2 text-[10px]"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{counts.pass} 通过</span><span className="rounded-full bg-orange-50 px-2 py-1 font-semibold text-orange-700">{counts.warning} 警告</span><span className="rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700">{counts.fail} 失败</span></div></div><div className="mt-4 space-y-2">{items.map((item) => <div key={item.id} className={`overflow-hidden rounded-xl border ${item.status === "fail" ? "border-rose-100" : item.status === "warning" ? "border-orange-100" : "border-slate-100"}`}><button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"><StatusIcon status={item.status} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-semibold text-slate-800">{item.title}</span><span className="text-[10px] text-slate-400">{item.category}</span>{item.automated && <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">自动</span>}</div><div className="mt-1 line-clamp-1 text-[10px] text-slate-500">{item.description}</div></div><div className="flex shrink-0 items-center gap-3"><span className="text-[11px] font-bold text-slate-600">{item.score}/{item.maxScore}</span><StatusLabel status={item.status} /><ChevronDown size={14} className={`text-slate-400 transition ${expanded === item.id ? "rotate-180" : ""}`} /></div></button>{expanded === item.id && <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3"><div className="grid gap-3 md:grid-cols-[1fr_1fr]"><div><div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-700"><Info size={12} className="text-indigo-500" />检查证据</div><p className="text-[11px] leading-5 text-slate-500">{item.evidence}</p></div>{item.suggestion && <div><div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold text-slate-700"><Sparkles size={12} className="text-orange-500" />修复建议</div><p className="text-[11px] leading-5 text-slate-500"><VerificationText text={item.suggestion} /></p></div>}</div></div>}</div>)}</div><div className="mt-4 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-[10px] leading-4 text-indigo-800"><Bot size={14} className="mt-0.5 shrink-0 text-indigo-600" /><span>AI 建议，仅供参考。最终提交请以比赛官方要求、团队人工复核和实际打开测试为准。</span></div></section>
      </div>

      <aside className="space-y-5"><section className={styles.panel}><div className={styles.sectionTitle}><FileCheck2 size={16} className="text-indigo-600" />提交前清单</div><div className="mt-4 space-y-2.5">{["最终文件可打开", "评分点都有对应页面", "引用包含来源和链接", "演示路径可在 3 分钟内走完", "API 未配置时有离线兜底"].map((text, index) => <div key={text} className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${index < 3 ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"}`}>{index < 3 ? <Check size={11} /> : <Clock3 size={11} />}</span><span className="text-[11px] text-slate-600">{text}</span></div>)}</div><button type="button" onClick={exportReport} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-[11px] font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600"><Download size={14} />导出当前检查报告</button></section><section className={styles.panel}><div className="flex items-center justify-between"><div className={styles.sectionTitle}><Clock3 size={16} className="text-violet-600" />检查历史</div><span className="text-[10px] text-slate-400">最近 5 次</span></div><div className="mt-4 space-y-2">{history.map((record) => <div key={record.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start gap-2"><FileText size={14} className="mt-0.5 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-slate-700">{record.name}</div><div className="mt-1 flex items-center justify-between text-[10px] text-slate-400"><span>{record.checkedAt} · {record.size}</span><strong className="text-slate-700">{record.score} 分</strong></div></div></div><div className="mt-2 flex items-center justify-between"><HistoryStatus status={record.status} /><span className="text-[10px] text-slate-400">{record.itemCount} 项检查</span></div></div>)}</div></section><section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex items-center gap-2 text-[12px] font-bold text-indigo-900"><Bot size={15} className="text-indigo-600" />API 配置预留</div><p className="mt-2 text-[10px] leading-5 text-indigo-900/70">当前使用本地演示检查器。后续接入模型时，将检查文件摘要、评分细则和证据中心内容发送到服务端接口即可。</p><div className="mt-3 rounded-lg bg-white/70 px-2.5 py-2 font-mono text-[10px] text-indigo-700">POST /api/deliverable-check</div></section></aside>
    </section>
    {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2.5 text-[11px] font-medium text-white shadow-xl"><Check size={13} className="mr-1.5 inline text-emerald-400" />{toast}</div>}
  </div>;
}
