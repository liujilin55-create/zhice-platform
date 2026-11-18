"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Check, FileDown, FilePenLine, LoaderCircle, Sparkles } from "lucide-react";
import { preparationContextKey, preparationNeedsReview } from "@/modules/preparation/domain";
import { findCompetition } from "@/modules/competition-recommendation";
import { sameBinding } from "@/shared/contracts/competition-binding";
import { useWorkspaceStore, projectBinding, projectScopeKey } from "@/modules/workspace";
import type { WorkspaceProject } from "@/modules/workspace/types";
import { useProjectPlanStore } from "./plan.store";
import { PLAN_CHAPTERS, PLAN_SLOTS, emptySurveySession, preparationChapters, type PlanChapter, type PlanContext, type PlanWorkspace } from "./types";
import { getPlanContext, sendPlanEvent, exportPlan } from "./services/plan-api";
import { savePlanDocument } from "./services/document-api";
import { sessionForDraft, createGeneralDraft, generalDraftMarkdown } from "./draft-workflow";
import { DocumentPanel } from "./components/document-panel";
import { ChapterReferencePanel } from "./components/chapter-reference-panel";
import { planStyles as s } from "./project-plan.styles";

function downloadFile(content: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(content)], { type }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

function ChapterEditor({ project, workspace, chapterId, context }: { project: WorkspaceProject; workspace: PlanWorkspace | null; chapterId: string; context: PlanContext | null }) {
  const chapter = useProjectPlanStore((state) => state.chapters[chapterId]);
  const busy = useProjectPlanStore((state) => state.busy);
  const title = preparationChapters(project.preparation).find((item) => item.id === chapterId)?.title || chapterId;
  const markDraft = () => {
    const current = useWorkspaceStore.getState().project;
    if (projectScopeKey(current) === projectScopeKey(project) && current?.documentStatus !== "draft") useWorkspaceStore.getState().setAssetStatus("documentStatus", "draft", project.projectId, workspace?.binding);
  };
  const update = (content: string) => {
    const store = useProjectPlanStore.getState();
    const next: PlanChapter = { ...chapter, id: chapterId, title, binding: workspace?.binding, generationStatus: "draft", sourceIds: chapter?.sourceIds || [], evidenceIds: chapter?.evidenceIds || [], status: "draft", content, mode: chapter?.mode || "local", updatedAt: new Date().toISOString() };
    store.upsertChapter(next, "user"); markDraft();
  };
  const generateOutline = () => {
    const store = useProjectPlanStore.getState(); if (store.busy) return;
    const session = sessionForDraft(store.session, project); store.setSession(session); store.setError(null);
    if (workspace || chapter?.content.trim()) return;
    store.upsertChapter(createGeneralDraft(project, session, chapterId)); markDraft();
  };
  return <section className={s.panel + " space-y-4"} aria-label="章节编辑器">
    <div className={s.panelHeader}><div><h3 className={s.panelTitle}><FilePenLine size={18} />{title}</h3><p className={s.panelHint}>先参考本章模板，再写成你的项目内容。正文修改自动保存。</p></div><span className={s.count}>{chapter?.content.trim() ? "已保存" : "待编写"}</span></div>
    {workspace && <ChapterReferencePanel project={project} workspace={workspace} chapterId={chapterId} title={title} context={context} onAdopt={markDraft} />}
    <label className="block text-sm font-semibold text-slate-700" htmlFor={`chapter-content-${chapterId}`}>本章正文</label>
    <textarea id={`chapter-content-${chapterId}`} aria-label={title + "章节初稿"} className={s.editor} value={chapter?.content || ""} onChange={(event) => update(event.target.value)} disabled={busy} placeholder="可以直接编写，也可先生成上方参考模板，阅读后点击“采用到正文”。缺少的数据、案例或来源可先写【建议补充】。" />
    <div className={s.editorTools}><span className={s.helper}>{chapter?.content.length || 0} 字 · 缺失信息和推断会保留标记</span>{!workspace && <button type="button" className={s.secondary} disabled={busy || Boolean(chapter?.content.trim())} onClick={generateOutline}><Sparkles size={16} />生成通用章节提纲</button>}</div>
  </section>;
}

