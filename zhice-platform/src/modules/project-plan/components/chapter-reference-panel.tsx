"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Check, ChevronDown, Circle, CircleHelp, LoaderCircle, Sparkles, Square } from "lucide-react";
import { projectScopeKey, useWorkspaceStore } from "@/modules/workspace";
import type { WorkspaceProject } from "@/modules/workspace/types";
import { sameBinding } from "@/shared/contracts/competition-binding";
import { useProjectPlanStore } from "../plan.store";
import { applyChapterReference, useChapterReferenceStore } from "../chapter-reference.store";
import { chapterReferenceContextKey } from "../reference-context";
import { sessionForDraft } from "../draft-workflow";
import { sendPlanEvent } from "../services/plan-api";
import { planStyles as s } from "../project-plan.styles";
import type { PlanChapter, PlanContext, PlanWorkspace } from "../types";

const generationStages = [
  { id: "context", title: "整理项目资料" },
  { id: "outline", title: "生成本章提纲" },
  { id: "writing", title: "扩写参考正文" },
  { id: "review", title: "整理来源与格式" },
] as const;
type GenerationStage = (typeof generationStages)[number]["id"];
type StageProgress = { status: "pending" | "running" | "done"; detail: string };
const emptyProgress = (): Record<GenerationStage, StageProgress> => ({
  context: { status: "pending", detail: "等待开始" },
  outline: { status: "pending", detail: "等待资料整理" },
  writing: { status: "pending", detail: "等待提纲完成" },
  review: { status: "pending", detail: "等待正文完成" },
});

