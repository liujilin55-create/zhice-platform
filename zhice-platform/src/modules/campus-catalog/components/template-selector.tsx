"use client";
import { VerificationText } from "@/modules/verification";
import { useEffect, useMemo, useState } from "react";
import { loadCampusCatalog } from "../services";
import { formalTemplate, reviewLabels, type TemplateRecord } from "../types";
import { TemplatePreview } from "./template-preview";
import type { CompetitionBinding } from "@/shared/contracts/competition-binding";
import { findCompetition } from "@/modules/competition-recommendation/data";

export function TemplateSelector({ value, onChange, binding, disabled }: { value: string; onChange: (id: string) => void; binding: CompetitionBinding | null; disabled: boolean }) {
  const [records, setRecords] = useState<TemplateRecord[]>([]); const [error, setError] = useState("");
  useEffect(() => { const abort = new AbortController(); void loadCampusCatalog(abort.signal).then((data) => setRecords(data.templates)).catch(() => { if (!abort.signal.aborted) setError("参考版式暂不可用，平台原创模板仍可选择。"); }); return () => abort.abort(); }, []);
  const ranked = useMemo(() => {
    const competition = findCompetition(binding?.competitionId); const track = competition?.tracks.find((t) => t.trackId === binding?.trackId);
    return records.map((record) => ({ record, score: (record.data.competitionId === competition?.competitionId ? 10 : record.data.sourceCompetition === competition?.name ? 8 : 0) + (track && record.data.tracks.includes(track.name) ? 5 : 0) })).sort((a, b) => b.score - a.score);
  }, [records, binding]);
  const recommended = ranked.find((item) => item.score > 0 && formalTemplate(item.record));
  return <section className="mt-5 rounded-xl border border-slate-200 p-4" aria-label="获奖版式来源与授权"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">比赛与赛道 · 可复用版式</h3><p className="mt-2 text-xs leading-6 text-slate-500">平台原创模板可直接使用。获奖参考仅提取视觉规则；来源、授权未确认时只能浏览参考风格。</p></div>{recommended && <button type="button" disabled={disabled} onClick={() => onChange(recommended.record.templateId)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">使用推荐：{recommended.record.data.name}</button>}</div>
    {error && <p className="mt-3 text-xs text-amber-700">{error}</p>}{!records.length && <p className="mt-3 text-xs text-slate-500">尚无已登记的获奖参考，当前使用平台原创版式，不宣称来自获奖作品。</p>}
    <div className="mt-4 grid gap-3 lg:grid-cols-2">{ranked.map(({ record: t, score }) => <article key={t.templateId} className={`rounded-xl border p-4 ${value === t.templateId ? "border-indigo-400 bg-indigo-50" : "border-slate-200"}`}><div className="flex justify-between gap-2"><strong className="text-sm text-slate-800">{t.data.name}</strong><span className={"text-xs " + (formalTemplate(t) ? "text-emerald-700" : "text-amber-700")}>{formalTemplate(t) ? "正式可用" : "参考风格"} · <VerificationText text={reviewLabels[t.verificationStatus]} source={t.data.sourceUrl || t.data.sourceFile} href={t.data.sourceUrl || "/admin"} /></span></div><p className="mt-2 text-xs leading-6 text-slate-500">{score > 0 ? "匹配当前比赛或赛道 · " : "通用参考 · "}{t.data.sourceCompetition} / {t.data.year} / <VerificationText text={t.data.tracks.join("、") || "赛道待核验"} source={t.data.sourceUrl || t.data.sourceFile} href={t.data.sourceUrl || "/admin"} /><br />文件：{t.data.sourceFile}{t.data.sourceUrl && <a className="ml-2 text-indigo-600 underline" href={t.data.sourceUrl} target="_blank" rel="noreferrer">来源 ↗</a>}<br />权限：<VerificationText text={t.data.authorizationNote} source={t.data.authorizationSource || t.data.sourceFile} href="/admin" /><br />授权依据：<VerificationText text={t.data.authorizationSource || "待核验"} source={t.data.sourceFile} href="/admin" /><br />适用：{t.data.scenarios.join("、")} · {t.data.type}</p><details className="mt-2 text-xs text-indigo-700"><summary className="cursor-pointer">查看平台自绘预览与版式</summary><div className="mt-3"><TemplatePreview config={t.data.config} /></div></details><button type="button" disabled={disabled || !formalTemplate(t)} aria-pressed={value === t.templateId} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:bg-slate-100 disabled:text-slate-500" onClick={() => onChange(t.templateId)}>{value === t.templateId ? "已选择" : formalTemplate(t) ? "选择此模板" : "仅供参考，暂不能用于生成"}</button></article>)}</div>
  </section>;
}
