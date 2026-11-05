"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, KeyRound, LogIn, LogOut, Save, ServerCog, ShieldCheck, Sparkles, TestTube2, X } from "lucide-react";
import { providerPresets, type AiProvider as Provider } from "@/lib/ai-providers";
import { CatalogAdmin } from "@/modules/campus-catalog";
import { AdminModelPicker } from "./admin-model-picker";

type FeatureId = "projectOverview" | "competitionRecommendation" | "competitionRequirements" | "evidenceCenter" | "taskOrchestration" | "deliverableCheck" | "pptGenerator";
type FeatureConfig = { id: FeatureId; label: string; description: string; provider: Provider; enabled: boolean; baseUrl: string; model: string; systemPrompt: string; temperature: number; maxTokens: number; hasApiKey: boolean; maskedApiKey: string; source: string; apiKey: string; clearApiKey: boolean };

function LoginPanel({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "登录失败");
      onLogin();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "登录失败，请重试。"); } finally { setLoading(false); }
  };
  return <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] p-5"><div className="w-full max-w-[420px] rounded-[28px] border border-slate-200 bg-white p-7 shadow-xl shadow-indigo-950/5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"><ServerCog size={21} /></div><div><div className="text-[17px] font-bold text-slate-900">知策台 · 管理后台</div><div className="mt-1 text-[11px] text-slate-400">国内大模型与提示词配置中心</div></div></div><div className="mt-7 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3 text-[11px] leading-5 text-indigo-800"><ShieldCheck size={14} className="mr-1 inline text-indigo-600" />API Key 只会保存到服务端，页面只展示脱敏状态。</div><form onSubmit={submit} className="mt-5 space-y-3"><div><label className="mb-1.5 block text-[11px] font-semibold text-slate-600">管理员账号</label><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50" /></div><div><label className="mb-1.5 block text-[11px] font-semibold text-slate-600">管理员密码</label><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50" /></div>{error && <div className="rounded-xl bg-rose-50 px-3 py-2.5 text-[11px] text-rose-700">{error}</div>}<button disabled={loading} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[12px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"><LogIn size={15} />{loading ? "正在验证…" : "登录配置中心"}</button></form><div className="mt-4 text-center text-[10px] text-slate-400">默认账号：admin · 默认密码：admin</div></div></div>;
}

function ConfigField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <div><label className="mb-1.5 block text-[11px] font-semibold text-slate-600">{label}</label>{children}{hint && <div className="mt-1.5 text-[10px] leading-4 text-slate-400">{hint}</div>}</div>;
}

