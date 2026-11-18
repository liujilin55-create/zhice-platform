"use client";

import { preparationNeedsReview } from "@/modules/preparation/domain";
import { VerificationText } from "@/modules/verification";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Download, LoaderCircle, Plus, Presentation, Trash2, ListChecks } from "lucide-react";
import { useWorkspaceStore, projectScopeKey, projectBinding } from "@/modules/workspace";
import { useProjectPlanStore, savePlanDocument } from "@/modules/project-plan";
import { sameBinding } from "@/shared/contracts/competition-binding";
import { findCompetition } from "@/modules/competition-recommendation";
import { TemplateSelector } from "@/modules/campus-catalog";
import { templateOptions, pageRangeOptions } from "./data";
import { usePptWorkspaceStore } from "./ppt-workspace.store";
import { checkPlanOutline, traceOutline } from "./plan-outline";
import { checkProjectDraftOutline, createProjectDraftOutline, projectDraftKey } from "./project-draft-outline";
import { buildMaterialReview } from "./material-review";
import { hasCurrentMaterialReview, materialFingerprint } from "./material-review-record";
import { MaterialReviewPanel } from "./material-review-panel";
import { analyzeDocx, analyzePlan, getPptHistory, inspectOutline, renderOutline } from "./services/ppt-api";
import type { ParsedDocx, PlanPptOptions, PptHistoryEntry, PptOutline, PptSlide, PptTemplate } from "./types";

const field = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40";
const primary = button + " border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800";
const panel = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
type Stage = "idle" | "saving" | "planning" | "draft" | "rendering" | "done";

