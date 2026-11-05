"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { analysisResponseSchema, type AnalysisResponse } from "./types";

type ResultState = { byProject: Record<string, AnalysisResponse>; save: (id: string, result: AnalysisResponse) => void };
export const useAnalysisResultsStore = create<ResultState>()(persist((set) => ({
  byProject: {}, save: (id, result) => set((state) => ({ byProject: { ...state.byProject, [id]: result } })),
}), {
  name: "zhice:analysis-results:v1", skipHydration: true, partialize: ({ byProject }) => ({ byProject }),
  merge: (stored, current) => {
    const raw = stored as { byProject?: Record<string, unknown> } | undefined;
    const byProject = Object.fromEntries(Object.entries(raw?.byProject || {}).flatMap(([id, value]) => { const parsed = analysisResponseSchema.safeParse(value); return parsed.success ? [[id, parsed.data]] : []; }));
    return { ...current, byProject };
  },
}));
