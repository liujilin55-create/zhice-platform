import { ANALYSIS_STEPS, type AnalysisEvent, type AnalysisPreview, type AnalysisStep, type StepState } from "./stream-types";
import type { AnalysisResponse } from "./types";

export type AnalysisStatus = "idle" | "running" | "complete" | "cancelled" | "error";
export type AnalysisState = {
  status: AnalysisStatus; steps: Record<AnalysisStep, StepState>;
  preview: AnalysisPreview; result: AnalysisResponse | null;
  warnings: string[]; error: string | null; logs: string[];
  startedAt: number; updatedAt: number; endedAt: number;
};
export const initialAnalysisState = (): AnalysisState => ({
  status: "idle", steps: Object.fromEntries(ANALYSIS_STEPS.map((step) => [step.id, { status: "waiting", message: step.detail }])) as Record<AnalysisStep, StepState>,
  preview: { textPreview: "", characterCount: 0, keywords: [], papersCached: false },
  result: null, warnings: [], error: null, logs: [], startedAt: 0, updatedAt: 0, endedAt: 0,
});
export type AnalysisAction = { type: "reset" } | { type: "start"; now: number } | { type: "stop"; now: number; error?: string } | { type: "event"; event: AnalysisEvent; now: number };
export function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  if (action.type === "reset") return initialAnalysisState();
  if (action.type === "start") {
    const fresh = initialAnalysisState();
    return { ...fresh, status: "running", startedAt: action.now, updatedAt: action.now, steps: { ...fresh.steps, uploading: { status: "running", message: "正在上传文件并等待服务端接收" } } };
  }
  if (action.type === "stop") return {
    ...state, status: action.error ? "error" : "cancelled", error: action.error || null, endedAt: action.now,
    steps: Object.fromEntries(Object.entries(state.steps).map(([id, step]) => [id, step.status === "running" ? { status: action.error ? "error" : "waiting", message: action.error ? "本次处理已中断" : "本次处理已取消" } : step])) as Record<AnalysisStep, StepState>,
  };
  const { event, now } = action;
  if (event.type === "heartbeat") return state;
  const next = { ...state, updatedAt: now };
  switch (event.type) {
    case "step": return { ...next, steps: { ...state.steps, [event.step]: { status: event.status, message: event.message } }, logs: [...state.logs, event.message].slice(-4) };
    case "file": return { ...next, preview: { ...state.preview, file: event.file, textPreview: event.textPreview, characterCount: event.characterCount } };
    case "keywords": return { ...next, preview: { ...state.preview, keywords: event.keywords } };
    case "papers": return { ...next, preview: { ...state.preview, papers: event.papers, papersCached: event.cached } };
    case "draft": return { ...next, preview: { ...state.preview,
      requirements: event.reset ? event.requirements : event.requirements ?? state.preview.requirements,
      report: event.reset ? event.report : event.report ?? state.preview.report, mode: event.mode,
    } };
    case "warning": return { ...next, warnings: [...new Set([...state.warnings, event.message])] };
    case "complete": return { ...next, status: "complete", endedAt: now, result: event.result, warnings: event.result.warnings,
      steps: Object.fromEntries(Object.entries(state.steps).map(([id, step]) => [id, step.status === "warning" ? step : { status: "done", message: "已完成" }])) as Record<AnalysisStep, StepState>,
    };
    case "error": return analysisReducer(state, { type: "stop", now, error: event.message });
  }
}
