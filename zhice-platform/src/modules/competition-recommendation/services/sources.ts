import { apiRequest } from "@/shared/api-client";
import { competitionSourceResponseSchema } from "../source-types";
import { z } from "zod";
import { verificationStatusSchema } from "@/shared/contracts/competition-binding";
export const getSourceStatuses = (signal: AbortSignal) => apiRequest("/api/competitions/source-statuses", z.record(z.string(), z.object({ verificationStatus: verificationStatusSchema, lastVerified: z.string().nullable() })), { signal });
function sourceUrl(competitionId: string, trackId: string) { return "/api/competitions/" + encodeURIComponent(competitionId) + "/source?trackId=" + encodeURIComponent(trackId); }
export const getCompetitionSource = (id: string, trackId: string, signal: AbortSignal) => apiRequest(sourceUrl(id, trackId), competitionSourceResponseSchema, { signal });
export const verifyCompetitionSource = (id: string, trackId: string, input: unknown, signal: AbortSignal) => apiRequest(sourceUrl(id, trackId), competitionSourceResponseSchema, { method: "POST", body: JSON.stringify(input), headers: { "Content-Type": "application/json" }, signal });
