"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import { parsedDocxSchema, pptHistoryEntrySchema, pptOutlineSchema, pptPageRangeSchema, pptTemplateSchema, planPptOptionsSchema } from "./types";
const draftSchema = z.object({ document: parsedDocxSchema.nullable(), outline: pptOutlineSchema.nullable(), template: pptTemplateSchema, pageRange: pptPageRangeSchema, style: z.enum(["story", "technical", "evidence"]), latest: pptHistoryEntrySchema.nullable(), planOptions: planPptOptionsSchema.optional(), requestKey: z.string().optional() });
type PptDraft = z.infer<typeof draftSchema>;
type PptState = { byProject: Record<string, PptDraft>; save: (id: string, draft: PptDraft) => void };
export const usePptWorkspaceStore = create<PptState>()(persist((set) => ({
  byProject: {}, save: (id, draft) => set((state) => ({ byProject: { ...state.byProject, [id]: draft } })),
}), { name: "zhice:ppt-workspace:v1", skipHydration: true, partialize: ({ byProject }) => ({ byProject }), merge: (stored, current) => {
  const raw = stored as { byProject?: Record<string, unknown> } | undefined;
  const byProject = Object.fromEntries(Object.entries(raw?.byProject || {}).flatMap(([id, draft]) => { const parsed = draftSchema.safeParse(draft); return parsed.success ? [[id, parsed.data]] : []; }));
  return { ...current, byProject };
} }));
