"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExternalLink, ShieldCheck, X } from "lucide-react";
import { useWorkspaceStore, projectScopeKey } from "@/modules/workspace";
import { matchingRecord, safeVerificationHref, textFingerprint, verificationKey, verificationRecordSchema, type VerificationTask } from "./model";
import { useVerificationStore } from "./store";

export function VerificationActions({ id, subject, source = "", href, scope, label = "资料待补", onConfirm, interactive = false }: { id?: string; subject: string; source?: string; href?: string; scope?: string; label?: string; onConfirm?: () => void; interactive?: boolean }) {
  const project = useWorkspaceStore((state) => state.project);
  const taskScope = scope || projectScopeKey(project) || "shared";
  const task: VerificationTask = useMemo(() => ({ id: id || textFingerprint(subject), subject, scope: taskScope, fingerprint: textFingerprint(subject + source), source, href: safeVerificationHref(href || (source.startsWith("http") ? source : undefined)) }), [id, subject, taskScope, source, href]);
  const record = useVerificationStore((state) => matchingRecord(task, state.records));
  useEffect(() => { useVerificationStore.getState().register(task); }, [task]);
  const status = record?.outcome === "verified" ? "已核对" : record?.outcome === "conflict" ? "需修正" : label.replaceAll("待核验", "资料待补");
  return <span data-verification={record?.outcome === "verified" ? "confirmed" : "pending"} className="inline-flex max-w-full flex-wrap items-center gap-2 align-middle text-xs leading-6" title={subject}>
    <span className={record?.outcome === "verified" ? "text-emerald-700" : "text-amber-800"}>{status}</span>
    {interactive && <><Link href={task.href} target={/^https?:/.test(task.href) ? "_blank" : undefined} rel={/^https?:/.test(task.href) ? "noreferrer" : undefined} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-200 px-3 text-slate-700 hover:bg-slate-50"><ExternalLink size={13} />查看来源</Link><button type="button" className="min-h-11 rounded-lg border border-slate-200 px-3 text-slate-700 hover:bg-slate-50" onClick={() => onConfirm ? onConfirm() : useVerificationStore.getState().open(task)}>{record ? "修改核对记录" : "补充核对结果"}</button></>}
  </span>;
}

/** Adds field-scoped actions to pending markers in rendered prose, never inside inputs or links. */
export function VerificationText({ text, id, source, href, scope }: { text: string | null | undefined; id?: string; source?: string; href?: string; scope?: string }) {
  if (!text) return null;
  return <>{text.split(/(待核验)/g).map((part, index) => part === "待核验" ? <VerificationActions key={index} id={`${id || textFingerprint(text)}-${index}`} subject={text} source={source} href={href} scope={scope} /> : <Fragment key={index}>{part}</Fragment>)}</>;
}

export function VerificationProvider() {
  const task = useVerificationStore((state) => state.active);
  useEffect(() => { void useVerificationStore.persist.rehydrate(); }, []);
  return task ? <VerificationDialog key={verificationKey(task)} task={task} /> : null;
}
function VerificationDialog({ task }: { task: VerificationTask }) {
  const saved = useVerificationStore((state) => matchingRecord(task, state.records));
  const [value, setValue] = useState(saved?.value || "");
  const [outcome, setOutcome] = useState<"verified" | "pending" | "conflict">(saved?.outcome || "pending");
  const [reviewer, setReviewer] = useState(saved?.reviewer || "");
  const [source, setSource] = useState(saved?.source || task.source);
  const [note, setNote] = useState(saved?.note || "");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const owner = useWorkspaceStore((state) => state.project);
  const stale = task.scope !== "shared" && task.scope !== owner?.projectId && task.scope !== projectScopeKey(owner);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => previous?.focus(); }, []);
  const save = () => {
    if (stale) { setError("项目或赛道已切换，请返回对应项目再核验。"); return; }
    if (outcome !== "pending" && !note.trim()) { setError("通过或发现不符时，请补充核验说明。"); return; }
    const parsed = verificationRecordSchema.safeParse({ ...task, outcome, value, reviewer: reviewer.trim() || "当前用户", source: source.trim() || "用户补充记录", note: note.trim() || "当前仍缺少足够依据，后续需要继续补充。", confirmedAt: new Date().toISOString() });
    if (!parsed.success) { setError("请填写核验结果；通过或发现不符时，还需要来源和核验说明。"); return; }
    useVerificationStore.getState().confirm(parsed.data);
  };
  return <dialog ref={dialog} aria-labelledby="verification-title" onCancel={() => useVerificationStore.getState().close()} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/60">
    <div className="flex items-start justify-between gap-4"><h2 id="verification-title" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck size={20} className="text-emerald-700" />补充核验依据</h2><button type="button" aria-label="关闭核验" onClick={() => useVerificationStore.getState().close()} className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button></div>
    <p className="my-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6">{task.subject}</p>
    <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-4">
      <label className="block text-sm font-medium">核验结论<select aria-label="核验结论" value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal"><option value="pending">暂无法确认，继续补资料</option><option value="verified">已取得依据并核验通过</option><option value="conflict">发现不符，需要修正</option></select></label>
      <label className="block text-sm font-medium">核验结果<input required maxLength={2000} aria-label="核验结果" value={value} onChange={(event) => setValue(event.target.value)} placeholder="填写核实后的具体信息" className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
      <label className="block text-sm font-medium">来源链接或材料名称<span className="ml-2 text-xs font-normal text-slate-400">待补资料时可留空</span><input maxLength={2000} aria-label="核验来源" value={source} onChange={(event) => setSource(event.target.value)} placeholder="官方通知链接、文件与页码，或访谈记录名称" className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
      <label className="block text-sm font-medium">核验人<input maxLength={80} aria-label="核验人" value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="默认：当前用户" className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
      <label className="block text-sm font-medium">核验说明<span className="ml-2 text-xs font-normal text-slate-400">通过或发现不符时必填</span><textarea maxLength={3000} aria-label="核验说明" value={note} onChange={(event) => setNote(event.target.value)} placeholder="引用原句、页码或访谈结论，并说明适用范围" rows={3} className="mt-2 w-full rounded-lg border border-slate-300 p-3 font-normal" /></label>
      <p className="text-xs leading-6 text-slate-500">记录保存在当前浏览器，并关联当前项目与内容版本。保存记录不会自动核验其他资料。</p>
      {stale && <p role="alert" className="text-sm text-rose-700">项目或赛道已切换，请关闭弹窗并返回对应项目核验。</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-3"><button type="button" onClick={() => useVerificationStore.getState().close()} className="rounded-lg border border-slate-200 px-4 py-2">取消</button><button type="submit" disabled={Boolean(stale)} className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-40">保存补充记录</button></div>
    </form>
  </dialog>;
}

