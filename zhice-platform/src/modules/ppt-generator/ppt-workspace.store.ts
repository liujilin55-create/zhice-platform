"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import { parsedDocxSchema, pptHistoryEntrySchema, pptOutlineSchema, pptPageRangeSchema, pptTemplateSchema, planPptOptionsSchema } from "./types";
import { materialReviewRecordSchema, type MaterialReviewRecord } from "./material-review-record";
const draftSchema = z.object({ document: parsedDocxSchema.nullable(), outline: pptOutlineSchema.nullable(), template: pptTemplateSchema, pageRange: pptPageRangeSchema, style: z.enum(["story", "technical", "evidence"]), latest: pptHistoryEntrySchema.nullable(), planOptions: planPptOptionsSchema.optional(), requestKey: z.string().optional() });
type PptDraft = z.infer<typeof draftSchema>;
type PptState = {
  byProject: Record<string, PptDraft>;
  materialReviews: Record<string, MaterialReviewRecord>;
  save: (id: string, draft: PptDraft) => void;
  markMaterialsReviewed: (scopeKey: string, fingerprint: string) => void;
};
export const usePptWorkspaceStore = create<PptState>()(persist((set) => ({
  byProject: {}, save: (id, draft) => set((state) => ({ byProject: { ...state.byProject, [id]: draft } })),
  materialReviews: {},
  markMaterialsReviewed: (scopeKey, fingerprint) => {
    const record = materialReviewRecordSchema.safeParse({ scopeKey, fingerprint, reviewedAt: new Date().toISOString() });
    if (record.success) set((state) => ({ materialReviews: { ...state.materialReviews, [scopeKey]: record.data } }));
  },
}), { name: "zhice:ppt-workspace:v1", skipHydration: true, partialize: ({ byProject, materialReviews }) => ({ byProject, materialReviews }), merge: (stored, current) => {
  const raw = stored as { byProject?: Record<string, unknown>; materialReviews?: Record<string, unknown> } | undefined;
  const byProject = Object.fromEntries(Object.entries(raw?.byProject || {}).flatMap(([id, draft]) => { const parsed = draftSchema.safeParse(draft); return parsed.success ? [[id, parsed.data]] : []; }));
  const materialReviews = Object.fromEntries(Object.entries(raw?.materialReviews || {}).flatMap(([scopeKey, record]) => { const parsed = materialReviewRecordSchema.safeParse(record); return parsed.success && parsed.data.scopeKey === scopeKey ? [[scopeKey, parsed.data]] : []; }));
  return { ...current, byProject, materialReviews };
} }));
