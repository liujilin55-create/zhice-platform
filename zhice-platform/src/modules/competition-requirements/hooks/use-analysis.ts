"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { analysisReducer, initialAnalysisState } from "../analysis-state";
import { requestAnalysis } from "../services/analysis";
import { useWorkspaceStore, projectBinding, projectScopeKey } from "@/modules/workspace";
import { sameBinding } from "@/shared/contracts/competition-binding";
import { ANALYSIS_STEPS } from "../stream-types";
import { useAnalysisResultsStore } from "../analysis-results.store";

type ActivityRun = { id: string; children: Map<string, string> };
function stopActivities(run: ActivityRun | null, detail: string) {
  if (!run) return;
  const store = useWorkspaceStore.getState();
  store.finishActivity(run.id, { status: "warning", title: "比赛要求分析已停止", detail });
  for (const id of run.children.values()) store.finishActivity(id, { status: "warning", detail });
}

export function useAnalysis() {
  const projectId = useWorkspaceStore((state) => state.currentProjectId);
  const project = useWorkspaceStore((state) => state.project);
  const binding = projectBinding(project); const scopeKey = projectScopeKey(project);
  const [state, dispatch] = useReducer(analysisReducer, undefined, () => {
    const initial = initialAnalysisState();
    const stored = scopeKey ? useAnalysisResultsStore.getState().byProject[scopeKey] : null;
    const result = stored && sameBinding(stored.binding, binding) ? stored : null;
    return result ? analysisReducer(initial, { type: "event", event: { type: "complete", result }, now: Date.now() }) : initial;
  });
  const [clock, setClock] = useState(0);
  const request = useRef<{ id: number; controller?: AbortController }>({ id: 0 });
  const activity = useRef<ActivityRun | null>(null);
  useEffect(() => () => { request.current.id++; request.current.controller?.abort(); stopActivities(activity.current, "离开分析页面，本次请求已停止。"); }, []);
  useEffect(() => {
    if (state.status !== "running") return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [state.status]);

  const reset = () => {
    stopActivities(activity.current, "重新选择了比赛要求文件。"); activity.current = null;
    request.current.id++; request.current.controller?.abort(); request.current.controller = undefined;
    dispatch({ type: "reset" });
  };
  const cancel = () => {
    stopActivities(activity.current, "用户取消分析，已接收内容仍可阅读。"); activity.current = null;
    request.current.id++; request.current.controller?.abort(); request.current.controller = undefined;
    dispatch({ type: "stop", now: Date.now() });
  };
  const start = async (file: File | null, major: string, notes: string, sourceId: string | null = null, sourceMode: "supplement" | "override" = "supplement") => {
    if (!binding) return;
    stopActivities(activity.current, "开始新的分析请求。");
    request.current.controller?.abort();
    const id = ++request.current.id;
    const controller = new AbortController();
    request.current.controller = controller;
    let completed = false;
    const store = useWorkspaceStore.getState();
    const run = { id: store.beginActivity({ kind: "analysis", title: "正在分析比赛要求", detail: file?.name || "当前比赛官方资料", href: "/?view=requirements" }), children: new Map<string, string>() };
    activity.current = run;
    dispatch({ type: "start", now: Date.now() });
    try {
      await requestAnalysis(file, major, notes, controller.signal, (event) => {
        if (request.current.id !== id || projectScopeKey(useWorkspaceStore.getState().project) !== scopeKey) return;
        if (event.type === "step") {
          if (event.status === "running" && !run.children.has(event.step)) run.children.set(event.step, store.beginActivity({ kind: event.step === "papers" ? "search" : "analysis", title: ANALYSIS_STEPS.find((step) => step.id === event.step)?.label || event.step, detail: event.message, href: "/?view=requirements" }));
          if (event.status !== "running" && run.children.has(event.step)) {
            store.finishActivity(run.children.get(event.step)!, { status: event.status === "warning" ? "warning" : "success", detail: event.message });
            run.children.delete(event.step);
          }
        }
        if (event.type === "complete") {
          completed = true;
          const trace = event.result.traceability;
          if (!sameBinding(event.result.binding, binding)) return;
          if (scopeKey) useAnalysisResultsStore.getState().save(scopeKey, event.result);
          if (trace) store.linkReport(trace.reportId, event.result.requirements.title, projectId || undefined, binding);
          store.finishActivity(run.id, { status: event.result.mode === "demo" || event.result.warnings.length ? "warning" : "success", title: event.result.mode === "demo" ? "分析已完成 · 使用演示建议" : "比赛要求分析完成", detail: event.result.warnings[0] || file?.name || "官方资料", href: trace ? "/reports/" + encodeURIComponent(trace.reportId) : "/?view=requirements" });
          activity.current = null;
        }
        dispatch({ type: "event", event, now: Date.now() });
      }, { binding, sourceId, sourceMode });
    } catch (error) {
      if (request.current.id !== id || completed) return;
      store.finishActivity(run.id, { status: "error", title: "比赛要求分析中断", detail: error instanceof Error ? error.message : "请重试" });
      for (const child of run.children.values()) store.finishActivity(child, { status: "error", detail: "分析连接已中断。" });
      activity.current = null;
      dispatch({ type: "stop", now: Date.now(), error: controller.signal.aborted ? undefined : error instanceof Error ? error.message : "分析中断，请重试。" });
    } finally {
      if (request.current.id === id) request.current.controller = undefined;
    }
  };
  const elapsed = state.startedAt ? Math.max(0, Math.floor(((state.endedAt || Math.max(clock, state.startedAt)) - state.startedAt) / 1000)) : 0;
  const quietSeconds = state.status === "running" ? Math.max(0, Math.floor((clock - state.updatedAt) / 1000)) : 0;
  return { ...state, elapsed, quietSeconds, start, cancel, reset, busy: state.status === "running" };
}
