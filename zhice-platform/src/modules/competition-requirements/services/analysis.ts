import { ApiError, apiEventRequest } from "@/shared/api-client";
import { analysisResponseSchema } from "../types";
import { analysisEventSchema, type AnalysisEvent } from "../stream-types";
import type { CompetitionBinding } from "@/shared/contracts/competition-binding";

export async function requestAnalysis(file: File | null, major: string, notes: string, signal: AbortSignal, onEvent: (event: AnalysisEvent) => void, context?: { binding: CompetitionBinding; sourceId: string | null; sourceMode: "supplement" | "override" }) {
  const body = new FormData();
  if (file) body.append("file", file); body.append("major", major); body.append("notes", notes);
  if (context) { body.append("binding", JSON.stringify(context.binding)); body.append("sourceId", context.sourceId || ""); body.append("sourceMode", context.sourceMode); }
  let completed = false;
  await apiEventRequest("/api/competition-requirements", analysisEventSchema, (event) => {
    if (event.type === "error") throw new ApiError(event.message, 200);
    if (event.type === "complete") completed = true;
    onEvent(event);
  }, { method: "POST", body, signal, headers: { Accept: "application/x-ndjson" } }, (payload) => ({ type: "complete" as const, result: analysisResponseSchema.parse(payload) }));
  if (!completed) throw new ApiError("连接已结束，但报告尚未完成。已接收内容仍可阅读，请重试。", 200);
}
