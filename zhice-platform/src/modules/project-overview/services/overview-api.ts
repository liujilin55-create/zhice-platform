import { ApiError, apiRequest, apiSseRequest } from "@/shared/api-client";
import { briefingEventSchema, overviewSnapshotSchema, type BriefingEvent } from "../dashboard-types";
import { z } from "zod";
import { paperSchema } from "@/modules/competition-requirements";

export const getOverview = (reportId: string | null, empty: boolean, signal: AbortSignal) => apiRequest("/api/project-overview" + (empty ? "?scope=empty" : reportId ? "?reportId=" + encodeURIComponent(reportId) : ""), overviewSnapshotSchema, { signal });
export async function streamBriefing(body: unknown, signal: AbortSignal, onEvent: (event: BriefingEvent) => void) {
  let completed = false;
  await apiSseRequest("/api/project-overview/briefing", briefingEventSchema, (event) => {
    if (event.type === "error") throw new ApiError(event.message, 200);
    if (event.type === "complete") completed = true;
    onEvent(event);
  }, { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify(body), signal });
  if (!completed) throw new ApiError("简报尚未完成，请重试。", 200);
}
export const papersResponseSchema = z.object({ data: z.array(paperSchema), cached: z.boolean() });
export const searchPapers = (query: string, signal: AbortSignal) => apiRequest("/api/papers", papersResponseSchema, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }), signal });
