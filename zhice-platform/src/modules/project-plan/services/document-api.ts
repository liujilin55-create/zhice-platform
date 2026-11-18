import { z } from "zod";
import { apiRequest } from "@/shared/api-client";
import { planDocumentSchema, documentReferenceSchema, reconcilePlanDocument, type PlanDocument } from "@/shared/contracts/plan-document";
import { useProjectPlanStore } from "@/modules/project-plan/plan.store";

export async function savePlanDocument(document: PlanDocument, signal?: AbortSignal) {
  const reconciled = reconcilePlanDocument(document);
  // Commit repaired metadata before the request so retries and concurrent edits use the same version.
  if (reconciled.repaired) useProjectPlanStore.getState().syncDocumentSnapshot(document, reconciled.document);
  return apiRequest("/api/project-plan/document", z.object({ data: planDocumentSchema, reference: documentReferenceSchema }), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reconciled.document), signal,
  });
}
