"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectPlanStore } from "../plan.store";
import { preparationContextKey, preparationNeedsReview, topicValues } from "@/modules/preparation/domain";
import { emptySurveySession } from "../types";
import { projectBinding, projectScopeKey } from "@/modules/workspace";
import { preparationChapters } from "../types";
import { savePlanDocument } from "../services/document-api";
import { useWorkspaceStore } from "@/modules/workspace";
import { confirmedBlocks } from "@/shared/contracts/plan-document";

export function DocumentPanel({ onRestore }: { onRestore: () => void }) {
  const router = useRouter(); const store = useProjectPlanStore();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [duration, setDuration] = useState(8); const [pages, setPages] = useState(12); const [focus, setFocus] = useState("evidence");
  const project = useWorkspaceStore((state) => state.project);
  const preparation = project?.preparation;
  const document = store.document; if (!document) return null;
  const stale = Boolean(project && preparationNeedsReview(document, project.preparation, project.studentProfile));
  const bound = Boolean(project?.preparation.topicConfirmedAt && project.preparation.topicBinding === projectScopeKey(project));
  const updatePreparation = () => {
    if (!project || !bound) return;
    const values = topicValues(project.preparation, project.studentProfile); const binding = projectBinding(project); const key = preparationContextKey(project.preparation, project.studentProfile);
    if (!values || !binding || !key) return;
    const session = emptySurveySession(); session.binding = binding;
    for (const [id, value] of Object.entries(values)) { const slot = id as keyof typeof session.slots; session.slots[slot] = { ...session.slots[slot], value, status: "captured" }; }
    session.complete = true; session.currentSlot = null;
    store.acceptPreparation(key, session); onRestore(); setMessage("已更新问卷，旧章节与人工修改保留为草稿。请重新生成报告并逐章检查、确认。");
  };
  const confirmed = document.chapters.filter((chapter) => chapter.confirmed).length;
  const save = async (ppt = false) => {
    setBusy(true); setMessage(""); const scope = store.scopeKey; store.saveVersion();
    try {
      await savePlanDocument(document);
      if (useProjectPlanStore.getState().scopeKey !== scope) return;
      setMessage(`已保存版本 v${document.version}`);
      if (ppt) router.push(`/?view=ppt&source=plan&minutes=${duration}&pages=${pages}&focus=${focus}&request=${crypto.randomUUID()}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "保存失败，请重试。"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-indigo-400/20 bg-[#121b2a] p-5" aria-label="计划书文档与版本">
    {stale && <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 text-sm leading-7 text-amber-100"><p>项目定位、资源或参考资料已变化。旧章节保留，请根据新信息重新检查后再生成 PPT。</p>{bound ? <button type="button" onClick={updatePreparation} className="mt-2 rounded-lg border border-amber-300 px-3 py-2">根据新定位更新问卷（保留章节）</button> : <Link href="/?view=topics" className="underline">返回确认项目定位 →</Link>}</div>}
    <div className="flex flex-wrap items-end justify-between gap-3"><label className="min-w-0 flex-1 text-xs text-slate-400">文档标题<input aria-label="计划书文档标题" value={document.title} onChange={(event) => store.setDocumentTitle(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm text-white" /></label><span className="text-xs text-indigo-200">v{document.version} · {confirmed}/{document.chapters.length} 章已确认 · {document.confirmed ? "现有章节已确认" : "草稿"}</span></div>
    <div className="flex flex-wrap gap-2" aria-label="计划书章节目录">{preparationChapters(preparation).map((entry) => { const chapter = document.chapters.find((item) => item.id === entry.id); return <button key={entry.id} type="button" onClick={() => { store.setActiveChapter(entry.id); store.setPhase("editor"); }} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:border-indigo-400">{entry.title} · {chapter?.confirmed ? "已确认" : chapter ? "草稿" : "未开始"}</button>; })}</div>
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300"><button type="button" disabled={busy || store.busy} onClick={() => void save()} className="rounded-lg border border-slate-600 px-3 py-2 disabled:opacity-40">保存版本</button><button type="button" disabled={busy || store.busy || !store.versions.some((version) => version.version !== document.version)} onClick={() => { store.restoreVersion(); onRestore(); setMessage("已恢复上一个版本，当前版本号递增；请重新核对 PPT。"); }} className="rounded-lg border border-slate-600 px-3 py-2 disabled:opacity-40">恢复上一个版本</button>{store.versions.slice(-4).map((version) => <button key={version.version} type="button" disabled={busy || store.busy} onClick={() => { store.restoreVersion(version.version); onRestore(); setMessage(`已恢复 v${version.version} 的内容。`); }} className="text-indigo-300 underline">恢复 v{version.version}</button>)}</div>
    <div className="grid gap-3 border-t border-slate-700 pt-4 sm:grid-cols-3"><label className="text-xs text-slate-400">答辩时长<select aria-label="答辩时长" value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white">{[5, 8, 10, 15, 20].map((minutes) => <option key={minutes} value={minutes}>{minutes} 分钟</option>)}</select></label><label className="text-xs text-slate-400">目标页数<input type="number" min={8} max={15} aria-label="计划书转PPT页数" value={pages} onChange={(event) => setPages(Math.max(8, Math.min(15, Number(event.target.value))))} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white" /></label><label className="text-xs text-slate-400">内容重点<select aria-label="PPT内容重点" value={focus} onChange={(event) => setFocus(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-white"><option value="evidence">评分与证据</option><option value="technical">技术与验证</option><option value="story">问题与方案</option></select></label></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-xs leading-6 text-amber-200">仅使用已确认章节。未确认的数字、案例与推断会被排除；确认章节不会自动核实【AI推断，请核验】。</p><button type="button" disabled={busy || store.busy || !confirmedBlocks(document).length || stale} onClick={() => void save(true)} className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-40">{busy ? "正在保存计划书…" : "生成 PPT"}</button></div>
    {message && <p role="status" className="break-words text-xs text-indigo-200">{message}</p>}
  </section>;
}
