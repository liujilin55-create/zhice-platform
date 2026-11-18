"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import { bindingKey, sameBinding } from "@/shared/contracts/competition-binding";
import { PLAN_CHAPTERS, planChapterSchema } from "./types";
import { useProjectPlanStore } from "./plan.store";

const referenceSchema = z.object({
  chapter: planChapterSchema,
  contextKey: z.string().min(1),
  instructions: z.string().max(2000),
  createdAt: z.string().datetime(),
}).refine((reference) => reference.chapter.mode === "ai" && Boolean(reference.chapter.binding)
  && reference.chapter.status === "draft" && reference.chapter.generationStatus === "draft"
  && Boolean(reference.chapter.content.trim()), { message: "参考模板必须是成功生成的 AI 草稿。" });

export type ChapterReference = z.infer<typeof referenceSchema>;
const validChapter = (id: string) => PLAN_CHAPTERS.some((chapter) => chapter.id === id);
const ownsReference = (scopeKey: string, chapterId: string, reference: ChapterReference) =>
  reference.chapter.id === chapterId && validChapter(chapterId)
  && bindingKey(reference.chapter.binding!) === scopeKey;

type ReferenceState = {
  hydrated: boolean;
  setHydrated: () => void;
  byScope: Record<string, Record<string, ChapterReference>>;
  instructionsByScope: Record<string, Record<string, string>>;
  saveReference: (scopeKey: string, reference: Omit<ChapterReference, "createdAt">) => boolean;
  setInstructions: (scopeKey: string, chapterId: string, value: string) => void;
};

export const useChapterReferenceStore = create<ReferenceState>()(persist((set) => ({
  hydrated: false,
  setHydrated: () => set({ hydrated: true }),
  byScope: {}, instructionsByScope: {},
  saveReference: (scopeKey, reference) => {
    const parsed = referenceSchema.safeParse({ ...reference, createdAt: new Date().toISOString() });
    if (!parsed.success || !ownsReference(scopeKey, parsed.data.chapter.id, parsed.data)) return false;
    set((state) => ({ byScope: { ...state.byScope, [scopeKey]: {
      ...state.byScope[scopeKey], [parsed.data.chapter.id]: parsed.data,
    } } }));
    return true;
  },
  setInstructions: (scopeKey, chapterId, value) => {
    if (!scopeKey || !validChapter(chapterId)) return;
    set((state) => ({ instructionsByScope: { ...state.instructionsByScope, [scopeKey]: {
      ...state.instructionsByScope[scopeKey], [chapterId]: value.slice(0, 2000),
    } } }));
  },
}), {
  name: "zhice:chapter-references:v1", skipHydration: true,
  partialize: ({ byScope, instructionsByScope }) => ({ byScope, instructionsByScope }),
  merge: (saved, current) => {
    const schema = z.object({
      byScope: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
      instructionsByScope: z.record(z.string(), z.record(z.string(), z.string().max(2000))).default({}),
    });
    const parsed = schema.safeParse(saved || {});
    if (!parsed.success) return current;
    const byScope = Object.fromEntries(Object.entries(parsed.data.byScope).map(([scopeKey, entries]) => [scopeKey,
      Object.fromEntries(Object.entries(entries).flatMap(([chapterId, value]) => {
        const reference = referenceSchema.safeParse(value);
        return reference.success && ownsReference(scopeKey, chapterId, reference.data) ? [[chapterId, reference.data]] : [];
      })),
    ]));
    return { ...current, byScope, instructionsByScope: parsed.data.instructionsByScope };
  },
}));

/** Preview storage never writes a document. Adoption is explicit and preserves the previous version. */
export function applyChapterReference(scopeKey: string, chapterId: string, contextKey: string): boolean {
  const reference = useChapterReferenceStore.getState().byScope[scopeKey]?.[chapterId];
  const plan = useProjectPlanStore.getState();
  if (!reference || reference.contextKey !== contextKey || plan.scopeKey !== scopeKey
    || !plan.document || !sameBinding(reference.chapter.binding, plan.document.binding)
    || !ownsReference(scopeKey, chapterId, reference)) return false;
  plan.saveVersion();
  plan.upsertChapter({ ...reference.chapter, status: "draft", generationStatus: "draft", updatedAt: new Date().toISOString() }, "ai");
  return true;
}
