"use client";

import { useState } from "react";
import { useProjectPlanStore } from "../plan.store";
import { savePlanDocument } from "../services/document-api";

export function DocumentPanel({ onRestore }: { onRestore: () => void }) {
  const store = useProjectPlanStore();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const document = store.document; if (!document) return null;
  const save = async () => {
    setBusy(true); setMessage(""); const scope = store.scopeKey; store.saveVersion();
    try { const saved = await savePlanDocument(document); if (useProjectPlanStore.getState().scopeKey === scope) setMessage(`已保存版本 v${saved.reference.version}`); }
    catch (error) { if (useProjectPlanStore.getState().scopeKey === scope) setMessage(error instanceof Error ? error.message : "同步保存失败，本地草稿已保留。"); }
    finally { setBusy(false); }
  };
  return <details className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-900" aria-label="计划书文档与版本"><summary className="cursor-pointer text-sm font-semibold">文档标题与历史版本</summary><div className="mt-4 space-y-4"><label className="block text-sm text-slate-600">文档标题<input aria-label="计划书文档标题" value={document.title} onChange={(event) => store.setDocumentTitle(event.target.value)} maxLength={160} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100" /></label><div className="flex flex-wrap items-center gap-3 text-sm"><span className="text-slate-500">当前版本 v{document.version}</span><button type="button" disabled={busy || store.busy} onClick={() => void save()} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 disabled:opacity-40">保存版本</button>{store.versions.slice(-4).filter((version) => version.version !== document.version).map((version) => <button key={version.version} type="button" disabled={busy || store.busy} onClick={() => { store.restoreVersion(version.version); onRestore(); setMessage(`已恢复 v${version.version}，原版本仍保留。`); }} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-emerald-700 disabled:opacity-40">恢复 v{version.version}</button>)}</div>{message && <p role="status" className="text-sm text-slate-600">{message}</p>}</div></details>;
}
