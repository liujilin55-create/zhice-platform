import { z } from "zod";
import { apiRequest } from "@/shared/api-client";
import { pptAnalyzeResponseSchema, pptHistoryEntrySchema, pptOutlineSchema, pptCheckSchema, pptRenderResponseSchema, planPptResponseSchema, type PlanPptOptions, type PptOutline, type PptTemplate } from "../types";
import type { DocumentReference } from "@/shared/contracts/plan-document";
import type { CompetitionBinding } from "@/shared/contracts/competition-binding";

const json = (value: unknown, signal?: AbortSignal): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value), signal });
export const analyzeDocx = (body: FormData, signal: AbortSignal) => apiRequest("/api/ppt", pptAnalyzeResponseSchema, { method: "POST", body, signal });
export const analyzePlan = (projectId: string, reference: DocumentReference, options: PlanPptOptions, signal: AbortSignal, template: PptTemplate = "zhice-dark") => apiRequest("/api/ppt", planPptResponseSchema, json({ action: "analyzePlan", projectId, reference, options, template }, signal));
export const inspectOutline = (projectId: string, outline: PptOutline, signal?: AbortSignal) => apiRequest("/api/ppt", z.object({ ok: z.literal(true), outline: pptOutlineSchema, checks: z.array(pptCheckSchema) }), json({ action: "check", projectId, outline }, signal));
export const renderOutline = (projectId: string, outline: PptOutline, template: PptTemplate, sourceName: string, humanConfirmed: boolean, signal: AbortSignal, binding?: CompetitionBinding) => apiRequest("/api/ppt", pptRenderResponseSchema, json({ action: "render", projectId, outline, template, sourceName, humanConfirmed, binding }, signal));
export const getPptHistory = (projectId: string, scope: string | null, signal: AbortSignal) => apiRequest("/api/ppt?projectId=" + encodeURIComponent(projectId) + (scope ? "&scope=" + encodeURIComponent(scope) : ""), z.object({ history: z.array(pptHistoryEntrySchema) }), { signal });
