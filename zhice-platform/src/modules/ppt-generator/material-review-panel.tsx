"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleHelp } from "lucide-react";
import { VerificationCenter } from "@/modules/verification";
import type { MaterialReviewItem } from "./material-review";
import type { MaterialReviewRecord } from "./material-review-record";
import type { PptCheck, PptOutline } from "./types";

export function MaterialReviewPanel({ items, checks, outline, onPresentation, reviewRecord, reviewInvalidated, canReview, onReview }: {
  items: MaterialReviewItem[]; checks: PptCheck[]; outline: PptOutline | null; onPresentation: () => void;
  reviewRecord: MaterialReviewRecord | null; reviewInvalidated: boolean; canReview: boolean; onReview: () => void;
}) {
  const pending = items.filter((item) => item.state !== "ready").length;
  return <section className="space-y-5" aria-label="集中材料自查">
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-slate-900">
      <h3 className="text-lg font-bold">{reviewRecord ? "本版材料已检查" : "提交前，集中检查这一页"}</h3>
      <p className="mt-2 text-sm leading-7 text-slate-600">{pending ? `仍有 ${pending} 类资料待补充或核实。可继续导出带标记的草稿，正式提交前再完善。` : "基础材料已具备。自动检查不替代原文与本届比赛要求的人工核对。"}</p>
      <p className="mt-2 text-sm leading-7 text-slate-600">“已检查”仅记录你看过本版材料，不代表事实已核实；缺项、草稿标记与来源核验状态会继续保留。</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onReview} disabled={!canReview || Boolean(reviewRecord)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"><Check size={17} />{reviewRecord ? "本版已检查" : "确认本版材料已检查"}</button>
        <p role="status" className={`text-xs leading-6 ${reviewInvalidated ? "text-amber-800" : "text-slate-600"}`}>{reviewRecord ? `检查时间：${new Date(reviewRecord.reviewedAt).toLocaleString("zh-CN")}` : reviewInvalidated ? "材料已变化，上次检查记录不适用于本版，请重新检查。" : "材料修改后，需要重新检查当前版本。"}</p>
      </div>
    </div>
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-5">
      {items.map((item) => <article key={item.id} className="flex flex-wrap items-start gap-3 py-5">
        {item.state === "ready" ? <Check size={20} className="mt-1 shrink-0 text-emerald-700" /> : <CircleHelp size={20} className="mt-1 shrink-0 text-amber-700" />}
        <div className="min-w-0 flex-1"><h4 className="font-semibold text-slate-900">{item.title}<span className={`ml-3 text-xs font-normal ${item.state === "ready" ? "text-emerald-700" : "text-amber-700"}`}>{item.state === "ready" ? "已整理" : item.state === "missing" ? "待补充" : reviewRecord ? "已检查 · 仍待完善" : "待核对"}</span></h4><p className="mt-2 text-sm leading-7 text-slate-600">{item.detail}</p></div>
        {item.id === "presentation" ? <button type="button" onClick={onPresentation} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-emerald-700">查看大纲<ArrowRight size={15} /></button> : <Link href={item.href} className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-medium text-emerald-700">{item.state === "ready" ? "查看" : "去完善"}<ArrowRight size={15} /></Link>}
      </article>)}
    </div>
    {!!checks.length && <details className="rounded-2xl border border-slate-200 bg-white p-5" open={checks.some((check) => check.severity === "error")}>
      <summary className="cursor-pointer font-semibold text-slate-900">演示文稿检查详情 · {checks.length} 项</summary>
      <div className="mt-4 space-y-2">{checks.map((check, index) => <p key={`${check.code}-${index}`} className={`rounded-xl p-3 text-sm leading-6 ${check.severity === "error" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-800"}`}>{check.slideId && `第 ${(outline?.slides.findIndex((slide) => slide.id === check.slideId) ?? -1) + 1} 页：`}{check.message}</p>)}</div>
    </details>}
    <details className="rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold text-slate-900">来源记录与补充说明</summary><div className="mt-4"><VerificationCenter /></div></details>
  </section>;
}
