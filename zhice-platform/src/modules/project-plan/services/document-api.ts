import { z } from "zod";
import { apiRequest } from "@/shared/api-client";
import { planDocumentSchema, documentReferenceSchema, type PlanDocument } from "@/shared/contracts/plan-document";
export const savePlanDocument = (document: PlanDocument, signal?: AbortSignal) => apiRequest("/api/project-plan/document", z.object({ data: planDocumentSchema, reference: documentReferenceSchema }), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(document), signal });
