"use client";

import { preparationNeedsReview } from "@/modules/preparation/domain";
import { VerificationActions, VerificationText } from "@/modules/verification";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, LoaderCircle, Plus, Presentation, Trash2 } from "lucide-react";
import { useWorkspaceStore, projectScopeKey, projectBinding } from "@/modules/workspace";
import { useProjectPlanStore, savePlanDocument } from "@/modules/project-plan";
import { sameBinding } from "@/shared/contracts/competition-binding";
import { confirmedBlocks } from "@/shared/contracts/plan-document";
import { TemplateSelector } from "@/modules/campus-catalog";
import { templateOptions, pageRangeOptions } from "./data";
import { usePptWorkspaceStore } from "./ppt-workspace.store";
import { checkPlanOutline, traceOutline } from "./plan-outline";
import { analyzeDocx, analyzePlan, getPptHistory, inspectOutline, renderOutline } from "./services/ppt-api";
import type { ParsedDocx, PlanPptOptions, PptHistoryEntry, PptOutline, PptSlide, PptTemplate } from "./types";

const field = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400";
const button = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-40";
const primary = button + " border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-500";
const panel = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
type Stage = "idle" | "saving" | "planning" | "draft" | "rendering" | "done";

function SlideEditor({ slide, index, total, scopeKey, disabled, onChange, onDelete, onMove }: { slide: PptSlide; index: number; total: number; scopeKey: string; disabled: boolean; onChange: (patch: Partial<PptSlide>) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  return <article className={panel} aria-label={`第 ${index + 1} 页编辑器`}>
    <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-indigo-600">{String(index + 1).padStart(2, "0")}</span><div className="flex gap-1"><button type="button" className={button} aria-label="上移页面" disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp size={14} /></button><button type="button" className={button} aria-label="下移页面" disabled={disabled || index === total - 1} onClick={() => onMove(1)}><ArrowDown size={14} /></button><button type="button" className={button} aria-label="删除页面" disabled={disabled || total <= 5} onClick={onDelete}><Trash2 size={14} /></button></div></div>
    <label className="mt-3 block text-xs text-slate-500">页面类型<select aria-label={`第 ${index + 1} 页布局`} className={field} value={slide.layout} disabled={disabled} onChange={(e) => onChange({ layout: e.target.value as PptSlide["layout"] })}>{[["cover","封面"],["agenda","目录"],["content","自动匹配内容"],["problem","问题"],["data","数据图表"],["solution","方案"],["process","流程"],["architecture","架构"],["business","商业模式"],["team","团队"],["plan","计划"],["section","章节"],["closing","结尾"]].map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <input className={field + " font-semibold"} aria-label={`第 ${index + 1} 页标题`} value={slide.title} disabled={disabled} onChange={(event) => onChange({ title: event.target.value })} />
    <div className="mt-3 space-y-3">{slide.bullets.map((text, bulletIndex) => { const claim = slide.claims?.[bulletIndex]; return <div key={bulletIndex}>
      <div className="flex gap-2"><textarea aria-label={`第 ${index + 1} 页要点 ${bulletIndex + 1}`} className={field + " mt-0 min-h-16 resize-y text-xs leading-6"} value={text} disabled={disabled} onChange={(event) => onChange({ bullets: slide.bullets.map((value, position) => position === bulletIndex ? event.target.value : value) })} /><button type="button" aria-label={`删除第 ${index + 1} 页要点 ${bulletIndex + 1}`} className="text-xs text-slate-400" disabled={disabled || slide.bullets.length === 1} onClick={() => onChange({ bullets: slide.bullets.filter((_, position) => position !== bulletIndex) })}>删除</button></div>
      <p className={`mt-1 text-[11px] ${claim?.confirmed ? "text-emerald-700" : "text-amber-700"}`}>{claim?.confirmed ? claim.origin === "user" ? "用户修改 · 已确认原文" : "AI 生成 · 用户已确认" : <VerificationActions id={`ppt-${slide.id}-${bulletIndex}`} subject={text} href="/?view=plan" />}{claim?.evidenceIds.length ? " · 证据 " + claim.evidenceIds.join("、") : " · 未关联证据"}</p>
    </div>; })}</div>
    <button type="button" className="mt-3 text-xs font-semibold text-indigo-600 disabled:opacity-40" disabled={disabled || slide.bullets.length >= 5} onClick={() => onChange({ bullets: [...slide.bullets, "【建议补充】填写有原文支持的要点"] })}>+ 增加要点</button>
    <label className="mt-4 block text-xs text-slate-500">演讲者备注<textarea aria-label={`第 ${index + 1} 页演讲备注`} className={field + " min-h-24 text-xs leading-6"} value={slide.speakerNotes} disabled={disabled} onChange={(event) => onChange({ speakerNotes: event.target.value })} /></label>
    <div className="mt-3 flex flex-wrap gap-2">{slide.chapterIds?.map((chapterId) => <Link key={chapterId} href={`/?view=plan&chapter=${encodeURIComponent(chapterId)}&scope=${encodeURIComponent(scopeKey)}`} className="text-xs font-semibold text-indigo-600 underline">回到计划书 / Word 章节：{chapterId}</Link>)}</div>
  </article>;
}

export function PptGenerator() {
  const params = useSearchParams(); const project = useWorkspaceStore((state) => state.project);
  const scopeKey = projectScopeKey(project); const projectId = project?.projectId;
  const storedPlan = useProjectPlanStore((state) => state.document);
  const plan = storedPlan && sameBinding(storedPlan.binding, projectBinding(project)) ? storedPlan : null;
  const [saved] = useState(() => scopeKey ? usePptWorkspaceStore.getState().byProject[scopeKey] : undefined);
  const [source, setSource] = useState<"plan" | "docx">(() => params.get("source") === "plan" || saved?.outline?.planSource ? "plan" : plan ? "plan" : "docx");
  const [file, setFile] = useState<File | null>(null); const inputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<ParsedDocx | null>(saved?.document || null);
  const [outline, setOutline] = useState<PptOutline | null>(saved?.outline || null);
  const [template, setTemplate] = useState<PptTemplate>(saved?.template || "zhice-dark");
  const [pageRange, setPageRange] = useState<(typeof pageRangeOptions)[number]["value"]>(saved?.pageRange || "8-10");
  const [options, setOptions] = useState<PlanPptOptions>(() => ({ durationMinutes: Math.max(3, Math.min(30, Number(params.get("minutes")) || saved?.planOptions?.durationMinutes || 8)), pages: Math.max(8, Math.min(15, Number(params.get("pages")) || saved?.planOptions?.pages || 12)), focus: params.get("focus") === "technical" ? "technical" : params.get("focus") === "story" ? "story" : saved?.planOptions?.focus || "evidence" }));
  const [stage, setStage] = useState<Stage>(saved?.latest ? "done" : saved?.outline ? "draft" : "idle");
  const [latest, setLatest] = useState<PptHistoryEntry | null>(saved?.latest || null); const [history, setHistory] = useState<PptHistoryEntry[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]); const [error, setError] = useState<string | null>(null); const [humanConfirmed, setHumanConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null); const autoStarted = useRef(false);
  const busy = ["saving", "planning", "rendering"].includes(stage);
  const preparationStale = Boolean(plan && project && preparationNeedsReview(plan, project.preparation, project.studentProfile));
  const stale = preparationStale || Boolean(outline?.planSource && (!plan || outline.planSource.version !== plan.version || outline.planSource.documentId !== plan.documentId));
  const displayOutline = useMemo(() => outline?.planSource && plan ? traceOutline(outline, plan) : outline, [outline, plan]);
  const checks = useMemo(() => outline?.planSource && plan ? checkPlanOutline(outline, plan) : [], [outline, plan]);
  const errors = checks.filter((check) => check.severity === "error");
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (scopeKey) usePptWorkspaceStore.getState().save(scopeKey, { document, outline, template, pageRange, style: options.focus, latest, planOptions: options, requestKey: params.get("request") || undefined }); }, [scopeKey, document, outline, template, pageRange, options, latest, params]);
  useEffect(() => { if (!projectId) return; const abort = new AbortController(); void getPptHistory(projectId, scopeKey, abort.signal).then((result) => setHistory(result.history)).catch(() => undefined); return () => abort.abort(); }, [projectId, scopeKey]);

  const generate = useCallback(async () => {
    if (!projectId || !project) return; if (source === "plan" && preparationStale) { setError("项目定位或资源已变化，请返回计划书更新问卷并重新确认章节。"); return; } if (source === "plan" && (!plan || !confirmedBlocks(plan).length)) { setError("请先确认当前计划书的至少一个有效章节。"); return; }
    if (source === "docx" && !file) { setError("请先上传 .docx 文件。"); return; }
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setError(null); setWarnings([]); setHumanConfirmed(false); setLatest(null);
    const activity = useWorkspaceStore.getState().beginActivity({ kind: "ppt", title: source === "plan" ? "从已确认计划书生成 PPT 大纲" : "解析 DOCX 并生成大纲", detail: project.name, href: "/?view=ppt" });
    try {
      let nextOutline: PptOutline; let nextWarnings: string[];
      if (source === "plan" && plan) {
        setStage("saving"); const savedDocument = await savePlanDocument(plan, abort.signal); setStage("planning");
        const result = await analyzePlan(projectId, savedDocument.reference, options, abort.signal, template); nextOutline = result.outline; nextWarnings = result.warnings; setDocument(null);
      } else {
        setStage("planning"); const body = new FormData(); body.append("projectId", projectId); body.append("file", file!); body.append("pageRange", pageRange); body.append("template", template); body.append("style", options.focus);
        const result = await analyzeDocx(body, abort.signal); nextOutline = result.outline; nextWarnings = result.warnings; setDocument(result.document);
      }
      if (abort.signal.aborted || projectScopeKey(useWorkspaceStore.getState().project) !== scopeKey) return;
      setOutline(nextOutline); setWarnings(nextWarnings); setStage("draft"); useWorkspaceStore.getState().setAssetStatus("pptStatus", "draft", projectId, projectBinding(project) || undefined);
      useWorkspaceStore.getState().finishActivity(activity, { status: "success", title: "PPT 大纲已生成，等待人工确认", detail: `${nextOutline.slides.length} 页` });
    } catch (failure) { useWorkspaceStore.getState().finishActivity(activity, { status: abort.signal.aborted ? "warning" : "error", detail: "大纲生成停止，可保留材料重试。" }); if (!abort.signal.aborted) { setError(failure instanceof Error ? failure.message : "生成失败，请重试。"); setStage("idle"); } }
  }, [projectId, project, source, plan, file, options, pageRange, template, scopeKey, preparationStale]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled && !autoStarted.current && params.get("source") === "plan" && plan) { autoStarted.current = true; if (!outline?.planSource || stale || params.get("request") && params.get("request") !== saved?.requestKey) void generate(); } });
    return () => { cancelled = true; };
  }, [params, plan, outline, stale, generate, saved?.requestKey]);

  const edit = (update: (current: PptOutline) => PptOutline) => { setOutline((current) => current ? update(current) : null); setHumanConfirmed(false); setLatest(null); setStage("draft"); };
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => { const next = event.target.files?.[0]; if (!next) return; if (!next.name.toLowerCase().endsWith(".docx") || next.size > 15 * 1024 * 1024) { setError("仅支持 15 MB 以内的 .docx 文件。"); return; } setSource("docx"); setFile(next); setOutline(null); setDocument(null); setHumanConfirmed(false); setStage("idle"); };
  const render = async () => {
    if (!displayOutline || !projectId || !humanConfirmed || stale || errors.length) return;
    const abort = new AbortController(); controller.current = abort; setStage("rendering"); setError(null);
    try {
      if (displayOutline.planSource && plan) { await savePlanDocument(plan, abort.signal); await inspectOutline(projectId, displayOutline, abort.signal); }
      const result = await renderOutline(projectId, displayOutline, template, displayOutline.planSource ? plan?.title || "网页计划书" : document?.fileName || file?.name || "外部 DOCX", humanConfirmed, abort.signal, projectBinding(project) || undefined);
      if (abort.signal.aborted || projectScopeKey(useWorkspaceStore.getState().project) !== scopeKey) return;
      setLatest(result.history); setHistory((items) => [result.history, ...items.filter((item) => item.id !== result.history.id)]); setWarnings(result.warnings); setStage("done"); useWorkspaceStore.getState().setAssetStatus("pptStatus", "exported", projectId, projectBinding(project) || undefined);
    } catch (failure) { if (!abort.signal.aborted) { setError(failure instanceof Error ? failure.message : "PPTX 导出失败。"); setStage("draft"); setHumanConfirmed(false); } }
  };

  return <div className="space-y-5 pb-10">
    <header className="rounded-3xl bg-[#18213a] p-7 text-white"><p className="text-xs font-bold tracking-[.2em] text-indigo-300">PLAN → OUTLINE → EDITABLE PPTX</p><h2 className="mt-3 text-3xl font-semibold">从已确认的计划书，直接走向答辩。</h2><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">选择原文、编辑大纲、核对一致性，再由你确认导出。网页计划书无需重新上传 DOCX，每页保留章节和证据关联。</p></header>
    <section className={panel}><div className="flex flex-wrap gap-2"><button type="button" className={source === "plan" ? primary : button} disabled={busy} onClick={() => { if (source !== "plan") { setOutline(null); setLatest(null); setStage("idle"); } setSource("plan"); setHumanConfirmed(false); }}>当前网页计划书</button><button type="button" className={source === "docx" ? primary : button} disabled={busy} onClick={() => { if (source !== "docx") { setOutline(null); setLatest(null); setStage("idle"); } setSource("docx"); setHumanConfirmed(false); }}>上传外部 DOCX（兼容入口）</button></div>
      {source === "plan" ? <div className="mt-4 rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">{plan ? <><strong>{plan.title}</strong><p className="mt-2 text-xs">项目：{plan.projectName} · v{plan.version} · {plan.chapters.filter((chapter) => chapter.confirmed).length}/{plan.chapters.length} 章已确认</p><p className="mt-2 text-xs leading-6 text-amber-700">未确认章节、建议补充和未核实的推断不作为事实引用。缺失部分会保留明确占位。</p></> : <p>当前项目还没有可用计划书。<Link href="/?view=plan" className="ml-2 underline">去编写并确认章节</Link></p>}</div> : <div className="mt-4"><input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={chooseFile} /><button type="button" disabled={busy} className={button + " min-h-24 w-full border-dashed"} onClick={() => inputRef.current?.click()}>{file?.name || "点击选择 Word 文档（.docx，最多 15 MB）"}</button>{document && <p className="mt-2 text-xs text-slate-500">已解析 {document.headings.length} 个标题、{document.paragraphs.length} 段正文；外部资料需人工核对。</p>}</div>}
      <fieldset disabled={busy} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs text-slate-500">模板<select aria-label="PPT模板" className={field} value={template} onChange={(event) => { setTemplate(event.target.value as PptTemplate); setHumanConfirmed(false); }}>{template.startsWith("tpl-") && <option value={template}>已选择来源登记模板</option>}{templateOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="text-xs text-slate-500">答辩时长<select aria-label="PPT答辩时长" className={field} value={options.durationMinutes} onChange={(event) => { setOptions({ ...options, durationMinutes: Number(event.target.value) }); setHumanConfirmed(false); }}>{[5, 8, 10, 15, 20].map((minutes) => <option key={minutes} value={minutes}>{minutes} 分钟</option>)}</select></label>{source === "plan" ? <label className="text-xs text-slate-500">目标页数<input aria-label="PPT目标页数" type="number" min={8} max={15} className={field} value={options.pages} onChange={(event) => { setOptions({ ...options, pages: Math.max(8, Math.min(15, Number(event.target.value))) }); setHumanConfirmed(false); }} /></label> : <label className="text-xs text-slate-500">页数范围<select className={field} value={pageRange} onChange={(event) => setPageRange(event.target.value as typeof pageRange)}>{pageRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}<label className="text-xs text-slate-500">内容重点<select aria-label="PPT重点" className={field} value={options.focus} onChange={(event) => { setOptions({ ...options, focus: event.target.value as PlanPptOptions["focus"] }); setHumanConfirmed(false); }}><option value="evidence">评分与证据</option><option value="technical">技术与验证</option><option value="story">问题与方案</option></select></label></fieldset>
      <TemplateSelector value={template} onChange={(id) => { setTemplate(id); setHumanConfirmed(false); }} binding={projectBinding(project)} disabled={busy} />
      <button type="button" className={primary + " mt-5"} disabled={busy || !projectId || (source === "plan" ? !plan || !confirmedBlocks(plan).length : !file)} onClick={() => void generate()}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Presentation size={15} />}{source === "plan" ? "从计划书生成 / 更新大纲" : "解析 DOCX 并生成大纲"}</button>
    </section>
    <div className="grid gap-2 sm:grid-cols-4" aria-live="polite">{["保存当前文档", "组织素材与大纲", "人工编辑与检查", "导出原生 PPTX"].map((label, index) => <div key={label} className={`rounded-xl border p-3 text-xs ${index === (stage === "saving" ? 0 : stage === "planning" ? 1 : stage === "rendering" || stage === "done" ? 3 : 2) ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}>{index + 1}. {label}</div>)}</div>
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
    {stale && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">{preparationStale ? "项目定位、资源或资料已变化，请返回计划书更新问卷并重新确认章节。" : "计划书已修改，当前大纲属于旧版本。请重新生成大纲后再导出。"}<Link href="/?view=plan" className="ml-2 underline">返回计划书 →</Link></p>}
    {warnings.length > 0 && <div className="rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-800">{[...new Set(warnings)].slice(0, 8).map((warning) => <p key={warning}><VerificationText text={warning} /></p>)}</div>}
    {displayOutline && <>
      <section className={panel}><label className="text-xs text-slate-500">演示文稿标题<input aria-label="PPT文稿标题" className={field} value={displayOutline.title} disabled={busy} onChange={(event) => edit((current) => ({ ...current, title: event.target.value }))} /></label><p className="mt-3 text-xs text-slate-500">{displayOutline.slides.length} 页 · {displayOutline.planSource ? `来自网页计划书 v${displayOutline.planSource.version}` : "来自外部 DOCX"} · {options.durationMinutes} 分钟，建议每页约 {Math.round(options.durationMinutes * 60 / displayOutline.slides.length)} 秒</p></section>
      {displayOutline.master && <section className={panel + " border-indigo-200 bg-indigo-50/40"} aria-label="PPT Master 工作流"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">PPT Master 工作流已映射</h3><p className="mt-2 text-xs leading-6 text-slate-600">{displayOutline.master.strategist} → Human Gate → {displayOutline.master.executor}。当前按 {displayOutline.master.style} 组织 {displayOutline.slides.length} 页，画布为 1280×720。</p></div><span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">SVG 归档 + 可编辑 PPTX</span></div><div className="mt-3 flex flex-wrap gap-2 text-xs text-indigo-700"><span>配色：{displayOutline.master.design.palette.slice(0, 3).join(" / ")}</span><span>字体：{displayOutline.master.design.headingFont}</span><span>讲稿：按页写入备注</span></div>{latest?.masterDesignSpecUrl && <div className="mt-4 flex flex-wrap gap-3"><a className="text-xs font-semibold text-indigo-700 underline" href={latest.masterDesignSpecUrl} target="_blank" rel="noreferrer">查看设计规范</a><a className="text-xs font-semibold text-indigo-700 underline" href={latest.masterManifestUrl} target="_blank" rel="noreferrer">查看产物清单</a><a className="text-xs font-semibold text-indigo-700 underline" href={latest.masterNotesUrl} target="_blank" rel="noreferrer">查看总讲稿</a></div>}</section>}
      {outline?.planSource && <section className={panel} aria-label="PPT一致性检查"><h3 className="font-semibold text-slate-900">一致性检查 · {errors.length ? `${errors.length} 项需修正` : "未发现阻断问题"}</h3><p className="mt-2 text-xs text-slate-500">核对项目名称、数字及结论、评分覆盖、来源核验、页面容量与证据。编辑后自动重新检查。</p><div className="mt-3 max-h-64 space-y-2 overflow-auto">{checks.map((check, index) => <p key={index} className={`rounded-lg p-2 text-xs leading-5 ${check.severity === "error" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}>{check.slideId && `第 ${displayOutline.slides.findIndex((slide) => slide.id === check.slideId) + 1} 页：`}<VerificationText text={check.message} href="/?view=plan" /></p>)}{checks.length === 0 && <p className="text-xs text-emerald-700">当前检查通过。</p>}</div></section>}
      <div className="grid items-start gap-4 xl:grid-cols-2">{displayOutline.slides.map((slide, index) => <SlideEditor key={slide.id} slide={slide} index={index} total={displayOutline.slides.length} scopeKey={scopeKey || ""} disabled={busy} onChange={(patch) => edit((current) => ({ ...current, slides: current.slides.map((item) => item.id === slide.id ? { ...item, ...patch } : item) }))} onDelete={() => edit((current) => ({ ...current, slides: current.slides.filter((item) => item.id !== slide.id) }))} onMove={(direction) => edit((current) => { const slides = [...current.slides]; [slides[index], slides[index + direction]] = [slides[index + direction], slides[index]]; return { ...current, slides }; })} />)}</div>
      <button type="button" className={button + " w-full"} disabled={busy || displayOutline.slides.length >= 15} onClick={() => edit((current) => ({ ...current, slides: [...current.slides, { id: crypto.randomUUID(), title: "新增页面", bullets: ["【建议补充】从已确认计划书选择材料"], speakerNotes: "【建议补充】填写演讲备注", layout: "content" }] }))}><Plus size={15} />新增页面</button>
      <section className={panel + " border-indigo-200"}><h3 className="font-semibold text-slate-900">Human Gate · 由你确认后导出</h3><label className="mt-3 flex items-start gap-3 text-sm leading-6 text-slate-600"><input type="checkbox" aria-label="确认PPT大纲与核验提示" className="mt-1" checked={humanConfirmed} disabled={busy || stale || errors.length > 0} onChange={(event) => setHumanConfirmed(event.target.checked)} />我已核对标题、要点、备注和来源；理解未核实内容仍保留标记，同意生成可编辑 PPTX。修改任何页面后需要重新确认。</label><button type="button" className={primary + " mt-4"} disabled={busy || !humanConfirmed || stale || errors.length > 0} onClick={() => void render()}>{stage === "rendering" ? <LoaderCircle size={15} className="animate-spin" /> : <Download size={15} />}确认并生成 PPTX</button>{latest && <a href={latest.downloadUrl} className={button + " ml-3 mt-4"} download={latest.fileName}>下载 {latest.fileName}</a>}</section>
    </>}
    <section className={panel + " border-amber-200 bg-amber-50/40"} aria-label="提交前材料自查"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-semibold text-slate-900">提交前材料自查</h3><p className="mt-2 text-xs leading-6 text-slate-600">PPT 导出前后的内容检查在这里完成；检查结果会保留待核验和修复建议，不替代赛事官方要求。</p></div><div className="flex flex-wrap gap-3"><Link href="/?view=check" className={button}>打开材料一致性检查</Link><Link href="/?view=tasks" className={button}>查看材料待补清单</Link></div></div></section>
    <section className={panel}><h3 className="font-semibold text-slate-900">当前比赛的历史导出</h3><div className="mt-3 space-y-2">{history.length ? history.map((entry) => <div key={entry.id} className="rounded-xl bg-slate-50 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><a href={entry.downloadUrl} download={entry.fileName} className="font-semibold text-indigo-700">{entry.fileName} · {entry.slideCount} 页 · {entry.templateId?.startsWith("tpl-") ? "来源登记版式" : "平台原创模板"}{entry.planSource ? ` · 计划书 v${entry.planSource.version}` : " · DOCX"}</a><span className="text-slate-500">{new Date(entry.createdAt).toLocaleString("zh-CN")}</span></div>{entry.masterDesignSpecUrl && <div className="mt-2 flex flex-wrap gap-3"><a href={entry.masterDesignSpecUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">设计规范</a><a href={entry.masterManifestUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">产物清单</a><a href={entry.masterNotesUrl} target="_blank" rel="noreferrer" className="text-indigo-600 underline">总讲稿</a></div>}</div>) : <p className="text-xs text-slate-400">暂无导出记录。</p>}</div></section>
  </div>;
}
