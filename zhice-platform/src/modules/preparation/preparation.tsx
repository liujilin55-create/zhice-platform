"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Check, FlaskConical, Leaf, LoaderCircle, MessageCircle, Search, Sparkles } from "lucide-react";
import { z } from "zod";
import { preparationStepView, useWorkspaceStore, projectBinding, projectScopeKey } from "@/modules/workspace";
import { useProjectPlanStore } from "@/modules/project-plan";
import { emptySurveySession } from "@/modules/project-plan/types";
import { findCompetition } from "@/modules/competition-recommendation";
import { VerificationActions, VerificationText } from "@/modules/verification";
import { apiRequest } from "@/shared/api-client";
import { paperSchema } from "@/modules/competition-requirements/types";
import { demoProfile, nextQuestion, preparationKeywords, questions, selectedTopic, topics, topicValues } from "./domain";

const panel = "rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";
const field = "mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm leading-7 text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

export function PreparationEntry() {
  const router = useRouter();
  const ready = useWorkspaceStore((state) => state.ready);
  const projects = useWorkspaceStore((state) => state.projects);
  const start = () => {
    const existing = projects.find((project) => project.preparation.demo);
    const store = useWorkspaceStore.getState();
    if (existing) { store.switchProject(existing.projectId); router.push(`/?view=${preparationStepView(existing)}`); return; }
    const projectId = store.newProject("政和科技小院 · 竹木材料创新项目", demoProfile()); store.updatePreparation({ demo: true });
    router.push(`/?view=${preparationStepView(store.projects.find((project) => project.projectId === projectId) || null)}`);
  };
  return <section className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-slate-900"><div className="max-w-2xl"><p className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><Leaf size={15} />福建农林大学 · 政和科技小院演示</p><h2 className="mt-2 text-lg font-bold">从专业与产业资源，走到一套参赛材料</h2><p className="mt-2 text-sm leading-7 text-slate-600">木材科学与工程 → 资源访谈 → 选赛定题 → 在线计划书 → 可编辑 PPT。创建独立项目，随时可切回原项目。</p></div><button type="button" disabled={!ready} onClick={start} className={primary}>{projects.some((project) => project.preparation.demo) ? "继续政和演示" : "开始政和演示"}<ArrowRight size={16} /></button></section>;
}

export function PreparationSteps() {
  const params = useSearchParams();
  const project = useWorkspaceStore((state) => state.project);
  if (!project) return null;
  const view = params.get("view") || "journey";
  type StepStatus = "not-started" | "in-progress" | "needs-verification" | "complete";
  const statusLabels: Record<StepStatus, string> = { "not-started": "未开始", "in-progress": "进行中", "needs-verification": "待核验", complete: "已完成" };
  const answered = questions.filter((item) => project.preparation.answers[item.id]?.trim()).length;
  const selectedCompetition = findCompetition(project.selectedCompetitionId);
  const selectedTrack = selectedCompetition?.tracks.find((track) => track.trackId === project.selectedTrackId);
  const competitionVerified = selectedCompetition?.verificationStatus === "verified" && selectedTrack?.verificationStatus === "verified";
  const competitionStatus: StepStatus = !project.selectedCompetitionId && answered === 0 ? "not-started" : !project.competitionConfirmedAt ? "in-progress" : competitionVerified ? "complete" : "needs-verification";
  const topicConfirmed = project.preparation.topicBinding === projectScopeKey(project) && Boolean(project.preparation.topicConfirmedAt);
  const topicStatus: StepStatus = !project.preparation.topicId ? "not-started" : !topicConfirmed ? "in-progress" : project.preparation.research.length ? "needs-verification" : "needs-verification";
  const assetStatus = (status: "not_started" | "draft" | "confirmed" | "exported"): StepStatus => status === "not_started" ? "not-started" : status === "draft" ? "in-progress" : "complete";
  const steps = [
    { view: "competitions", label: "画像与选赛", hint: "画像 · 资源 · 赛事", status: competitionStatus, active: ["journey", "profile", "projects", "competitions", "requirements"].includes(view) },
    { view: "topics", label: "定题与找依据", hint: "选题 · 案例 · 论文", status: topicStatus, active: ["topics", "evidence"].includes(view) },
    { view: "plan", label: "计划书与 Word", hint: "在线编辑 · 导出", status: assetStatus(project.documentStatus), active: view === "plan" },
    { view: "ppt", label: "PPT 与材料自查", hint: "排版 · 导出 · 检查", status: assetStatus(project.pptStatus), active: ["ppt", "check"].includes(view) },
  ];
  return <nav aria-label="材料准备四步" className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-4">{steps.map((step, index) => <Link key={step.view} href={`/?view=${step.view}`} aria-current={step.active ? "step" : undefined} className={`flex min-h-16 items-center gap-3 rounded-xl px-3 py-3 text-slate-600 transition hover:bg-slate-50 ${step.active ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200" : ""}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.status === "complete" ? "bg-emerald-700 text-white" : step.status === "needs-verification" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"}`}>{step.status === "complete" ? <Check size={14} /> : index + 1}</span><span><span className="block text-sm font-semibold">{step.label}</span><span className="mt-1 block text-xs text-slate-500">{step.hint}</span><span className={`mt-1 block text-[11px] font-medium ${step.status === "complete" ? "text-emerald-700" : step.status === "needs-verification" ? "text-amber-700" : "text-slate-400"}`}>{statusLabels[step.status]}</span></span></Link>)}</nav>;
}

