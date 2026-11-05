import type { StepStatus } from "../stream-types";

export const progressStyles = {
  panel: "rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5",
  header: "flex flex-wrap items-start justify-between gap-3",
  title: "flex items-center gap-2 text-sm font-bold text-slate-900",
  subtitle: "mt-1 text-xs leading-5 text-slate-500",
  tools: "flex max-w-full flex-wrap items-center gap-2",
  read: "inline-flex min-h-11 items-center rounded-xl bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-500",
  inlineIcon: "inline",
  statusIcon: "mt-0.5 shrink-0",
  time: "text-xs tabular-nums text-slate-500",
  cancel: "min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-indigo-500",
  grid: "mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  step: "min-w-0 rounded-xl border p-3",
  label: "flex items-center gap-2 text-xs font-semibold",
  icon: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px]",
  detail: "mt-2 text-[11px] leading-5 opacity-80",
  spinner: "motion-safe:animate-spin",
  current: "mt-4 flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-3 text-xs leading-5 text-indigo-800",
  footer: "mt-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500",
  logs: "mt-3 border-t border-slate-100 pt-3 text-xs leading-6 text-slate-500",
  logTitle: "cursor-pointer font-medium text-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-500",
  error: "mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-6 text-rose-800",
} as const;
export const stepStyles: Record<StepStatus, { card: string; icon: string }> = {
  waiting: { card: "border-slate-100 bg-slate-50 text-slate-500", icon: "bg-slate-200 text-slate-600" },
  running: { card: "border-indigo-300 bg-indigo-50 text-indigo-800", icon: "bg-indigo-600 text-white" },
  done: { card: "border-emerald-100 bg-emerald-50/60 text-emerald-800", icon: "bg-emerald-600 text-white" },
  warning: { card: "border-amber-200 bg-amber-50 text-amber-800", icon: "bg-amber-100 text-amber-800" },
  error: { card: "border-rose-200 bg-rose-50 text-rose-800", icon: "bg-rose-100 text-rose-700" },
};
