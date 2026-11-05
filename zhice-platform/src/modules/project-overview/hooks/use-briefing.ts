"use client";
import { useEffect, useState } from "react";
import { useWorkspaceStore } from "@/modules/workspace";
import type { OrchestrationTask } from "@/modules/task-orchestration";
import type { OverviewSnapshot } from "../dashboard-types";
import { streamBriefing } from "../services/overview-api";

type BriefingState = { text: string; mode: "ai" | "local"; status: "idle" | "streaming" | "done" | "error"; error: string | null; key: string };
const initial: BriefingState = { text: "", mode: "local", status: "idle", error: null, key: "" };
export function useBriefing(snapshot: OverviewSnapshot | null, projectName: string, tasks: OrchestrationTask[], empty: boolean) {
  const [state, setState] = useState<BriefingState>(initial);
  const [revision, setRevision] = useState(0);
  const body = JSON.stringify({ reportId: snapshot?.reportId ?? null, empty, projectName: projectName.slice(0, 120), tasks: tasks.slice(0, 30).map(({ title, status }) => ({ title: title.slice(0, 300), status })) });
  const key = snapshot ? body + JSON.stringify({ coverage: snapshot.coverage.map(({ id, state }) => [id, state]), evidence: snapshot.evidenceCount, confirmed: snapshot.confirmedCount }) : "";
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    let activity: string | null = null;
    let finished = false;
    queueMicrotask(async () => {
      if (controller.signal.aborted) return;
      try {
        if (!revision) {
          const cached = JSON.parse(sessionStorage.getItem("zhice:briefing:v1") || "null");
          if (cached?.key === key && typeof cached.text === "string" && ["ai", "local"].includes(cached.mode) && Date.now() - cached.at < 300_000) {
            setState({ text: cached.text, mode: cached.mode, status: "done", error: null, key }); return;
          }
        }
      } catch { /* A disabled browser cache does not block generation. */ }
      setState({ ...initial, key, status: "streaming" });
      const store = useWorkspaceStore.getState();
      activity = store.beginActivity({ kind: "briefing", title: "生成项目简报", detail: projectName, href: "/?view=overview" });
      let text = "";
      let mode: "ai" | "local" = "local";
      let fallback = false;
      try {
        await streamBriefing(JSON.parse(body), controller.signal, (event) => {
          if (controller.signal.aborted) return;
          if (event.type === "meta") mode = event.mode;
          if (event.type === "delta") text += event.text;
          if (event.type === "replace") { text = event.text; mode = event.mode; fallback = true; }
          if (event.type === "complete") finished = true;
          setState({ text, mode, key, status: finished ? "done" : "streaming", error: null });
        });
        store.finishActivity(activity, { status: fallback ? "warning" : "success", title: fallback ? "简报已降级为本地摘要" : "项目简报已生成", detail: mode === "local" ? "基于当前项目数据的本地摘要" : "AI 建议，仅供参考" });
        try { sessionStorage.setItem("zhice:briefing:v1", JSON.stringify({ key, text, mode, at: Date.now() })); } catch { /* Keep the current text available. */ }
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "简报生成失败，请重试。";
        setState({ text, mode, key, status: "error", error: message });
        store.finishActivity(activity, { status: "error", detail: message });
        finished = true;
      }
    });
    return () => {
      controller.abort();
      if (activity && !finished) useWorkspaceStore.getState().finishActivity(activity, { status: "warning", title: "简报生成已暂停", detail: "离开工作台，已停止本次请求" });
    };
  }, [key, body, projectName, revision]);
  return { ...(state.key === key ? state : initial), refresh: () => setRevision((value) => value + 1) };
}