export function ProjectPlan() {
  const router = useRouter(); const params = useSearchParams();
  const project = useWorkspaceStore((state) => state.project);
  const store = useProjectPlanStore();
  const [context, setContext] = useState<Awaited<ReturnType<typeof getPlanContext>>["data"] | null>(null);
  const [contextError, setContextError] = useState(""); const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false); const [saving, setSaving] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const openedChapter = useRef("");
  const workspace = useMemo<PlanWorkspace | null>(() => { const binding = projectBinding(project); return project && binding ? { binding, studentProfile: project.studentProfile, preparation: project.preparation, selectionConfirmedAt: project.competitionConfirmedAt, reportId: project.reportId, intent: "draft" } : null; }, [project]);
  const currentContext = useMemo(() => workspace && context && sameBinding(context.binding, workspace.binding) ? context : null, [workspace, context]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!project || !store.hydrated) return;
    const current = useProjectPlanStore.getState();
    const key = preparationContextKey(project.preparation, project.studentProfile);
    const emptyDocumentChanged = key && current.document && !Object.values(current.chapters).some((chapter) => chapter.content.trim()) && preparationNeedsReview(current.document, project.preparation, project.studentProfile);
    const session = sessionForDraft(emptyDocumentChanged ? emptySurveySession() : current.session, project);
    if (emptyDocumentChanged) current.acceptPreparation(key, session);
    else if (session !== current.session) current.setSession(session);
    if (!current.activeChapterId) current.setActiveChapter(PLAN_CHAPTERS[0].id);
  }, [project, store.hydrated]);
  useEffect(() => {
    if (!workspace) return;
    const abort = new AbortController();
    void getPlanContext(workspace, abort.signal).then((result) => { if (!abort.signal.aborted) { setContext(result.data); setContextError(""); } }).catch((error) => { if (!abort.signal.aborted) setContextError(error instanceof Error ? error.message : "暂未读取到比赛资料，仍可编辑草稿。"); });
    return () => abort.abort();
  }, [workspace]);
  useEffect(() => {
    const current = useProjectPlanStore.getState();
    if (project && workspace && (currentContext || !current.document)) current.setDocumentContext(project.name, workspace.binding, currentContext?.sources || [], currentContext?.criteria || [], preparationContextKey(project.preparation, project.studentProfile));
  }, [project, workspace, currentContext]);
  useEffect(() => {
    const chapter = params.get("chapter");
    const request = params.toString();
    if (chapter && openedChapter.current !== request && params.get("scope") === projectScopeKey(project) && PLAN_CHAPTERS.some((item) => item.id === chapter)) { openedChapter.current = request; useProjectPlanStore.getState().setActiveChapter(chapter); }
  }, [params, project]);
  if (!project) return <section className={s.panel}><h2 className={s.heading}>开始编写计划书</h2><p className={s.subheading}>先建立一个备赛项目，资料可以边写边补。</p><Link href="/?view=competitions" className={s.primary + " mt-4"}>建立备赛项目<ArrowRight size={16} /></Link></section>;
  if (!store.hydrated) return <div className={s.panel}>正在恢复计划书…</div>;
  const chapters = preparationChapters(project.preparation);
  const selectedCompetition = findCompetition(project.selectedCompetitionId);
  const selectedTrack = selectedCompetition?.tracks.find((track) => track.trackId === project.selectedTrackId);
  const active = store.activeChapterId || chapters[0].id;
  const written = Object.values(store.chapters).filter((chapter) => chapter.content.trim());
  const unboundDrafts = workspace ? Object.values(store.byProject[project.projectId]?.chapters || {}).filter((chapter) => !chapter.binding && !store.chapters[chapter.id]) : [];
  const preparationKey = preparationContextKey(project.preparation, project.studentProfile);
  const stale = Boolean(store.document && preparationNeedsReview(store.document, project.preparation, project.studentProfile));
  const saveAndContinue = async () => {
    setSaving(true); setMessage(""); const current = useProjectPlanStore.getState(); const scope = current.scopeKey;
    current.saveVersion();
    try {
      if (current.document) await savePlanDocument(current.document);
      if (useProjectPlanStore.getState().scopeKey === scope) router.push("/?view=ppt");
    } catch (error) { if (useProjectPlanStore.getState().scopeKey === scope) setMessage(error instanceof Error ? error.message : "同步保存失败，本地草稿已保留。"); }
    finally { setSaving(false); }
  };
  const download = async (format: "markdown" | "docx") => {
    setExporting(true); setMessage(""); const current = useProjectPlanStore.getState(); const scope = current.scopeKey;
    const title = current.document?.title || project.name + " · 项目计划书";
    try {
      if (!workspace) {
        downloadFile(new TextEncoder().encode(generalDraftMarkdown(title, written)), title.replace(/[\\/:*?"<>|]/g, "-") + ".md", "text/markdown;charset=utf-8");
      } else {
        const response = await exportPlan({ action: "export", workspace, format, title, session: sessionForDraft(current.session, project), report: current.report, chapters: written }, new AbortController().signal);
        if (useProjectPlanStore.getState().scopeKey !== scope) return;
        const bytes = response.encoding === "base64" ? Uint8Array.from(atob(response.content), (char) => char.charCodeAt(0)) : new TextEncoder().encode(response.content);
        downloadFile(bytes, response.filename, format === "markdown" ? "text/markdown;charset=utf-8" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      }
      useWorkspaceStore.getState().setAssetStatus("documentStatus", "exported", project.projectId, workspace?.binding);
    } catch (error) { if (useProjectPlanStore.getState().scopeKey === scope) setMessage(error instanceof Error ? error.message : "导出失败，请重试。"); }
    finally { setExporting(false); }
  };
  const checkGaps = async () => {
    if (!workspace || store.busy) return;
    const current = useProjectPlanStore.getState(); const scope = current.scopeKey;
    const abort = new AbortController(); controller.current = abort; current.setBusy(true); current.setError(null);
    try {
      await sendPlanEvent({ action: "report", workspace, session: sessionForDraft(current.session, project) }, abort.signal, (event) => {
        if (abort.signal.aborted || useProjectPlanStore.getState().scopeKey !== scope) return;
        if (event.type === "report") current.setReport(event.report);
        if (event.type === "replace") current.setError(event.message);
      });
    } catch (error) { if (!abort.signal.aborted && useProjectPlanStore.getState().scopeKey === scope) current.setError(error instanceof Error ? error.message : "缺口分析暂时不可用。"); }
    finally { if (controller.current === abort) { controller.current = null; if (useProjectPlanStore.getState().scopeKey === scope) current.setBusy(false); } }
  };
  return <div className={s.page}>
    <header className={s.header}><div><p className={s.eyebrow}>第三步 · 计划书与文档</p><h2 className={s.heading}>按你的参赛方向，逐章写好计划书。</h2><p className={s.subheading}>每章先生成定制参考模板，阅读后采用到正文，再补充你自己的事实与数据。</p></div><div className="flex flex-wrap gap-2"><button className={s.secondary} disabled={exporting || store.busy || !written.length} onClick={() => void download("markdown")}><FileDown size={16} />导出文本草稿</button>{workspace && <button className={s.secondary} disabled={exporting || store.busy || !written.length} onClick={() => void download("docx")}><FileDown size={16} />导出 Word</button>}</div></header>
    {workspace ? <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-4" aria-label="参考模板定制依据"><p className="text-xs font-semibold text-emerald-800">当前定制依据</p><p className="mt-2 text-sm leading-7 text-slate-800">{currentContext?.competitionName || selectedCompetition?.name || "已选比赛"}<span className="mx-2 text-slate-400">/</span>{currentContext?.trackName || selectedTrack?.name || "已选赛道"}</p><p className="mt-1 text-sm leading-7 text-slate-600">方向：{project.preparation.topicTitle || project.name}<span className="ml-3 text-xs">已带入 {project.preparation.research.length} 份参考资料</span></p></section> : <p className={s.info}>当前可先编写通用草稿；选择比赛与赛道后，即可为每个章节生成 AI 定制参考模板。<Link href="/?view=competitions" className="ml-2 font-semibold underline">去选择比赛</Link></p>}
    {stale && written.length > 0 && workspace && preparationKey && <section className={s.info + " flex flex-wrap items-center justify-between gap-3"}><p>项目定位或参考资料已更新，原有章节已保留。</p><button type="button" className={s.secondary} disabled={store.busy} onClick={() => { store.acceptPreparation(preparationKey, sessionForDraft(emptySurveySession(), project)); setMessage("已更新写作资料，原有章节保留为草稿，可选择需要调整的章节重新生成。"); }}>更新写作资料</button></section>}
    {!!unboundDrafts.length && <section className={s.panel + " flex flex-wrap items-center justify-between gap-3"}><p className="text-sm">找到未选赛时保存的 {unboundDrafts.length} 章草稿，可继续使用。</p><button type="button" className={s.secondary} onClick={() => { const count = store.importProjectDrafts(workspace!.binding); setMessage(`已带入 ${count} 章草稿，原稿已保留，材料仍待检查。`); }}>带入未选赛时的草稿</button></section>}
    {store.error && <p role="alert" className={s.error}>{store.error}</p>}{message && <p role="status" className={s.info}>{message}</p>}
    <div className={s.workspace}><aside className={s.panel} aria-label="计划书章节目录"><h3 className={s.panelTitle}>章节目录<span className={s.count}>{written.length}/{chapters.length}</span></h3><label className="mt-3 block text-sm text-slate-600 lg:hidden">当前章节<select aria-label="切换计划书章节" value={active} onChange={(event) => store.setActiveChapter(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100">{chapters.map((chapter, index) => <option key={chapter.id} value={chapter.id}>{String(index + 1).padStart(2, "0")} · {chapter.title}{store.chapters[chapter.id]?.content.trim() ? "（已编写）" : ""}</option>)}</select></label><div className="mt-4 hidden space-y-1 lg:block">{chapters.map((chapter, index) => <button type="button" key={chapter.id} onClick={() => store.setActiveChapter(chapter.id)} aria-current={active === chapter.id ? "page" : undefined} className={"flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm disabled:opacity-50 " + (active === chapter.id ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-50")}><span className="text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1">{chapter.title}</span>{store.chapters[chapter.id]?.content.trim() && <Check size={14} aria-label="已编写" />}</button>)}</div></aside><ChapterEditor key={projectScopeKey(project) + ":" + active} project={project} workspace={workspace} chapterId={active} context={currentContext} /></div>
    <details className={s.panel}><summary className="cursor-pointer text-sm font-semibold">写作资料与来源（可选）</summary><p className={s.panelHint}>已填信息自动带入。空项不影响生成草稿，补充后可重新生成需要调整的章节。</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{PLAN_SLOTS.map((slot) => <label key={slot.id} className="text-sm text-slate-700">{slot.label}<textarea aria-label={slot.label} value={store.session.slots[slot.id].value || ""} maxLength={2000} disabled={store.busy} onChange={(event) => { const current = useProjectPlanStore.getState(); const value = event.target.value; const slots = { ...current.session.slots, [slot.id]: { ...current.session.slots[slot.id], value: value || null, status: value.trim() ? "captured" as const : "empty" as const } }; const next = Object.values(slots).find((item) => item.status !== "captured")?.id || null; current.setSession({ ...current.session, slots, complete: !next, currentSlot: next, updatedAt: new Date().toISOString() }); }} className={s.input + " mt-2"} /></label>)}</div>{workspace && <div className="mt-5 space-y-3 border-t border-slate-200 pt-4"><p className="text-sm font-medium">{currentContext?.competitionName || "当前比赛"} · {currentContext?.trackName || "赛道资料读取中"}</p>{contextError && <p className={s.helper}>{contextError}</p>}{currentContext?.sources.map((source) => <p key={source.sourceId} className="text-sm text-slate-600">{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="text-emerald-700 underline">{source.title}</a> : source.title}</p>)}<Link href="/?view=requirements" className={s.secondary}><BookOpen size={15} />补充比赛要求</Link></div>}</details>
    {workspace && <details className={s.panel}><summary className="cursor-pointer text-sm font-semibold">写作缺口分析（可选）</summary><div className="mt-4 space-y-4"><button className={s.secondary} disabled={store.busy} onClick={() => void checkGaps()}>{store.busy ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}查看写作缺口</button>{store.report && <><p className="text-sm leading-7 text-slate-600">{store.report.summary}</p><ul className="space-y-3 text-sm text-slate-600">{store.report.completeness.filter((item) => item.status !== "sufficient").map((item) => <li key={item.dimension}><strong>{item.dimension}：</strong>{item.nextAction}</li>)}</ul></>}</div></details>}
    <DocumentPanel onRestore={() => setMessage("已恢复文档版本，可继续编辑。")} />
    <footer className={s.panel + " flex flex-wrap items-center justify-between gap-4"}><p className="text-sm text-slate-500">草稿自动保存在当前项目中，保存不会把推断标记为已核实。</p><button type="button" className={s.primary} disabled={saving || store.busy} onClick={() => void saveAndContinue()}>{saving ? <LoaderCircle size={16} className="animate-spin" /> : null}保存并继续<ArrowRight size={16} /></button></footer>
  </div>;
}
