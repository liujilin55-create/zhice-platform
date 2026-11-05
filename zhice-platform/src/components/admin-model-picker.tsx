"use client";

import { useEffect, useRef, useState } from "react";
import { ListFilter, LoaderCircle } from "lucide-react";
import type { AvailableAiModel } from "@/lib/ai-models";

type Props = {
  featureId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  clearApiKey: boolean;
  onModelChange: (model: string) => void;
};

export function AdminModelPicker({ featureId, apiKey, baseUrl, model, clearApiKey, onModelChange }: Props) {
  const [models, setModels] = useState<AvailableAiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  const loadModels = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setModels([]); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featureId, config: { apiKey, baseUrl, clearApiKey } }), signal: controller.signal });
      const payload = await response.json() as { ok?: boolean; error?: string; models?: AvailableAiModel[] };
      if (!response.ok || !payload.ok || !Array.isArray(payload.models)) throw new Error(payload.error || "模型列表读取失败。");
      setModels(payload.models);
      setNotice(payload.models.length ? `平台返回 ${payload.models.length} 个模型 ID；选择后请测试连接。` : "平台未返回可用模型，请核对密钥和模型权限。");
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "模型列表读取失败。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  return <div className="space-y-2">
    <div className="flex items-center gap-2">
      <input aria-label="API 模型 ID" value={model} onChange={(event) => onModelChange(event.target.value)} placeholder="填写 API 模型 ID，例如 kimi-k3.1-pro" className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-indigo-300" />
      <button type="button" disabled={loading || !baseUrl.trim() || clearApiKey} onClick={() => void loadModels()} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-white px-3 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
        {loading ? <LoaderCircle size={13} className="animate-spin" /> : <ListFilter size={13} />}{loading ? "获取中…" : "获取可用模型"}
      </button>
    </div>
    {models.length > 0 && <select aria-label="选择平台返回的模型" value={models.some((item) => item.id === model) ? model : ""} onChange={(event) => { if (event.target.value) onModelChange(event.target.value); }} className="h-10 w-full rounded-xl border border-indigo-200 bg-indigo-50/40 px-3 text-[12px] text-slate-700 outline-none">
      <option value="" disabled>从平台返回的模型 ID 中选择</option>
      {models.map((item) => <option key={item.id} value={item.id}>{item.id}{item.ownedBy ? ` · ${item.ownedBy}` : ""}</option>)}
    </select>}
    {notice && <p role="status" className="text-[10px] leading-4 text-slate-500">{notice}</p>}
    {error && <p role="alert" className="text-[10px] leading-4 text-rose-600">{error}</p>}
  </div>;
}
