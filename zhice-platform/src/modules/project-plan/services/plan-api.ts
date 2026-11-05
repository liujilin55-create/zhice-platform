import { apiRequest, apiSseRequest } from "@/shared/api-client";
import { z } from "zod";
import { planContextSchema, planEventSchema, planExportResponseSchema, type PlanEvent, type PlanContext, type PlanWorkspace } from "../types";

export function getPlanContext(workspace: PlanWorkspace, signal: AbortSignal) {
  return apiRequest<{ data: PlanContext }>("/api/project-plan/context", planContextSchemaResponse, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workspace), signal });
}
const planContextSchemaResponse = z.object({ data: planContextSchema });
export async function sendPlanEvent(input: unknown, signal: AbortSignal, onEvent: (event: PlanEvent) => void) {
  let completed = false;
  let serverError: string | null = null;
  await apiSseRequest("/api/project-plan", planEventSchema, (event) => {
    if (event.type === "complete") completed = true;
    if (event.type === "error") serverError = event.message;
    onEvent(event);
  }, { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify(input), signal });
  if (serverError) throw new Error(serverError);
  if (!completed) throw new Error("生成连接提前结束，已接收内容仍可阅读，请重试。");
}
export const exportPlan = (input: unknown, signal: AbortSignal) => apiRequest("/api/project-plan", planExportResponseSchema, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