function SlideEditor({ slide, index, total, scopeKey, disabled, onChange, onDelete, onMove }: { slide: PptSlide; index: number; total: number; scopeKey: string; disabled: boolean; onChange: (patch: Partial<PptSlide>) => void; onDelete: () => void; onMove: (direction: -1 | 1) => void }) {
  return <details className={panel} aria-label={`第 ${index + 1} 页编辑器`} open={index === 0}><summary className="cursor-pointer text-sm font-semibold leading-7 text-slate-900">第 {index + 1} 页 · {slide.title || "未命名页面"}</summary><div className="mt-4">
    <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-indigo-600">{String(index + 1).padStart(2, "0")}</span><div className="flex gap-1"><button type="button" className={button} aria-label="上移页面" disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp size={14} /></button><button type="button" className={button} aria-label="下移页面" disabled={disabled || index === total - 1} onClick={() => onMove(1)}><ArrowDown size={14} /></button><button type="button" className={button} aria-label="删除页面" disabled={disabled || total <= 5} onClick={onDelete}><Trash2 size={14} /></button></div></div>
    <label className="mt-3 block text-xs text-slate-500">页面类型<select aria-label={`第 ${index + 1} 页布局`} className={field} value={slide.layout} disabled={disabled} onChange={(e) => onChange({ layout: e.target.value as PptSlide["layout"] })}>{[["cover","封面"],["agenda","目录"],["content","自动匹配内容"],["problem","问题"],["data","数据图表"],["solution","方案"],["process","流程"],["architecture","架构"],["business","商业模式"],["team","团队"],["plan","计划"],["section","章节"],["closing","结尾"]].map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
    <input className={field + " font-semibold"} aria-label={`第 ${index + 1} 页标题`} value={slide.title} disabled={disabled} onChange={(event) => onChange({ title: event.target.value })} />
    <div className="mt-3 space-y-3">{slide.bullets.map((text, bulletIndex) => { const claim = slide.claims?.[bulletIndex]; return <div key={bulletIndex}>
      <div className="flex gap-2"><textarea aria-label={`第 ${index + 1} 页要点 ${bulletIndex + 1}`} className={field + " mt-0 min-h-16 resize-y text-xs leading-6"} value={text} disabled={disabled} onChange={(event) => onChange({ bullets: slide.bullets.map((value, position) => position === bulletIndex ? event.target.value : value) })} /><button type="button" aria-label={`删除第 ${index + 1} 页要点 ${bulletIndex + 1}`} className="text-xs text-slate-400" disabled={disabled || slide.bullets.length === 1} onClick={() => onChange({ bullets: slide.bullets.filter((_, position) => position !== bulletIndex) })}>删除</button></div>
      <p className={`mt-1 text-xs ${claim?.confirmed ? "text-emerald-700" : "text-amber-700"}`}>{claim?.confirmed ? "来自已核对原文" : "草稿内容 · 提交前集中核对"}</p>
    </div>; })}</div>
    <button type="button" className="mt-3 text-xs font-semibold text-indigo-600 disabled:opacity-40" disabled={disabled || slide.bullets.length >= 5} onClick={() => onChange({ bullets: [...slide.bullets, "【建议补充】填写有原文支持的要点"] })}>+ 增加要点</button>
    <label className="mt-4 block text-xs text-slate-500">演讲者备注<textarea aria-label={`第 ${index + 1} 页演讲备注`} className={field + " min-h-24 text-xs leading-6"} value={slide.speakerNotes} disabled={disabled} onChange={(event) => onChange({ speakerNotes: event.target.value })} /></label>
    {!!slide.chapterIds?.length && <Link href={`/?view=plan&chapter=${encodeURIComponent(slide.chapterIds[0])}&scope=${encodeURIComponent(scopeKey)}`} className="mt-3 inline-block min-h-11 text-sm font-semibold text-emerald-700 underline">查看对应计划书章节</Link>}
  </div></details>;
}

export function PptGenerator() {
  const params = useSearchParams(); const router = useRouter(); const project = useWorkspaceStore((state) => state.project);
  const activePanel = params.get("panel") === "check" ? "check" : "make";
  const showPanel = (value: "make" | "check") => { const query = new URLSearchParams(params.toString()); query.set("view", "ppt"); if (value === "check") query.set("panel", "check"); else query.delete("panel"); router.replace(`/?${query}`, { scroll: false }); };
  const scopeKey = projectScopeKey(project); const projectId = project?.projectId;
  const storedPlan = useProjectPlanStore((state) => state.document);
  const storedChapters = useProjectPlanStore((state) => state.chapters);
  const draftChapters = useMemo(() => Object.values(storedChapters).filter((chapter) => !chapter.binding && chapter.content.trim()), [storedChapters]);
  const plan = storedPlan && sameBinding(storedPlan.binding, projectBinding(project)) ? storedPlan : null;
  const [saved] = useState(() => scopeKey ? usePptWorkspaceStore.getState().byProject[scopeKey] : undefined);
  const [source, setSource] = useState<"plan" | "draft" | "docx">(() => params.get("source") === "plan" || saved?.outline?.planSource ? "plan" : saved?.outline?.draftSource ? "draft" : saved?.outline || saved?.document ? "docx" : plan ? "plan" : draftChapters.length ? "draft" : "docx");
  const [file, setFile] = useState<File | null>(null); const inputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<ParsedDocx | null>(saved?.document || null);
  const [outline, setOutline] = useState<PptOutline | null>(saved?.outline || null);
  const [template, setTemplate] = useState<PptTemplate>(saved?.template || "general");
  const [pageRange, setPageRange] = useState<(typeof pageRangeOptions)[number]["value"]>(saved?.pageRange || "8-10");
  const [options, setOptions] = useState<PlanPptOptions>(() => ({ durationMinutes: Math.max(3, Math.min(30, Number(params.get("minutes")) || saved?.planOptions?.durationMinutes || 8)), pages: Math.max(8, Math.min(15, Number(params.get("pages")) || saved?.planOptions?.pages || 12)), focus: params.get("focus") === "technical" ? "technical" : params.get("focus") === "story" ? "story" : saved?.planOptions?.focus || "evidence" }));
  const [stage, setStage] = useState<Stage>(saved?.latest ? "done" : saved?.outline ? "draft" : "idle");
  const [latest, setLatest] = useState<PptHistoryEntry | null>(saved?.latest || null); const [history, setHistory] = useState<PptHistoryEntry[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]); const [error, setError] = useState<string | null>(null); const [humanConfirmed, setHumanConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null); const autoStarted = useRef(false);
  const busy = ["saving", "planning", "rendering"].includes(stage);
  const preparationStale = Boolean(plan && project && preparationNeedsReview(plan, project.preparation, project.studentProfile));
  const stale = Boolean(outline?.planSource && (preparationStale || !plan || outline.planSource.version !== plan.version || outline.planSource.documentId !== plan.documentId)) || Boolean(outline?.draftSource && (!project || outline.draftSource.projectId !== project.projectId || outline.draftSource.contentKey !== projectDraftKey(project.name, draftChapters)));
  const displayOutline = useMemo(() => outline?.planSource && plan ? traceOutline(outline, plan) : outline, [outline, plan]);
  const checks = useMemo(() => outline?.planSource && plan ? checkPlanOutline(outline, plan) : outline?.draftSource ? checkProjectDraftOutline(outline) : [], [outline, plan]);
  const errors = checks.filter((check) => check.severity === "error");
  const competition = findCompetition(project?.selectedCompetitionId);
  const reviewItems = buildMaterialReview({ project, competition, plan, draftChapterCount: draftChapters.length, outline: displayOutline, checks, stale });
  const pendingReview = reviewItems.filter((item) => item.state !== "ready").length;
  const fingerprint = useMemo(() => materialFingerprint({ project, competition, plan, draftChapters, outline: displayOutline, document, checks, stale, template, pageRange, options }), [project, competition, plan, draftChapters, displayOutline, document, checks, stale, template, pageRange, options]);
  const savedReview = usePptWorkspaceStore((state) => scopeKey ? state.materialReviews[scopeKey] : undefined);
  const currentReview = hasCurrentMaterialReview(savedReview, scopeKey, fingerprint) ? savedReview : null;
  const reviewMaterials = () => {
    if (scopeKey && !busy && projectScopeKey(useWorkspaceStore.getState().project) === scopeKey) usePptWorkspaceStore.getState().markMaterialsReviewed(scopeKey, fingerprint);
  };
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (scopeKey) usePptWorkspaceStore.getState().save(scopeKey, { document, outline, template, pageRange, style: options.focus, latest, planOptions: options, requestKey: params.get("request") || undefined }); }, [scopeKey, document, outline, template, pageRange, options, latest, params]);
  useEffect(() => { if (!projectId) return; const abort = new AbortController(); void getPptHistory(projectId, scopeKey, abort.signal).then((result) => setHistory(result.history)).catch(() => undefined); return () => abort.abort(); }, [projectId, scopeKey]);

  const generate = useCallback(async () => {
    if (!projectId || !project) return; if (source === "plan" && preparationStale) { setError("项目资料已变化，请先返回第三步同步计划书草稿。"); return; } if (source === "plan" && (!plan || !plan.chapters.some((chapter) => chapter.blocks.some((block) => block.text.trim())))) { setError("请先在第三步写入计划书正文。"); return; }
    if (source === "draft" && !draftChapters.length) { setError("请先在第三步写入草稿正文。"); return; }
    if (source === "docx" && !file) { setError("请先上传 .docx 文件。"); return; }
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setError(null); setWarnings([]); setHumanConfirmed(false); setLatest(null);
    const activity = useWorkspaceStore.getState().beginActivity({ kind: "ppt", title: source === "docx" ? "从 Word 整理演示大纲" : "从计划书整理演示大纲", detail: project.name, href: "/?view=ppt" });
    try {
      let nextOutline: PptOutline; let nextWarnings: string[];
      if (source === "plan" && plan) {
        setStage("saving"); const savedDocument = await savePlanDocument(plan, abort.signal); setStage("planning");
        const result = await analyzePlan(projectId, savedDocument.reference, options, abort.signal, template); nextOutline = result.outline; nextWarnings = result.warnings; setDocument(null);
      } else if (source === "draft") {
        setStage("planning"); nextOutline = createProjectDraftOutline(projectId, project.name, draftChapters, options); nextWarnings = ["本稿尚未绑定比赛，所有内容保留待核验标记；选赛后可在第三步带入正文。"];
        setDocument(null);
      } else {
        setStage("planning"); const body = new FormData(); body.append("projectId", projectId); body.append("file", file!); body.append("pageRange", pageRange); body.append("template", template); body.append("style", options.focus);
        const result = await analyzeDocx(body, abort.signal); nextOutline = result.outline; nextWarnings = result.warnings; setDocument(result.document);
      }
      if (abort.signal.aborted || projectScopeKey(useWorkspaceStore.getState().project) !== scopeKey) return;
      setOutline(nextOutline); setWarnings(nextWarnings); setStage("draft"); useWorkspaceStore.getState().setAssetStatus("pptStatus", "draft", projectId, projectBinding(project) || undefined);
      useWorkspaceStore.getState().finishActivity(activity, { status: "success", title: "PPT 大纲已生成，等待人工确认", detail: `${nextOutline.slides.length} 页` });
    } catch (failure) { useWorkspaceStore.getState().finishActivity(activity, { status: abort.signal.aborted ? "warning" : "error", detail: "大纲生成停止，可保留材料重试。" }); if (!abort.signal.aborted) { setError(failure instanceof Error ? failure.message : "生成失败，请重试。"); setStage("idle"); } }
  }, [projectId, project, source, plan, draftChapters, file, options, pageRange, template, scopeKey, preparationStale, setError, setWarnings, setHumanConfirmed, setLatest, setStage, setDocument, setOutline]);
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
      const result = await renderOutline(projectId, displayOutline, template, displayOutline.planSource ? plan?.title || "网页计划书" : displayOutline.draftSource ? "未绑定比赛的计划书草稿" : document?.fileName || file?.name || "外部 DOCX", humanConfirmed, abort.signal, projectBinding(project) || undefined);
      if (abort.signal.aborted || projectScopeKey(useWorkspaceStore.getState().project) !== scopeKey) return;
      setLatest(result.history); setHistory((items) => [result.history, ...items.filter((item) => item.id !== result.history.id)]); setWarnings(result.warnings); setStage("done"); useWorkspaceStore.getState().setAssetStatus("pptStatus", "exported", projectId, projectBinding(project) || undefined);
    } catch (failure) { if (!abort.signal.aborted) { setError(failure instanceof Error ? failure.message : "PPTX 导出失败。"); setStage("draft"); setHumanConfirmed(false); } }
  };

  return <div className="space-y-5 pb-10 text-slate-900">
    <header><p className="text-xs font-semibold tracking-widest text-emerald-700">第四步 · 做演示与自查</p><h2 className="mt-2 text-2xl font-bold">整理成演示文稿，集中检查后导出。</h2><p className="mt-3 text-sm leading-7 text-slate-600">沿用第三步的计划书，也可上传 Word。缺失资料会保留标记，随时可以回来补充。</p></header>
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2" aria-label="第四步内容">
      <button type="button" aria-pressed={activePanel === "make"} className={activePanel === "make" ? primary : button} onClick={() => showPanel("make")}><Presentation size={17} />演示制作</button>
      <button type="button" aria-pressed={activePanel === "check"} className={activePanel === "check" ? primary : button} onClick={() => showPanel("check")}><ListChecks size={17} />材料自查{currentReview ? " · 本版已检查" : pendingReview ? ` · ${pendingReview} 类待完善` : ""}</button>
    </nav>
    {activePanel === "check" && <MaterialReviewPanel items={reviewItems} checks={checks} outline={displayOutline} onPresentation={() => showPanel("make")} reviewRecord={currentReview} reviewInvalidated={Boolean(savedReview && !currentReview)} canReview={Boolean(project) && !busy} onReview={reviewMaterials} />}
    <div hidden={activePanel !== "make"} className="space-y-5">
      {!project && <section className={panel}><p className="text-sm leading-7">先创建备赛项目，系统会按项目保存计划书和演示文稿。</p><Link href="/?view=competitions" className={primary + " mt-4"}>创建项目</Link></section>}
      <section className={panel} aria-label="演示文稿来源">
        <div className="flex flex-wrap gap-2"><button type="button" className={source !== "docx" ? primary : button} disabled={busy} onClick={() => { const next = plan ? "plan" : draftChapters.length ? "draft" : "plan"; if (source !== next) { setOutline(null); setLatest(null); setStage("idle"); } setSource(next); setHumanConfirmed(false); }}>使用当前计划书</button><button type="button" className={source === "docx" ? primary : button} disabled={busy} onClick={() => { if (source !== "docx") { setOutline(null); setLatest(null); setStage("idle"); } setSource("docx"); setHumanConfirmed(false); }}>上传 Word</button></div>
        {source !== "docx" ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
          {plan ? <><strong>{plan.title}</strong><p className="mt-1">{plan.chapters.length} 个章节 · 当前版本 {plan.version}</p><p className="mt-1 text-xs text-amber-800">未核验段落会作为带标记的草稿使用，已核对原文保留来源。</p></> : draftChapters.length ? <><strong>{project?.name} · 通用草稿</strong><p>{draftChapters.length} 个章节已保存。尚未选定比赛，演示中会保留待核验标记。</p></> : <p>还没有计划书正文。<Link href="/?view=plan" className="ml-2 font-semibold text-emerald-700 underline">去第三步写草稿</Link></p>}
        </div> : <div className="mt-4"><input ref={inputRef} type="file" accept=".docx" className="hidden" onChange={chooseFile} /><button type="button" disabled={busy} className={button + " min-h-24 w-full border-dashed"} onClick={() => inputRef.current?.click()}>{file?.name || "选择 Word 文件（.docx，最多 15 MB）"}</button>{document && <p className="mt-2 text-sm text-slate-500">已读取 {document.headings.length} 个标题、{document.paragraphs.length} 段正文。</p>}</div>}
        <details className="mt-5 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-600">调整页数与版式 · {source === "docx" ? pageRange : options.pages} 页 / {options.durationMinutes} 分钟</summary>
          <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-600">模板<select aria-label="PPT模板" className={field} value={template} onChange={(event) => { setTemplate(event.target.value as PptTemplate); setHumanConfirmed(false); }}>{template.startsWith("tpl-") && <option value={template}>已选择的登记模板</option>}{templateOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="text-sm text-slate-600">答辩时长<select aria-label="PPT答辩时长" className={field} value={options.durationMinutes} onChange={(event) => { setOptions({ ...options, durationMinutes: Number(event.target.value) }); setHumanConfirmed(false); }}>{[5, 8, 10, 15, 20].map((minutes) => <option key={minutes} value={minutes}>{minutes} 分钟</option>)}</select></label>{source !== "docx" ? <label className="text-sm text-slate-600">目标页数<input aria-label="PPT目标页数" type="number" min={8} max={15} className={field} value={options.pages} onChange={(event) => { setOptions({ ...options, pages: Math.max(8, Math.min(15, Number(event.target.value))) }); setHumanConfirmed(false); }} /></label> : <label className="text-sm text-slate-600">页数范围<select aria-label="PPT页数范围" className={field} value={pageRange} onChange={(event) => setPageRange(event.target.value as typeof pageRange)}>{pageRangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}<label className="text-sm text-slate-600">内容重点<select aria-label="PPT重点" className={field} value={options.focus} onChange={(event) => { setOptions({ ...options, focus: event.target.value as PlanPptOptions["focus"] }); setHumanConfirmed(false); }}><option value="evidence">评分与证据</option><option value="technical">技术与验证</option><option value="story">问题与方案</option></select></label></fieldset>
          <TemplateSelector value={template} onChange={(id) => { setTemplate(id); setHumanConfirmed(false); }} binding={projectBinding(project)} disabled={busy} />
        </details>
        <button type="button" className={primary + " mt-5"} disabled={busy || !projectId || (source === "plan" ? !plan?.chapters.some((chapter) => chapter.blocks.some((block) => block.text.trim())) : source === "draft" ? !draftChapters.length : !file)} onClick={() => void generate()}>{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Presentation size={17} />}{stage === "saving" ? "正在保存计划书…" : stage === "planning" ? "正在整理演示大纲…" : displayOutline ? "重新生成演示大纲" : "生成演示大纲"}</button>
      </section>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
      {stale && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-800">{preparationStale ? "项目资料已更新，请回第三步同步计划书草稿。" : "源材料已更新，请重新生成大纲后再导出。"}<Link href="/?view=plan" className="ml-2 underline">返回计划书</Link></p>}
      {!!warnings.length && <details className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><summary className="cursor-pointer font-semibold">生成提示 · {[...new Set(warnings)].length} 条</summary><div className="mt-3 space-y-2 leading-7">{[...new Set(warnings)].map((warning) => <p key={warning}><VerificationText text={warning} /></p>)}</div></details>}
      {displayOutline && <>
        <section className={panel}><label className="text-sm font-semibold text-slate-700">演示标题<input aria-label="PPT文稿标题" className={field} value={displayOutline.title} disabled={busy} onChange={(event) => edit((current) => ({ ...current, title: event.target.value }))} /></label><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{displayOutline.slides.length} 页 · {displayOutline.planSource ? `来自计划书版本 ${displayOutline.planSource.version}` : displayOutline.draftSource ? "来自通用计划书草稿" : "来自上传的 Word"}</p><button type="button" onClick={() => showPanel("check")} className={button}>查看集中检查{errors.length ? ` · ${errors.length} 项需修正` : ""}</button></div></section>
        <div className="space-y-3">{displayOutline.slides.map((slide, index) => <SlideEditor key={slide.id} slide={slide} index={index} total={displayOutline.slides.length} scopeKey={scopeKey || ""} disabled={busy} onChange={(patch) => edit((current) => ({ ...current, slides: current.slides.map((item) => item.id === slide.id ? { ...item, ...patch } : item) }))} onDelete={() => edit((current) => ({ ...current, slides: current.slides.filter((item) => item.id !== slide.id) }))} onMove={(direction) => edit((current) => { const slides = [...current.slides]; [slides[index], slides[index + direction]] = [slides[index + direction], slides[index]]; return { ...current, slides }; })} />)}</div>
        <button type="button" className={button + " w-full"} disabled={busy || displayOutline.slides.length >= 15} onClick={() => edit((current) => ({ ...current, slides: [...current.slides, { id: crypto.randomUUID(), title: "新增页面", bullets: ["【建议补充】填写页面要点"], speakerNotes: "【建议补充】填写演讲备注", layout: "content" }] }))}><Plus size={17} />新增页面</button>
        <section className={panel + " border-emerald-200"}><h3 className="font-semibold text-slate-900">导出前确认</h3><p className="mt-2 text-sm leading-7 text-slate-600">草稿可带着待补标记导出。请在正式提交前完成“材料自查”。</p>{errors.length > 0 && <button type="button" onClick={() => showPanel("check")} className="mt-3 text-sm font-semibold text-rose-700 underline">有 {errors.length} 项内容一致性问题需要修正</button>}<label className="mt-4 flex items-start gap-3 text-sm leading-7 text-slate-700"><input type="checkbox" aria-label="确认PPT大纲与核验提示" className="mt-2" checked={humanConfirmed} disabled={busy || stale || errors.length > 0} onChange={(event) => setHumanConfirmed(event.target.checked)} />我已检查本次大纲，了解未核验内容仍以草稿标记保留。</label><div className="mt-4 flex flex-wrap gap-3"><button type="button" className={primary} disabled={busy || !humanConfirmed || stale || errors.length > 0} onClick={() => void render()}>{stage === "rendering" ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}{stage === "rendering" ? "正在生成文件…" : "生成可编辑演示文稿"}</button>{latest && <a href={latest.downloadUrl} className={button} download={latest.fileName}>下载演示文稿</a>}</div></section>
      </>}
      <details className={panel}><summary className="cursor-pointer font-semibold text-slate-900">历史导出 · {history.length} 份</summary><div className="mt-4 space-y-3">{history.length ? history.map((entry) => <div key={entry.id} className="rounded-xl bg-slate-50 p-3 text-sm"><a href={entry.downloadUrl} download={entry.fileName} className="font-semibold text-emerald-700 underline">{entry.fileName} · {entry.slideCount} 页</a><p className="mt-2 text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("zh-CN")} · {entry.planSource ? `计划书版本 ${entry.planSource.version}` : entry.sourceKind === "draft" ? "未绑定比赛的草稿" : "上传的 Word"}</p></div>) : <p className="text-sm text-slate-500">还没有导出记录。</p>}</div></details>
    </div>
  </div>;
}
