"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, LoaderCircle, Search, Sparkles, Trophy } from "lucide-react";
import { useWorkspaceStore } from "@/modules/workspace";
import { competitionDisplayName as displayName, diverseShortlist } from "@/modules/preparation/domain";
import { PreparationEntry, PreparationHome } from "@/modules/preparation";
import { VerificationActions, VerificationText } from "@/modules/verification";
import { loadCampusCatalog } from "@/modules/campus-catalog";
import { findCompetition, getRecommendationCatalog } from "./data";
import { getFallbackCompetitions, matchCompetitions } from "./matcher";
import { gradeSchema, type Competition, type CompetitionMatch } from "./types";

const panel = "rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const field = "mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-emerald-600";

export function CompetitionRecommendation() {
  const router = useRouter();
  const project = useWorkspaceStore((state) => state.project);
  const [catalog, setCatalog] = useState(getRecommendationCatalog);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(0);
  const [level, setLevel] = useState("不限");
  const [pending, setPending] = useState<{ id: string; trackId: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [advice, setAdvice] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { const abort = new AbortController(); void loadCampusCatalog(abort.signal).then(() => { if (!abort.signal.aborted) setCatalog(getRecommendationCatalog()); }).catch(() => { if (!abort.signal.aborted) setError("学校目录读取失败，暂时展示已加载资料。"); }); return () => { abort.abort(); request.current?.abort(); }; }, []);
  const profile = project?.studentProfile;
  const input = useMemo(() => ({ major: profile?.major || "", grade: gradeSchema.safeParse(profile?.grade).success ? gradeSchema.parse(profile?.grade) : "不限" as const, interests: /木材|材料|林/.test(profile?.major || "") ? ["材料", "竹木", "创新创业", "乡村振兴"] : profile?.skills || [], levelPreference: "不限" as const, timePreference: "不限" as const, profile }), [profile]);
  const campus = catalog.filter((item) => item.campusCatalog);
  const sourceCatalog = campus.length ? campus : catalog;
  const ranked = useMemo(() => { const result = matchCompetitions(input, sourceCatalog); return result.length ? result : getFallbackCompetitions(input, sourceCatalog); }, [input, sourceCatalog]);
  const shortlist = diverseShortlist(ranked);
  const filtered = ranked.filter((item) => (!query.trim() || `${item.name} ${item.introduction} ${item.keywords.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())) && (level === "不限" || item.campusRecognitionLevel === level));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 9));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = all ? filtered.slice(currentPage * 9, (currentPage + 1) * 9) : shortlist;
  const chosen = findCompetition(project?.selectedCompetitionId);
  const explain = async () => {
    if (!project) return;
    request.current?.abort(); const abort = new AbortController(); request.current = abort; setBusy(true); setError("");
    try { const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featureId: "competitionRecommendation", message: "请依据下方真实上下文解释三个候选的准备适配性、差异、缺口与下一步，不把准备建议当成报名资格。", recommendationContext: { profile, preparation: project.preparation, candidates: shortlist.map((item) => ({ id: item.competitionId, name: item.name, reasons: item.reasons, warnings: item.eligibilityWarnings, officialSourceUrl: item.officialSourceUrl, verificationStatus: item.verificationStatus })) } }), signal: abort.signal }); if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || "AI 分析暂不可用"); } const answer = await response.text(); if (!abort.signal.aborted) setAdvice(answer); }
    catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : "AI 分析失败"); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  };
  const pick = (competition: Competition, trackId: string) => { setPending({ id: competition.competitionId, trackId }); setConfirmed(false); };
  return <div className="space-y-5"><PreparationEntry /><header><p className="text-xs font-semibold tracking-widest text-emerald-700">第一步 · 选比赛</p><h2 className="mt-2 text-2xl font-bold">从你的专业与资源，找到值得投入的比赛。</h2><p className="mt-3 text-sm leading-7 text-slate-600">{profile?.school} · {profile?.major} · {profile?.competitionGoal}</p></header>
    {chosen && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-slate-900"><div><p className="text-xs font-medium text-emerald-800">当前备赛选择 · {project?.competitionConfirmedAt ? "学生已确认选择" : "尚未确认选择"}</p><p className="mt-2 font-semibold">{displayName(chosen.name)}</p><p className="mt-2 text-sm"><VerificationText text={chosen.tracks.find((track) => track.trackId === project?.selectedTrackId)?.name} href="/?view=requirements" /></p></div><Link href="/?view=topics" className={primary}>继续比较项目方向<ArrowRight size={16} /></Link></section>}
    <details className={panel} open={project?.preparation.demo && !Object.keys(project.preparation.answers).length}><summary className="cursor-pointer font-semibold">补充资源，为候选比较和后续写作提供依据</summary><div className="mt-5"><PreparationHome compact /></div></details>
    <section className={panel} aria-label="赛事资料核对"><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="font-bold">核对比赛要求与赛道</h3><p className="mt-2 text-sm leading-7 text-slate-500">候选比较解决“适不适合投入”；本届通知、报名资格、评分条款和官方来源需要在分析工作台逐项核对。</p></div><div className="flex flex-wrap gap-3"><Link href="/?view=requirements" className={secondary}>打开比赛要求分析<ArrowRight size={15} /></Link><Link href="/?view=verification" className={secondary}>查看待核验事项</Link></div></div></section>
    <section className={panel}><div className="flex flex-wrap items-center justify-between gap-4"><div><h3 className="flex items-center gap-2 text-lg font-bold"><Trophy size={19} className="text-emerald-700" />{all ? "全部比赛目录" : "优先比较这三个候选"}</h3><p className="mt-2 text-sm leading-7 text-slate-500">准备适配建议综合专业、资源与目录信息；资料不完整会单独标记，报名条件仍需核对本届通知。</p></div><div className="flex flex-wrap gap-2"><button type="button" className={secondary} disabled={busy} onClick={() => void explain()}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}AI 比较候选</button><button type="button" className={secondary} onClick={() => { setAll(!all); setPage(0); }}>{all ? "回到推荐" : `浏览全部目录（${ranked.length}）`}</button></div></div>
      {all && <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_200px]"><label className="text-sm">搜索比赛<input aria-label="搜索比赛目录" className={field} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="赛事名称或关键词" /></label><label className="text-sm">校内认定筛选<select aria-label="校内认定筛选" className={field} value={level} onChange={(event) => { setLevel(event.target.value); setPage(0); }}>{["不限", ...new Set(campus.map((item) => item.campusRecognitionLevel).filter((value): value is string => Boolean(value)))].map((item) => <option key={item}>{item}</option>)}</select></label></div>}
      {error && <p role="alert" className="mt-4 text-sm text-rose-700">{error}</p>}{advice && <div className="mt-4 whitespace-pre-wrap rounded-xl bg-emerald-50 p-4 text-sm leading-7"><VerificationText text={advice} /></div>}
    </section>
    <section className="grid gap-5 xl:grid-cols-3" aria-label="比赛候选">{visible.map((item, index) => <CompetitionCard key={item.id} competition={item} index={all ? currentPage * 9 + index : index} chosen={project?.selectedCompetitionId === item.id} onPick={pick} />)}</section>
    {!visible.length && <section className={panel}><Search size={22} className="text-slate-400" /><p className="mt-3">没有找到对应目录项。试试其他关键词或清除认定筛选。</p></section>}
    {all && <div className="flex items-center justify-between gap-3"><button type="button" className={secondary} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button><span className="text-xs text-slate-500">第 {currentPage + 1} / {pageCount} 页 · {filtered.length} 条</span><button type="button" className={secondary} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>下一页</button></div>}
    {pending && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"><section role="dialog" aria-modal="true" aria-labelledby="competition-choice-title" className="w-full max-w-lg rounded-2xl bg-white p-6 text-slate-900"><h2 id="competition-choice-title" className="text-lg font-bold">确认备赛选择</h2><p className="mt-4 text-sm leading-7">{displayName(findCompetition(pending.id)?.name || "当前比赛")}</p><p className="mt-3 text-sm leading-7 text-slate-600">选择表示你准备围绕这个比赛开展项目。更换比赛或赛道后，旧报告、章节和任务保留在历史中，新选择使用独立上下文。</p><div className="mt-3"><VerificationText text={findCompetition(pending.id)?.tracks.find((track) => track.trackId === pending.trackId)?.name || "赛道待核验"} href="/?view=requirements" /></div><label className="mt-5 flex items-start gap-3 text-sm leading-7"><input type="checkbox" className="mt-2" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />我已确认备赛选择，了解本届资格与官方赛道需独立核对。</label><div className="mt-5 flex justify-end gap-3"><button type="button" className={secondary} onClick={() => setPending(null)}>取消</button><button type="button" className={primary} disabled={!confirmed} onClick={() => { const store = useWorkspaceStore.getState(); store.selectCompetition(pending.id, pending.trackId); store.confirmCompetition(); setPending(null); router.push("/?view=topics"); }}>确认选择，比较方向<ArrowRight size={15} /></button></div></section></div>}
  </div>;
}

function CompetitionCard({ competition: c, index, chosen, onPick }: { competition: CompetitionMatch; index: number; chosen: boolean; onPick: (competition: Competition, track: string) => void }) {
  const [track, setTrack] = useState(c.tracks[0]?.trackId || "");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const source = c.officialSourceUrl || c.campusSourceUrl || undefined;
  const download = async () => {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/competition-recommendation/${encodeURIComponent(c.id)}/download`); if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.error || "资料下载失败"); } const url = URL.createObjectURL(await response.blob()); const link = document.createElement("a"); link.href = url; link.download = `${c.name}-比赛要求`; link.click(); URL.revokeObjectURL(url); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "下载失败"); } finally { setBusy(false); }
  };
  const planning = c.reasons.filter((reason) => ["专业与资源准备建议", "专业标签匹配", "兴趣方向匹配", "资源基础", "参赛目标"].includes(reason.label)).slice(0, 3);
  return <article className={panel + " flex flex-col"}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-emerald-700">候选 {String(index + 1).padStart(2, "0")}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{c.category === "资料待完善" ? "资料需完善" : c.category}</span></div><h3 className="mt-4 text-lg font-bold leading-8">{displayName(c.name)}</h3><p className="mt-3 text-sm leading-7 text-slate-600">{planning[0]?.detail || "已收录于学校目录，专业和应用条件需要进一步比较。"}</p>
    <div className="mt-4 space-y-3 border-y border-slate-100 py-4 text-xs leading-7"><p>赛事层级：<VerificationText text={c.externalLevel} source={source} href={source} /></p><div>校内认定：{c.campusRecognitionLevel || "资料未提供"}{!c.campusCatalog?.recognitionVerified && <span className="ml-2"><VerificationActions id={`recognition-${c.id}`} subject={`${c.name}的学校认定等级、适用学年与范围`} source={c.campusSourceUrl || c.campusCatalog?.sourceFile || ""} href={c.campusSourceUrl || "/admin"} /></span>}</div><div>本届报名与资格：{c.verificationStatus === "verified" ? "已有核验资料，请核对适用届次" : <VerificationActions id={`eligibility-${c.id}`} subject={`${c.name}本届报名时间、年级、专业与团队资格`} source={source} href={source} />}</div></div>
    <label className="mt-4 text-xs font-semibold text-slate-600">备赛赛道<select aria-label={`${c.name}备赛赛道`} className={field} value={track} onChange={(event) => setTrack(event.target.value)}>{c.tracks.map((item) => <option key={item.trackId} value={item.trackId}>{item.name.replaceAll("待核验", "资料需完善")}</option>)}</select></label>{c.tracks.find((item) => item.trackId === track)?.verificationStatus !== "verified" && <div className="mt-2"><VerificationActions id={`track-${c.id}-${track}`} subject={`${c.name}：${c.tracks.find((item) => item.trackId === track)?.name}的本届适用性`} source={source} href={source} /></div>}
    <details className="mt-4 text-xs leading-7"><summary className="cursor-pointer font-semibold text-slate-600">推荐依据与目录来源</summary><div className="mt-3 space-y-2">{c.reasons.map((reason) => <p key={reason.label}><strong>{reason.label}：</strong><VerificationText text={reason.detail} source={source} href={source} /></p>)}<p><VerificationText text={c.eligibilityWarnings.join("；")} source={source} href={source} /></p><p>目录来源：{c.campusCatalog?.sourceFile || (c.dataMode === "demo" ? "演示赛事资料" : "维护资料")}</p><p>学年度：<VerificationText text={c.campusCatalog?.academicYear || "待核验"} source={c.campusSourceUrl || c.campusCatalog?.sourceFile || ""} href={c.campusSourceUrl || "/admin"} /></p></div></details>
    <div className="mt-auto space-y-3 pt-5"><button type="button" className={primary + " w-full"} disabled={!track} onClick={() => onPick(c, track)}>{chosen ? <Check size={15} /> : <Trophy size={15} />}{chosen ? "已选择，核对并继续" : "选择此比赛"}</button><div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => void download()} className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-slate-600">{busy ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />}比赛要求下载</button>{source ? <a href={source} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline">查看来源 ↗</a> : <VerificationActions id={`source-${c.id}`} subject={`${c.name}官方来源链接`} />}</div>{error && <p role="alert" className="text-xs leading-6 text-rose-700">{error}</p>}</div>
  </article>;
}