export function ChapterReferencePanel({ project, workspace, chapterId, title, context, onAdopt }: {
  project: WorkspaceProject;
  workspace: PlanWorkspace;
  chapterId: string;
  title: string;
  context: PlanContext | null;
  onAdopt: () => void;
}) {
  const scopeKey = projectScopeKey(project)!;
  const reference = useChapterReferenceStore((state) => state.byScope[scopeKey]?.[chapterId]);
  const instructions = useChapterReferenceStore((state) => state.instructionsByScope[scopeKey]?.[chapterId] || "");
  const hydrated = useChapterReferenceStore((state) => state.hydrated);
  const session = useProjectPlanStore((state) => state.session);
  const chapter = useProjectPlanStore((state) => state.chapters[chapterId]);
  const busy = useProjectPlanStore((state) => state.busy);
  const [generating, setGenerating] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adoptedKey, setAdoptedKey] = useState("");
  const [replaceConfirmation, setReplaceConfirmation] = useState(false);
  const [progress, setProgress] = useState(emptyProgress);
  const [outlineText, setOutlineText] = useState("");
  const [outlineExpanded, setOutlineExpanded] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationStopped, setGenerationStopped] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const latestContext = useRef(context);
  const contextKey = chapterReferenceContextKey(project, sessionForDraft(session, project), instructions, context, chapter?.content || "");
  const stale = Boolean(reference && reference.contextKey !== contextKey);
  const adopted = Boolean(reference && chapter?.content === reference.chapter.content);

  useEffect(() => { latestContext.current = context; }, [context]);
  useEffect(() => {
    if (!generating || generationStartedAt === null) return;
    const updateElapsed = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000)));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [generating, generationStartedAt]);
  useEffect(() => {
    let mounted = true;
    void Promise.resolve(useChapterReferenceStore.persist.rehydrate()).then(() => {
      if (mounted) useChapterReferenceStore.getState().setHydrated();
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => () => {
    const request = controller.current;
    controller.current = null;
    request?.abort();
    if (request && useProjectPlanStore.getState().scopeKey === scopeKey) useProjectPlanStore.getState().setBusy(false);
  }, [scopeKey]);

  const currentKey = () => {
    const current = useWorkspaceStore.getState().project;
    const plan = useProjectPlanStore.getState();
    if (!current || projectScopeKey(current) !== scopeKey || plan.scopeKey !== scopeKey) return null;
    const latestInstructions = useChapterReferenceStore.getState().instructionsByScope[scopeKey]?.[chapterId] || "";
    return chapterReferenceContextKey(current, sessionForDraft(plan.session, current), latestInstructions, latestContext.current, plan.chapters[chapterId]?.content || "");
  };
  const generate = async () => {
    const plan = useProjectPlanStore.getState();
    if (plan.busy || !hydrated || plan.scopeKey !== scopeKey) return;
    const currentSession = sessionForDraft(plan.session, project);
    plan.setSession(currentSession);
    const requestKey = chapterReferenceContextKey(project, currentSession, instructions, context, plan.chapters[chapterId]?.content || "");
    const abort = new AbortController(); controller.current = abort;
    plan.setBusy(true); setGenerating(true); setGenerationStartedAt(Date.now()); setElapsedSeconds(0); setGenerationComplete(false); setGenerationStopped(false);
    setProgress(emptyProgress()); setOutlineText(""); setOutlineExpanded(true); setExpanded(true); setStreamedText(""); setError(""); setNotice(""); setReplaceConfirmation(false);
    let result: PlanChapter | null = null;
    try {
      await sendPlanEvent({ action: "chapter_reference", workspace, projectName: project.name, session: currentSession, report: plan.report, chapterId, instructions, currentContent: plan.chapters[chapterId]?.content || "" }, abort.signal, (event) => {
        if (abort.signal.aborted || controller.current !== abort || currentKey() !== requestKey) return;
        if (event.type === "reference_stage" && event.chapterId === chapterId) setProgress((current) => ({ ...current, [event.stage]: { status: event.status, detail: event.detail } }));
        if (event.type === "reference_outline_delta" && event.chapterId === chapterId) setOutlineText((text) => text + event.text);
        if (event.type === "reference_outline" && event.chapterId === chapterId) setOutlineText(event.text);
        if (event.type === "chapter_delta" && event.chapterId === chapterId) setStreamedText((text) => text + event.text);
        if (event.type === "chapter") result = event.chapter;
      });
      if (abort.signal.aborted || controller.current !== abort) return;
      if (currentKey() !== requestKey) throw new Error("写作资料已变化，请按最新选择重新生成参考模板。");
      const generated = result as PlanChapter | null;
      if (!generated || generated.id !== chapterId || generated.mode !== "ai" || !generated.content.trim() || !sameBinding(generated.binding, workspace.binding)) throw new Error("未收到完整的本章 AI 参考模板，请重试。");
      const saved = useChapterReferenceStore.getState().saveReference(scopeKey, { chapter: generated, contextKey: requestKey, instructions });
      if (!saved) throw new Error("参考模板未能保存，请重新生成。");
      setGenerationComplete(true); setStreamedText(""); setOutlineExpanded(false); setNotice("参考模板已生成。阅读后可采用到正文，再继续修改。");
    } catch (failure) {
      if (!abort.signal.aborted && controller.current === abort && useProjectPlanStore.getState().scopeKey === scopeKey) {
        setError(failure instanceof Error ? failure.message : "AI 参考模板生成失败，请重试。");
      }
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        if (useProjectPlanStore.getState().scopeKey === scopeKey) { plan.setBusy(false); setGenerating(false); }
      }
    }
  };
  const stop = () => {
    controller.current?.abort(); controller.current = null;
    useProjectPlanStore.getState().setBusy(false);
    setGenerating(false); setGenerationStopped(true); setGenerationStartedAt(null); setNotice("已停止生成，已收到的提纲与正文片段保留在下方；可以重试。");
  };
  const adopt = () => {
    const key = currentKey();
    if (!key || key !== reference?.contextKey) { setError("项目选择或写作资料已更新，请重新生成后再采用。"); return; }
    if (useProjectPlanStore.getState().chapters[chapterId]?.content.trim() && !replaceConfirmation) { setReplaceConfirmation(true); return; }
    if (!applyChapterReference(scopeKey, chapterId, key)) { setError("当前参考模板无法采用，请刷新资料后重试。"); return; }
    onAdopt(); setAdoptedKey(currentKey() || ""); setReplaceConfirmation(false); setExpanded(false); setError(""); setNotice("已采用到正文并保存为草稿，可在下方继续编辑。");
  };

  return <div className="border-b border-slate-200 pb-5" aria-label={`${title} AI 参考模板`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-800"><Sparkles size={17} />本章 AI 参考模板</h4><p className={s.panelHint}>结合比赛、赛道、方向与已有资料生成，预览后再采用。</p></div>
      <div className="flex items-center gap-2">{reference && <button type="button" className={s.secondary} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "收起模板" : "查看模板"}<ChevronDown size={15} className={expanded ? "rotate-180" : ""} /></button>}{generating ? <button type="button" className={s.secondary} onClick={stop}><Square size={14} />停止生成</button> : <button type="button" className={s.primary} disabled={busy || !hydrated} onClick={() => void generate()}><Sparkles size={16} />{reference ? "重新生成参考" : "生成本章参考模板"}</button>}</div>
    </div>
    <details className="mt-3"><summary className="cursor-pointer text-sm text-slate-600">补充本章要求（可选）</summary><label className="mt-3 block text-sm text-slate-600">希望重点写什么<textarea aria-label="本章定制要求" className={s.input + " mt-2 min-h-20"} maxLength={2000} disabled={busy || !hydrated} value={instructions} placeholder="例如：控制在 600 字，突出育苗场景，列出湿态性能的验证方法。" onChange={(event) => { useChapterReferenceStore.getState().setInstructions(scopeKey, chapterId, event.target.value); setReplaceConfirmation(false); }} /></label></details>
    {stale && contextKey !== adoptedKey && <p className="mt-3 text-sm leading-6 text-amber-800">项目选择、写作资料、正文或本章要求已变化，请重新生成后采用。</p>}
    {error && <p role="alert" className={s.error + " mt-3"}>{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm leading-6 text-emerald-800">{notice}</p>}
    {expanded && (generating || reference || outlineText || streamedText) && <div className="mt-4 space-y-4">
      {(generating || generationComplete || generationStopped || Boolean(error)) && <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="参考模板生成进度">
        <div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-sm font-semibold text-slate-900">{generationComplete ? "生成已完成" : generationStopped ? "生成已停止" : error ? "本次生成未完成" : "正在分步生成"}</h5><span className="text-xs tabular-nums text-slate-500">已用 {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}</span></div>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2" aria-live="polite">{generationStages.map((item) => {
          const itemProgress = progress[item.id];
          const icon = itemProgress.status === "done" ? <Check size={15} /> : itemProgress.status === "running" && generating ? <LoaderCircle size={15} className="animate-spin" /> : itemProgress.status === "running" ? <CircleHelp size={15} /> : <Circle size={15} />;
          const tone = itemProgress.status === "done" ? "border-emerald-200 bg-white text-emerald-800" : itemProgress.status === "running" && generating ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-500";
          return <li key={item.id} className={`min-w-0 rounded-lg border p-3 ${tone}`}><div className="flex items-center gap-2 text-sm font-medium">{icon}<span>{item.title}</span>{itemProgress.status === "running" && !generating && <span className="text-xs">未完成</span>}</div><p className="mt-1 pl-6 text-xs leading-5 text-slate-600">{itemProgress.detail}</p></li>;
        })}</ol>
      </section>}
      {outlineText && <section className="rounded-xl border border-sky-200 bg-sky-50/60 p-4"><button type="button" className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-sm font-semibold text-slate-900" aria-expanded={outlineExpanded} onClick={() => setOutlineExpanded((value) => !value)}><span>本章提纲{progress.outline.status === "running" ? " · 生成中" : progress.outline.status === "done" ? " · 已完成" : " · 部分内容"}</span><ChevronDown size={15} className={outlineExpanded ? "rotate-180" : ""} /></button>{outlineExpanded && <div className="mt-2 max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{outlineText}</div>}</section>}
      {(streamedText || !generating && reference) && <div className="max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm leading-8 text-slate-800" role="region" aria-label={`${title}参考模板预览`}>{generating || !generationComplete ? streamedText : reference?.chapter.content}</div>}
      {!generating && reference && <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className={s.helper}>AI 参考模板 · {new Date(reference.createdAt).toLocaleString("zh-CN")}{adopted ? " · 已采用到正文" : " · 独立参考"}</span><button type="button" className={s.primary} disabled={busy || stale || adopted} onClick={adopt}><ArrowDownToLine size={16} />{adopted ? "已采用到正文" : "采用到正文"}</button></div>}
      {replaceConfirmation && !generating && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm leading-7 text-amber-900">本章已有 {chapter?.content.length || 0} 字正文。采用后将替换本章，现有内容会先保存到历史版本。</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={s.primary} disabled={busy || stale} onClick={adopt}>保留旧版并替换正文</button><button type="button" className={s.secondary} onClick={() => setReplaceConfirmation(false)}>保留当前正文</button></div></div>}
    </div>}
  </div>;
}