export function PreparationHome({ compact = false }: { compact?: boolean }) {
  const project = useWorkspaceStore((state) => state.project);
  const [input, setInput] = useState("");
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  if (!project) return <PreparationEntry />;
  const prep = project.preparation;
  const question = nextQuestion(prep);
  const answered = questions.filter((item) => prep.answers[item.id]?.trim());
  const saveAnswer = (value: string) => {
    if (!question || !value.trim()) return;
    useWorkspaceStore.getState().updatePreparation({ answers: { ...prep.answers, [question.id]: value.trim().slice(0, 2000) } });
    setInput(""); setAdvice("");
  };
  const analyze = async () => {
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    const owner = project.projectId; setBusy(true); setError("");
    try {
      const response = await fetch("/api/preparation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: project.studentProfile, preparation: prep, competitionId: project.selectedCompetitionId }), signal: abort.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "资源分析暂不可用");
      if (useWorkspaceStore.getState().currentProjectId === owner) setAdvice(result.data);
    } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "资源分析失败"); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  };
  return <div className="space-y-5">{!compact && <><PreparationEntry /><header><p className="text-xs font-bold tracking-widest text-emerald-700">从你的真实条件出发</p><h2 className="mt-2 text-2xl font-bold text-slate-900">先问清资源，再决定参加什么。</h2><p className="mt-3 text-sm leading-7 text-slate-600">{project.studentProfile.school} · {project.studentProfile.college} · {project.studentProfile.major}</p></header></>}
    <section className={panel} aria-label="资源访谈"><div className="flex flex-wrap justify-between gap-3"><h3 className="flex items-center gap-2 font-bold"><MessageCircle size={18} className="text-emerald-700" />参赛起点与资源访谈</h3><span className="text-xs text-slate-500">{answered.length} / {questions.length} 项已填写</span></div>
      <div className="mt-4 flex flex-wrap gap-2">{[["new", "还没有明确项目"], ["existing", "已有项目，寻找适合的比赛"]].map(([id, label]) => <button type="button" key={id} aria-pressed={prep.entry === id} onClick={() => useWorkspaceStore.getState().updatePreparation({ entry: id as "new" | "existing" })} className={secondary + (prep.entry === id ? " border-emerald-600 bg-emerald-50 text-emerald-800" : "")}>{label}</button>)}</div>
      {prep.demo && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">已知背景来自用户：学校、学院、专业、政和县科技小院合作。年级尚未填写；每周 8 小时与预算 0 元为可修改的准备参数。示例回答均标为演示假设，需要实际核实。</p>}
      {prep.entry === "existing" && <label className="mt-4 block text-sm font-medium">已有项目的内容与进展<textarea aria-label="已有项目介绍" rows={3} className={field} value={prep.answers.existing || ""} onChange={(event) => useWorkspaceStore.getState().updatePreparation({ answers: { ...prep.answers, existing: event.target.value.slice(0, 2000) } })} placeholder="做什么、服务谁、目前完成了哪些工作" /></label>}
      {answered.length > 0 && <details className="mt-5" open={!compact}><summary className="cursor-pointer text-sm font-semibold text-slate-700">已收集的资源与回答（可修改）</summary><div className="mt-3 space-y-4">{answered.map((item) => <div key={item.id} className="border-l-2 border-emerald-200 pl-4"><label className="text-sm font-medium">{item.label}<textarea className={field} aria-label={`修改${item.id}回答`} value={prep.answers[item.id]} onChange={(event) => { useWorkspaceStore.getState().updatePreparation({ answers: { ...prep.answers, [item.id]: event.target.value.slice(0, 2000) } }); setAdvice(""); }} rows={2} /></label><div className="mt-2"><VerificationActions id={`resource-${item.id}`} scope={project.projectId} subject={`${item.label}\n${prep.answers[item.id]}`} source="" href="/?view=verification" /></div></div>)}</div></details>}
      {question ? <form className="mt-5" onSubmit={(event) => { event.preventDefault(); saveAnswer(input); }}><p className="text-base font-semibold">{question.label}</p><p className="mt-2 text-sm leading-7 text-slate-500">为什么问：{question.reason}</p><textarea required maxLength={2000} aria-label="资源访谈回答" rows={3} value={input} onChange={(event) => setInput(event.target.value)} placeholder="填写实际情况；暂时不清楚也可以说明" className={field} /><div className="mt-3 flex flex-wrap gap-3"><button type="submit" disabled={!input.trim()} className={primary}>记录回答，继续<ArrowRight size={15} /></button>{prep.demo && <button type="button" className={secondary} onClick={() => saveAnswer(question.example)}>使用本题演示回答（假设）</button>}</div></form> : <div className="mt-5 flex flex-wrap items-center gap-3"><Link className={primary} href="/?view=competitions">查看比赛建议<ArrowRight size={15} /></Link><button type="button" onClick={() => void analyze()} disabled={busy} className={secondary}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}AI 分析资源与下一步</button></div>}
      {advice && <div role="status" className="mt-5 whitespace-pre-wrap rounded-xl bg-emerald-50 p-4 text-sm leading-7"><VerificationText text={advice} /></div>}{error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </section>
  </div>;
}

const paperResult = z.object({ data: z.array(paperSchema), cached: z.boolean() });
export function TopicStudio() {
  const router = useRouter();
  const project = useWorkspaceStore((state) => state.project);
  const [title, setTitle] = useState(project?.preparation.topicTitle || topics[0].title);
  const [query, setQuery] = useState(project ? preparationKeywords(project.preparation) : "竹纤维 缓冲包装");
  const [results, setResults] = useState<z.infer<typeof paperResult> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [caseTitle, setCaseTitle] = useState(""); const [caseUrl, setCaseUrl] = useState(""); const [caseNote, setCaseNote] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  if (!project) return <PreparationEntry />;
  const competition = findCompetition(project.selectedCompetitionId);
  const prep = project.preparation;
  const topic = selectedTopic(prep);
  const binding = projectBinding(project);
  const bound = prep.topicBinding === projectScopeKey(project) && Boolean(prep.topicConfirmedAt);
  const choose = (id: string) => { const next = topics.find((item) => item.id === id)!; setTitle(next.title); setQuery(next.keywords.join(" ")); useWorkspaceStore.getState().updatePreparation({ topicId: id, topicTitle: next.title, topicBinding: null, topicConfirmedAt: null, research: [] }); setResults(null); };
  const confirm = () => { if (!binding || !topic || !title.trim()) return; useWorkspaceStore.getState().updatePreparation({ topicTitle: title.trim(), topicBinding: projectScopeKey(project), topicConfirmedAt: new Date().toISOString() }); useWorkspaceStore.getState().renameProject(title); };
  const goPlan = () => {
    const values = topicValues(prep, project.studentProfile); if (!values || !binding || !bound) return;
    const store = useProjectPlanStore.getState();
    if (!store.session.messages.length && !Object.keys(store.chapters).length) {
      const session = emptySurveySession(); session.binding = binding;
      for (const [id, value] of Object.entries(values)) { const key = id as keyof typeof session.slots; session.slots[key] = { ...session.slots[key], value, status: "captured" }; }
      session.currentSlot = null; session.complete = true;
      session.messages = [{ id: crypto.randomUUID(), role: "assistant", content: "已带入你确认的项目定位和资源访谈。演示假设、拟议方案与未完成实验均保留标记；可继续修改，再生成准备报告。", createdAt: new Date().toISOString() }];
      store.setSession(session); store.setPhase("survey");
    }
    router.push("/?view=plan");
  };
  const search = async () => {
    request.current?.abort(); const abort = new AbortController(); request.current = abort; setBusy(true); setError("");
    try { const result = await apiRequest("/api/papers", paperResult, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: query.trim() }), signal: abort.signal }); if (!abort.signal.aborted) setResults(result); }
    catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "文献检索失败"); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  };
  return <div className="space-y-5"><header><p className="text-xs font-semibold tracking-widest text-emerald-700">第二步 · 定方向</p><h2 className="mt-2 text-2xl font-bold text-slate-900">让专业、资源与问题对上号。</h2><p className="mt-3 text-sm leading-7 text-slate-600">{competition?.name || "先选择比赛"} · 方向为平台准备建议，创新点与应用表现以调研和验证为依据。</p></header>
    {!binding || !project.competitionConfirmedAt ? <section className={panel}><p className="text-sm leading-7">请先选择并确认比赛和候选赛道，再绑定项目方向。</p><Link className={primary + " mt-4"} href="/?view=competitions">去选择比赛</Link></section> : <>
      <section className="grid gap-4 xl:grid-cols-3" aria-label="三个项目方向">{topics.map((item) => <article key={item.id} className={panel + (topic?.id === item.id ? " border-emerald-500 ring-1 ring-emerald-300" : "")}><FlaskConical className="text-emerald-700" size={22} /><h3 className="mt-3 text-lg font-bold leading-7">{item.title}</h3><dl className="mt-4 space-y-3 text-sm leading-7">{[["问题与对象", `${item.user}；${item.problem}`], ["资源适配", item.resource], ["最小成果", item.output], ["验证与风险", item.risk]].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd>{value}</dd></div>)}</dl><button type="button" className={(topic?.id === item.id ? primary : secondary) + " mt-5 w-full"} onClick={() => choose(item.id)}>{topic?.id === item.id ? "当前比较方向" : "选择这个方向"}</button></article>)}</section>
      {topic && <section className={panel} aria-label="项目定位卡"><h3 className="text-lg font-bold">项目定位卡</h3><label className="mt-4 block text-sm font-semibold">项目名称<input aria-label="项目定位名称" value={title} maxLength={120} onChange={(event) => { setTitle(event.target.value); useWorkspaceStore.getState().updatePreparation({ topicTitle: event.target.value, topicConfirmedAt: null }); }} className={field} /></label><p className="mt-4 text-sm leading-7">技术路线（拟议）：{topic.route}</p><p className="mt-2 text-sm leading-7">差异化（待验证）：{topic.differentiation}</p><div className="mt-3"><VerificationActions id="topic-feasibility" subject={`${title}：${topic.risk}`} href="/?view=journey" /></div><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={!title.trim()} className={primary} onClick={confirm}>{bound ? "定位已确认，更新定位" : "确认方向与项目定位"}<Check size={15} /></button><Link href="/?view=requirements" className={secondary}>核对比赛要求与赛道</Link></div>{bound && <p className="mt-3 text-xs leading-6 text-emerald-700">已绑定当前比赛选择。定位确认表示准备方向确定，实验结论仍需单独验证。</p>}</section>}
      {topic && <section className={panel} aria-label="案例与论文研究"><h3 className="flex items-center gap-2 text-lg font-bold"><BookOpen size={19} className="text-emerald-700" />案例与论文依据</h3><p className="mt-2 text-sm leading-7 text-slate-500">围绕材料与应用问题查找来源，加入后随项目定位传入计划书。在线未找到匹配文献时会如实显示。</p><form className="mt-4 flex flex-wrap gap-3" onSubmit={(event) => { event.preventDefault(); void search(); }}><input aria-label="材料方向论文关键词" className={field + " m-0 min-w-0 flex-1"} value={query} maxLength={200} onChange={(event) => setQuery(event.target.value)} /><button disabled={busy || query.trim().length < 2} type="submit" className={primary}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />}检索相关论文</button></form>
        {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}{results && <div role="status" className="mt-4 space-y-4">{!results.data.length && <p className="text-sm text-amber-800">本次未取得匹配文献。可调整关键词，或通过下方登记已查到的来源。</p>}{results.data.map((paper) => <article key={paper.id} className="border-t border-slate-200 pt-4"><a href={paper.url} target="_blank" rel="noreferrer" className="font-semibold text-emerald-800 underline">{paper.title} ↗</a><p className="mt-2 text-xs text-slate-500">{paper.year} · {paper.authors.join("、")} · {paper.source}{results.cached ? " · 本地参考资料" : ""}</p><p className="mt-2 text-sm leading-7 text-slate-600">{paper.abstract}</p><div className="mt-3 flex flex-wrap gap-3"><VerificationActions id={`paper-${paper.id}`} subject={`核对这篇论文是否支持当前材料方案：${paper.title}`} source={paper.url} href={paper.url} /><button type="button" className={secondary} disabled={prep.research.some((item) => item.url === paper.url)} onClick={() => useWorkspaceStore.getState().updatePreparation({ research: [...prep.research, { title: paper.title, url: paper.url, excerpt: paper.abstract, kind: "paper" as const, source: paper.source }].slice(0, 30) })}>{prep.research.some((item) => item.url === paper.url) ? "已加入参考依据" : "加入参考依据"}</button></div></article>)}</div>}
        <form className="mt-6 border-t border-slate-200 pt-5" onSubmit={(event) => { event.preventDefault(); const url = z.string().url().safeParse(caseUrl); if (!url.success || !/^https?:/.test(caseUrl)) { setError("请填写有效的 http(s) 来源链接。"); return; } if (prep.research.some((item) => item.url === caseUrl)) { setError("该来源已加入。"); return; } useWorkspaceStore.getState().updatePreparation({ research: [...prep.research, { title: caseTitle.trim(), url: caseUrl, excerpt: caseNote.trim(), kind: "case" as const, source: "学生登记的案例或资料" }].slice(0, 30) }); setCaseTitle(""); setCaseUrl(""); setCaseNote(""); setError(""); }}><h4 className="font-semibold">登记查到的经典案例或技术资料</h4><label className="mt-3 block text-sm">资料标题<input required aria-label="参考案例标题" className={field} value={caseTitle} maxLength={200} onChange={(event) => setCaseTitle(event.target.value)} /></label><label className="mt-3 block text-sm">原始来源链接<input required aria-label="参考案例链接" className={field} value={caseUrl} onChange={(event) => setCaseUrl(event.target.value)} placeholder="https://…" /></label><label className="mt-3 block text-sm">支持什么结论，有哪些适用限制？<textarea required aria-label="参考案例适用说明" className={field} value={caseNote} maxLength={2000} onChange={(event) => setCaseNote(event.target.value)} /></label><button type="submit" className={secondary + " mt-3"}>加入项目参考依据</button></form>
        {!!prep.research.length && <div className="mt-5 space-y-3"><h4 className="font-semibold">已选参考依据 · {prep.research.length}</h4>{prep.research.map((item) => <div key={item.url} className="rounded-xl bg-slate-50 p-3 text-sm leading-7"><a href={item.url} target="_blank" rel="noreferrer" className="text-emerald-800 underline">{item.title}</a><p>{item.excerpt}</p><div className="mt-2 flex flex-wrap gap-3"><VerificationActions subject={`资料适配性：${item.title}`} source={item.url} href={item.url} /><button type="button" className="text-xs text-rose-700 underline" onClick={() => useWorkspaceStore.getState().updatePreparation({ research: prep.research.filter((row) => row.url !== item.url) })}>移出本项目依据</button></div></div>)}</div>}
      </section>}
      <section className={panel} aria-label="证据工作台入口"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">继续核对案例与证据</h3><p className="mt-2 text-sm leading-7 text-slate-500">本页负责把论文和案例加入项目依据；需要查看完整来源、原文摘录和引用关系时，进入证据库继续核对。</p></div><div className="flex flex-wrap gap-3"><Link href="/?view=evidence" className={secondary}>打开完整证据库<BookOpen size={15} /></Link><Link href="/?view=requirements" className={secondary}>查看赛事评分分析</Link></div></div></section>
      <section className={panel}><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">将项目定位带入计划书</h3><p className="mt-2 text-sm leading-7 text-slate-500">首次进入会带入访谈与拟议方案；已有的章节和人工修改会保留。</p></div><button type="button" disabled={!bound} className={primary} onClick={goPlan}>开始编写计划书<ArrowRight size={16} /></button></div></section>
    </>}
  </div>;
}