export function VerificationCenter() {
  const params = useSearchParams();
  const project = useWorkspaceStore((state) => state.project);
  const tasks = useVerificationStore((state) => state.tasks);
  const records = useVerificationStore((state) => state.records);
  const scope = projectScopeKey(project) || "shared";
  const requested = params.get("item");
  const current = Object.entries(tasks).filter(([, task]) => task.scope === scope || task.scope === project?.projectId).sort(([a], [b]) => Number(b === requested) - Number(a === requested));
  const selected = useRef<HTMLElement>(null);
  useEffect(() => { if (requested) { selected.current?.scrollIntoView({ block: "center" }); selected.current?.focus(); } }, [requested]);
  const history = Object.entries(records).filter(([key, task]) => !tasks[key] && (task.scope === scope || task.scope === project?.projectId));
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900"><h2 className="text-xl font-bold">来源与核对记录</h2><p className="mt-2 text-sm leading-7 text-slate-500">在这里集中查看资料缺口和来源，必要时补充核对结果。历史记录会随项目保留。</p><div className="mt-5 space-y-4">{!current.length && <p className="text-sm text-slate-500">暂未登记额外的来源核对事项，材料完整性请查看上方检查清单。</p>}{current.map(([key, task]) => <article ref={key === requested ? selected : undefined} tabIndex={key === requested ? -1 : undefined} key={key} id={encodeURIComponent(key)} className={"rounded-xl border p-4 " + (key === requested ? "border-sky-400 bg-sky-50" : "border-slate-200")}><p className="mb-3 whitespace-pre-wrap text-sm leading-7">{task.subject}</p><VerificationActions {...task} interactive />{records[key] && <div className="mt-3 text-xs leading-6 text-slate-600"><p>结果：{records[key].value}</p><p>来源：{records[key].source}</p><p>说明：{records[key].note}</p><p>{records[key].reviewer} · {new Date(records[key].confirmedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</p><button type="button" className="mt-2 text-rose-700 underline" onClick={() => useVerificationStore.getState().revoke(key)}>撤销本条确认</button></div>}</article>)}</div>{history.length > 0 && <details className="mt-6 text-sm"><summary className="cursor-pointer font-semibold">旧内容的核验历史（{history.length}）</summary>{history.map(([key, record]) => <article key={key} className="mt-3 rounded-xl bg-slate-50 p-4 text-xs leading-6"><p>{record.subject}</p><p>{record.value} · {record.reviewer} · {record.confirmedAt}</p><p>来源：{record.source}</p><p>{record.note}</p></article>)}</details>}</section>;
}
