export const coverageStyles = {
  panel: "rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm",
  title: "flex items-center gap-2 text-sm font-semibold text-slate-900",
  hint: "mt-2 text-xs leading-6 text-slate-500",
  grid: "mt-4 grid gap-3 sm:grid-cols-2",
  row: "scroll-mt-28 rounded-xl border border-slate-200 bg-slate-50 p-4 outline-none focus:ring-2 focus:ring-indigo-400",
  active: "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100",
  heading: "text-sm font-semibold text-slate-800",
  text: "mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-600",
  badge: "mt-2 inline-block rounded-full bg-white px-2 py-1 text-xs text-indigo-700",
  link: "mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500",
  error: "mt-3 text-xs leading-6 text-rose-700",
} as const;