export function AdminConsole() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [features, setFeatures] = useState<FeatureConfig[]>([]);
  const [activeId, setActiveId] = useState<FeatureId>("projectOverview");
  const [loading, setLoading] = useState(false);
  const [modelListVersion, setModelListVersion] = useState(0);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const active = useMemo(() => features.find((feature) => feature.id === activeId) ?? features[0], [activeId, features]);
  const configuredCount = features.filter((feature) => feature.hasApiKey).length;

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/config");
      if (response.status === 401) { setAuthenticated(false); return; }
      const payload = await response.json() as { features?: Record<string, Omit<FeatureConfig, "apiKey" | "clearApiKey">> };
      const next = Object.values(payload.features || {}).map((feature) => ({ ...feature, apiKey: "", clearApiKey: false })) as FeatureConfig[];
      setFeatures(next); setAuthenticated(true);
    } catch { setMessage({ type: "error", text: "配置读取失败，请检查服务状态。" }); } finally { setLoading(false); }
  };

  useEffect(() => { void fetch("/api/admin/session").then((response) => response.json()).then((payload: { authenticated?: boolean }) => { if (payload.authenticated) void loadConfig(); else setAuthenticated(false); }).catch(() => setAuthenticated(false)); }, []);

  const updateActive = (patch: Partial<FeatureConfig>) => {
    if ("provider" in patch || "baseUrl" in patch || "apiKey" in patch || "clearApiKey" in patch) setModelListVersion((current) => current + 1);
    setFeatures((current) => current.map((feature) => feature.id === activeId ? { ...feature, ...patch } : feature));
  };
  const chooseProvider = (provider: Provider) => {
    const preset = providerPresets[provider];
    updateActive({ provider, baseUrl: preset.baseUrl, model: preset.model });
  };

  const save = async () => {
    setLoading(true); setMessage(null);
    const payload = Object.fromEntries(features.map((feature) => [feature.id, { provider: feature.provider, enabled: feature.enabled, baseUrl: feature.baseUrl, model: feature.model, systemPrompt: feature.systemPrompt, temperature: feature.temperature, maxTokens: feature.maxTokens, ...(feature.apiKey.trim() ? { apiKey: feature.apiKey.trim() } : {}), clearApiKey: feature.clearApiKey }]));
    try {
      const response = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ features: payload }) });
      const result = await response.json() as { ok?: boolean; error?: string; features?: Record<string, Omit<FeatureConfig, "apiKey" | "clearApiKey">> };
      if (!response.ok || !result.ok) throw new Error(result.error || "配置保存失败");
      setFeatures(Object.values(result.features || {}).map((feature) => ({ ...feature, apiKey: "", clearApiKey: false })) as FeatureConfig[]);
      setMessage({ type: "success", text: "配置已保存，后续请求会按功能区读取对应模型。" });
    } catch (requestError) { setMessage({ type: "error", text: requestError instanceof Error ? requestError.message : "配置保存失败" }); } finally { setLoading(false); }
  };

  const testConnection = async () => {
    if (!active) return;
    setLoading(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ featureId: active.id, config: { provider: active.provider, enabled: active.enabled, apiKey: active.apiKey, baseUrl: active.baseUrl, model: active.model, systemPrompt: active.systemPrompt, temperature: active.temperature, maxTokens: active.maxTokens } }) });
      const result = await response.json() as { ok?: boolean; error?: string; latencyMs?: number; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "连接测试失败");
      setMessage({ type: "success", text: `${result.message || "连接测试成功"} · ${result.latencyMs ?? 0} ms` });
    } catch (requestError) { setMessage({ type: "error", text: requestError instanceof Error ? requestError.message : "连接测试失败" }); } finally { setLoading(false); }
  };

  const logout = async () => { await fetch("/api/admin/logout", { method: "POST" }); setAuthenticated(false); };

  if (authenticated === null || loading && !features.length) return <div className="flex min-h-screen items-center justify-center bg-[#f5f7fb] text-[12px] text-slate-500">正在加载管理后台…</div>;
  if (!authenticated) return <LoginPanel onLogin={() => void loadConfig()} />;

  if (catalogOpen) return <CatalogAdmin onBack={() => setCatalogOpen(false)} />;
  return <div className="min-h-screen bg-[#f5f7fb] text-slate-900"><header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8"><div className="flex items-center gap-3"><Link href="/" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:border-indigo-200 hover:text-indigo-600" aria-label="返回项目"><ArrowLeft size={17} /></Link><div><div className="flex items-center gap-2 text-[11px] text-slate-400"><span>知策台</span><span>/</span><span>系统设置</span></div><h1 className="mt-1 text-[17px] font-bold tracking-tight">AI 模型与提示词配置中心</h1></div></div><div className="flex items-center gap-3"><span className="hidden text-[11px] text-slate-400 sm:block">已登录：admin</span><button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:border-rose-200 hover:text-rose-600"><LogOut size={14} />退出</button></div></div></header><main className="mx-auto max-w-[1440px] space-y-5 p-5 sm:p-8"><button type="button" onClick={() => setCatalogOpen(true)} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">学校竞赛目录 / 获奖 PPT 版式 / 来源核验 →</button><section className="relative overflow-hidden rounded-[24px] bg-[#18213a] px-6 py-7 text-white shadow-xl shadow-indigo-950/10 sm:px-8"><div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" /><div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-center"><div><div className="mb-3 flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-400/15 px-3 py-1.5 text-[11px] font-semibold text-indigo-200"><Sparkles size={13} />后台配置</span><span className="text-[11px] text-slate-400">国内模型 · 独立 API · 提示词工程</span></div><h2 className="text-[27px] font-semibold tracking-tight sm:text-[31px]">让每个功能区，都有自己的模型大脑。</h2><p className="mt-3 max-w-2xl text-[13px] leading-6 text-slate-400">为不同模块选择 DeepSeek、豆包、阿里百炼、Kimi 或自定义兼容服务，单独保存 API、模型和系统提示词。业务页面不需要改代码。</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="text-[10px] text-slate-400">功能区</div><div className="mt-2 text-[24px] font-semibold">{features.length}</div></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="text-[10px] text-slate-400">已配置 API</div><div className="mt-2 text-[24px] font-semibold">{configuredCount}</div></div></div></div></section><div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]"><aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">按功能区配置</div><div className="space-y-1">{features.map((feature) => <button type="button" key={feature.id} onClick={() => { setActiveId(feature.id); setMessage(null); }} className={`w-full rounded-xl p-3 text-left transition ${feature.id === activeId ? "bg-indigo-50 text-indigo-800" : "text-slate-600 hover:bg-slate-50"}`}><div className="flex items-center gap-2.5"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${feature.id === activeId ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}><Sparkles size={14} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold">{feature.label}</span><span className="mt-1 block truncate text-[10px] text-slate-400">{feature.description}</span></span><span className={`h-2 w-2 rounded-full ${feature.hasApiKey ? "bg-emerald-500" : "bg-slate-300"}`} /></div></button>)}</div><div className="mt-4 rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-500"><KeyRound size={13} className="mr-1 inline text-indigo-500" />绿色圆点表示该功能区已配置 API Key。未配置时自动使用离线演示结果。</div></aside><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">{active && <><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-[15px] font-bold text-slate-900"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Sparkles size={16} /></span>{active.label}</div><p className="mt-2 text-[11px] text-slate-400">{active.description}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${active.hasApiKey ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{active.hasApiKey ? "API 已配置" : "离线演示"}</span><button type="button" onClick={() => updateActive({ enabled: !active.enabled })} className={`relative h-6 w-11 rounded-full transition ${active.enabled ? "bg-indigo-600" : "bg-slate-300"}`} aria-label="启用或停用功能区"><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${active.enabled ? "left-6" : "left-1"}`} /></button></div></div><div className="mt-5 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2"><ConfigField label="模型供应商"><select value={active.provider} onChange={(event) => chooseProvider(event.target.value as Provider)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-indigo-300">{(Object.keys(providerPresets) as Provider[]).map((provider) => <option key={provider} value={provider}>{providerPresets[provider].label}</option>)}</select></ConfigField><ConfigField label="连接状态" hint={providerPresets[active.provider].hint}><div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[11px] text-slate-600"><span className={`h-2 w-2 rounded-full ${active.hasApiKey ? "bg-emerald-500" : "bg-slate-300"}`} />{active.hasApiKey ? `密钥已保存：${active.maskedApiKey}` : "尚未保存 API Key"}</div></ConfigField><ConfigField label="API Key" hint="输入新密钥会覆盖旧密钥；留空表示保持不变。"><div className="relative"><KeyRound size={14} className="pointer-events-none absolute left-3 top-3 text-slate-400" /><input value={active.apiKey} onChange={(event) => updateActive({ apiKey: event.target.value, clearApiKey: false })} type="password" placeholder={active.hasApiKey ? "已配置，留空保持不变" : "粘贴该功能区的 API Key"} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-700 outline-none focus:border-indigo-300" /></div></ConfigField><ConfigField label="Base URL" hint="请填写 OpenAI 兼容接口地址，不要填写 API Key。"><input value={active.baseUrl} onChange={(event) => updateActive({ baseUrl: event.target.value })} placeholder={providerPresets[active.provider].baseUrl || "https://.../v1"} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-indigo-300" /></ConfigField><ConfigField label="API 模型 ID" hint={active.provider === "doubao" ? "填写方舟模型 ID 或 Endpoint ID（如 ep-xxxxxxxx）。" : "填写接口模型 ID，不是产品展示名。例如 Kimi K3.1 Pro 应填 kimi-k3.1-pro。"}><AdminModelPicker key={`${active.id}:${modelListVersion}`} featureId={active.id} apiKey={active.apiKey} baseUrl={active.baseUrl} model={active.model} clearApiKey={active.clearApiKey} onModelChange={(model) => updateActive({ model })} /></ConfigField><div className="grid grid-cols-2 gap-3"><ConfigField label="Temperature" hint="若模型只允许固定值，服务端会按要求自动重试；也可手动设为 1。"><input type="number" min="0" max="2" step="0.1" value={active.temperature} onChange={(event) => updateActive({ temperature: Number(event.target.value) })} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-indigo-300" /></ConfigField><ConfigField label="最大输出 Token"><input type="number" min="256" max="16000" step="128" value={active.maxTokens} onChange={(event) => updateActive({ maxTokens: Number(event.target.value) })} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-indigo-300" /></ConfigField></div></div><div className="mt-5"><ConfigField label="系统提示词 / Prompt Engineering" hint="这里写角色、上下文、输出格式、禁止事项和验收标准。业务请求会自动附加在后面。"><textarea value={active.systemPrompt} onChange={(event) => updateActive({ systemPrompt: event.target.value })} rows={8} className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-[12px] leading-6 text-slate-700 outline-none focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-50" /></ConfigField></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3"><div className="flex items-start gap-2 text-[10px] leading-4 text-amber-800"><Eye size={14} className="mt-0.5 shrink-0" /><span>前端不会读取完整密钥。保存后只能看到脱敏结果；如需清空当前密钥，请先勾选右侧操作。</span></div><button type="button" onClick={() => updateActive({ clearApiKey: !active.clearApiKey, apiKey: "" })} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${active.clearApiKey ? "bg-rose-600 text-white" : "bg-white text-rose-600"}`}>{active.clearApiKey ? "已选择清空" : "清空密钥"}</button></div><div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" disabled={loading} onClick={() => void testConnection()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[11px] font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-50"><TestTube2 size={14} />测试当前连接</button><button type="button" disabled={loading} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Save size={14} />{loading ? "保存中…" : "保存全部配置"}</button></div>{message && <div className={`mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[11px] ${message.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.type === "success" ? <Check size={14} /> : <X size={14} />}{message.text}</div>}</>}</section></div><section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-[11px] leading-5 text-indigo-900/75"><strong className="text-indigo-900">配置建议：</strong>项目总览、成果检查适合使用稳定的通用模型；比赛要求分析和 PPT 大纲适合使用长上下文模型；豆包填写方舟模型 ID 或 Endpoint ID，阿里百炼使用兼容模式地址，Kimi 填写 kimi-k3.1-pro 等 API 模型 ID。所有 AI 输出仍需人工复核，页面会保留离线兜底。</section></main></div>;
}
