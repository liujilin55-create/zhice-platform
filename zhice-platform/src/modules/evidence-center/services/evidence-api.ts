import { z } from "zod";
import { apiRequest } from "@/shared/api-client";
import { evidenceRecordSchema, evidenceSearchResponseSchema, reportResponseSchema, type EvidenceStatus } from "../types";

export const getEvidence = (signal?: AbortSignal, reportIds?: string[]) => apiRequest("/api/evidence" + (reportIds ? "?scope=project&reports=" + encodeURIComponent(reportIds.join(",")) : ""), evidenceSearchResponseSchema, { signal });
export const getReport = (id: string, signal?: AbortSignal) => apiRequest("/api/evidence/reports/" + encodeURIComponent(id), reportResponseSchema, { signal });
export const updateEvidenceStatus = (id: string, status: EvidenceStatus) => apiRequest("/api/evidence", z.object({ data: evidenceRecordSchema }), {
  method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
});
