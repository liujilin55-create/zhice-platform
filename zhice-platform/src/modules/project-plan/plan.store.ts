"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import { getLegacyProjectId, registerProjectScope } from "@/shared/store/project-scope";
import { emptySurveySession, planChapterSchema, planReportSchema, surveySessionSchema, type PlanChapter, type PlanMessage, type PlanReport, type PlanSlotId, type PlanSlotMap, type SurveySession } from "./types";
import { planDocumentSchema, parseContentBlocks, type PlanDocument } from "@/shared/contracts/plan-document";
import { sameBinding, type CompetitionBinding, type RequirementSource, type ScoringClause } from "@/shared/contracts/competition-binding";

const snapshotSchema = z.object({
  phase: z.enum(["survey", "report", "editor"]), session: surveySessionSchema, report: planReportSchema.nullable(),
  chapters: z.record(z.string(), planChapterSchema), activeChapterId: z.string().nullable(),
  document: planDocumentSchema.nullable().default(null), versions: z.array(planDocumentSchema).max(20).default([]),
});
type PlanSnapshot = z.infer<typeof snapshotSchema>;
function emptySnapshot(): PlanSnapshot { return { phase: "survey", session: emptySurveySession(), report: null, chapters: {}, activeChapterId: null, document: null, versions: [] }; }
const snapshot = (state: PlanSnapshot): PlanSnapshot => ({ phase: state.phase, session: state.session, report: state.report, chapters: state.chapters, activeChapterId: state.activeChapterId, document: state.document, versions: state.versions });
const checkpoint = (versions: PlanDocument[], document: PlanDocument | null) => document && versions.at(-1)?.version !== document.version ? [...versions, structuredClone(document)].slice(-20) : versions;
const transient = { streamingReply: "", streamingReport: null, streamingChapter: "", busy: false, error: null };
type PlanState = {
  projectId: string | null; scopeKey: string | null; byProject: Record<string, PlanSnapshot>; activateProject: (id: string | null, key?: string | null) => void;
  hydrated: boolean; phase: "survey" | "report" | "editor"; session: SurveySession; report: PlanReport | null;
  chapters: Record<string, PlanChapter>; activeChapterId: string | null; streamingReply: string; streamingReport: Partial<PlanReport> | null; streamingChapter: string;
  document: PlanDocument | null; versions: PlanDocument[];
  setDocumentContext: (projectName: string, binding: CompetitionBinding, sources: RequirementSource[], criteria: ScoringClause[], preparationKey?: string | null) => void;
  acceptPreparation: (preparationKey: string, session: SurveySession) => void;
  setDocumentTitle: (title: string) => void; saveVersion: () => void; restoreVersion: (version?: number) => void;
  busy: boolean; error: string | null; setHydrated: () => void; reset: () => void;
  addMessage: (message: PlanMessage) => void; setSession: (session: SurveySession) => void; setStreamingReply: (value: string) => void; setStreamingReport: (value: Partial<PlanReport> | null) => void;
  setReport: (report: PlanReport) => void; setPhase: (phase: PlanState["phase"]) => void; setActiveChapter: (id: string | null) => void;
  upsertChapter: (chapter: PlanChapter, origin?: "user" | "ai", verifyInferences?: boolean) => void; setStreamingChapter: (value: string) => void; setBusy: (busy: boolean) => void; setError: (error: string | null) => void;
};
export const useProjectPlanStore = create<PlanState>()(persist((set, get) => ({
  projectId: null, scopeKey: null, byProject: {},
  activateProject: (projectId, scopeKey = projectId) => {
    const state = get(); if (state.projectId === projectId && state.scopeKey === scopeKey) return;
    const byProject = { ...state.byProject, ...(state.scopeKey ? { [state.scopeKey]: snapshot(state) } : {}) };
    set({ ...emptySnapshot(), ...(scopeKey ? byProject[scopeKey] : undefined), ...transient, projectId, scopeKey, byProject });
  },
  hydrated: false, phase: "survey", session: emptySurveySession(), report: null, chapters: {}, activeChapterId: null, document: null, versions: [], streamingReply: "", streamingReport: null, streamingChapter: "", busy: false, error: null,
  setHydrated: () => set({ hydrated: true }),
  reset: () => set((state) => ({ ...emptySnapshot(), versions: checkpoint(state.versions, state.document), ...transient })),
  setDocumentContext: (projectName, binding, sources, scoringRequirements, preparationKey = null) => set((state) => {
    if (state.projectId !== binding.projectId) return {};
    const previous = state.document && sameBinding(state.document.binding, binding) ? state.document : null;
    if (previous && previous.projectName === projectName && JSON.stringify(previous.sources) === JSON.stringify(sources) && JSON.stringify(previous.scoringRequirements) === JSON.stringify(scoringRequirements)) return {};
    const document: PlanDocument = previous ? { ...previous, projectName, sources, scoringRequirements, version: previous.version + 1, updatedAt: new Date().toISOString() } : { documentId: crypto.randomUUID(), binding, projectName, title: projectName + " · 项目计划书", chapters: Object.values(state.chapters).filter((chapter) => !chapter.binding || sameBinding(chapter.binding, binding)).map((chapter) => ({ id: chapter.id, title: chapter.title, aiContent: chapter.content, userContent: null, confirmed: chapter.status === "confirmed", updatedAt: chapter.updatedAt, blocks: parseContentBlocks(chapter.content, "ai", chapter.evidenceIds || [], chapter.sourceIds).map((block) => ({ ...block, confirmed: chapter.status === "confirmed" && block.marker === "generated" })) })), version: Math.max(0, ...state.versions.map((item) => item.version)) + 1, confirmed: false, updatedAt: new Date().toISOString(), sources, scoringRequirements };
    if (!previous) document.preparationKey = preparationKey;
    document.confirmed = document.chapters.length > 0 && document.chapters.every((chapter) => chapter.confirmed);
    return { document };
  }),
  acceptPreparation: (preparationKey, session) => set((state) => {
    if (!state.document || !sameBinding(session.binding, state.document.binding)) return {};
    const document = { ...state.document, preparationKey, confirmed: false, version: state.document.version + 1, updatedAt: new Date().toISOString(), chapters: state.document.chapters.map((chapter) => ({ ...chapter, confirmed: false, blocks: chapter.blocks.map((block) => ({ ...block, confirmed: false })) })) };
    return { versions: checkpoint(state.versions, state.document), document, session, report: null, phase: "survey", chapters: Object.fromEntries(Object.entries(state.chapters).map(([id, chapter]) => [id, { ...chapter, status: "draft" as const }])) };
  }),
  setDocumentTitle: (title) => set((state) => state.document && title.trim() ? { document: { ...state.document, title: title.slice(0, 160), version: state.document.version + 1, updatedAt: new Date().toISOString() } } : {}),
  saveVersion: () => set((state) => ({ versions: checkpoint(state.versions, state.document) })),
  restoreVersion: (version) => set((state) => {
    const previous = version ? state.versions.find((item) => item.version === version) : state.versions.findLast((item) => item.version !== state.document?.version);
    if (!previous || state.document && !sameBinding(previous.binding, state.document.binding)) return {};
    const document = { ...structuredClone(previous), version: Math.max(state.document?.version || 0, ...state.versions.map((item) => item.version)) + 1, updatedAt: new Date().toISOString() };
    const chapters = Object.fromEntries(document.chapters.map((chapter) => [chapter.id, { ...state.chapters[chapter.id], binding: document.binding, sourceIds: [...new Set(chapter.blocks.flatMap((block) => block.sourceIds))], id: chapter.id, title: chapter.title, content: chapter.userContent ?? chapter.aiContent, status: chapter.confirmed ? "confirmed" as const : "draft" as const, updatedAt: document.updatedAt, evidenceIds: [...new Set(chapter.blocks.flatMap((block) => block.evidenceIds))] }]));
    return { document, chapters, versions: checkpoint(state.versions, state.document) };
  }),
  addMessage: (message) => set((state) => ({ session: { ...state.session, messages: [...state.session.messages, message], updatedAt: new Date().toISOString() } })),
  setSession: (session) => set({ session, streamingReply: "" }), setStreamingReply: (streamingReply) => set({ streamingReply }), setStreamingReport: (streamingReport) => set({ streamingReport }),
  setReport: (report) => set({ report, phase: "report", streamingReply: "", streamingReport: null }), setPhase: (phase) => set({ phase }), setActiveChapter: (activeChapterId) => set({ activeChapterId, streamingChapter: "" }),
  upsertChapter: (chapter, origin = "ai", verifyInferences = false) => set((state) => {
    const document = state.document;
    if (!document) return { chapters: { ...state.chapters, [chapter.id]: chapter } };
    if (chapter.binding && !sameBinding(chapter.binding, document.binding)) return {};
    const previous = document.chapters.find((item) => item.id === chapter.id);
    const blocks = parseContentBlocks(chapter.content, origin, chapter.evidenceIds || [], chapter.sourceIds, origin === "user" ? previous?.blocks : []).map((block) => ({ ...block, confirmed: chapter.status === "confirmed" && (block.marker === "generated" || block.marker === "inference" && (verifyInferences || Boolean(previous?.blocks.find((old) => old.id === block.id)?.confirmed))) }));
    const updated = { id: chapter.id, title: chapter.title, aiContent: origin === "ai" ? chapter.content : previous?.aiContent || "", userContent: origin === "user" ? chapter.content : null, blocks, confirmed: chapter.status === "confirmed", updatedAt: chapter.updatedAt };
    const chapters = [...document.chapters.filter((item) => item.id !== chapter.id), updated];
    return { chapters: { ...state.chapters, [chapter.id]: chapter }, versions: origin === "ai" || chapter.status === "confirmed" || previous?.confirmed ? checkpoint(state.versions, document) : state.versions, document: { ...document, chapters, confirmed: chapters.every((item) => item.confirmed), version: document.version + 1, updatedAt: new Date().toISOString() } };
  }), setStreamingChapter: (streamingChapter) => set({ streamingChapter }), setBusy: (busy) => set({ busy }), setError: (error) => set({ error }),
}), {
  name: "zhice:project-plan:v1", skipHydration: true,
  partialize: (state) => ({ byProject: { ...state.byProject, ...(state.scopeKey ? { [state.scopeKey]: snapshot(state) } : {}) } }),
  merge: (persisted, current) => {
    const value = (persisted || {}) as Record<string, unknown>;
    const byProject = Object.fromEntries(Object.entries((value.byProject || {}) as Record<string, unknown>).flatMap(([id, data]) => {
      const parsed = snapshotSchema.safeParse(data); return parsed.success ? [[id, parsed.data]] : [];
    }));
    const legacyOwner = getLegacyProjectId();
    if (!value.byProject && value.session && !legacyOwner && typeof localStorage !== "undefined") {
      try { localStorage.setItem("zhice:project-plan:legacy-backup:v1", JSON.stringify(value)); } catch { /* Storage may be unavailable; never assign unowned content to a new project. */ }
    }
    if (!value.byProject && legacyOwner) {
      const chapters = Object.fromEntries(Object.entries((value.chapters || {}) as Record<string, unknown>).flatMap(([id, raw]) => {
        const candidate = raw && typeof raw === "object" && "status" in raw && raw.status === "ready" ? { ...raw, status: "draft" } : raw;
        const parsed = planChapterSchema.safeParse(candidate); return parsed.success ? [[id, parsed.data]] : [];
      }));
      const parsed = snapshotSchema.safeParse({ ...value, chapters });
      if (parsed.success) byProject[legacyOwner] = parsed.data;
    }
    return { ...current, ...emptySnapshot(), ...transient, projectId: null, scopeKey: null, byProject };
  },
}));

export function sessionWithSlot(session: SurveySession, slot: PlanSlotId, value: string, mode: "ai" | "local") {
  const trimmed = value.trim();
  const slots: PlanSlotMap = { ...session.slots, [slot]: { ...session.slots[slot], value: trimmed, status: trimmed.length < 6 ? "needsVerification" : "captured" } };
  return { ...session, slots, mode, updatedAt: new Date().toISOString() };
}

registerProjectScope((id, key) => useProjectPlanStore.getState().activateProject(id, key));

export function archivedPlanMarkdown(scopeKey: string) {
  const stored = useProjectPlanStore.getState().byProject[scopeKey];
  if (!stored || !stored.session.messages.length && !Object.keys(stored.chapters).length) return null;
  return "# 历史计划书工作稿\n\n> 此材料属于之前的比赛选择，不作为当前项目上下文。AI 建议与推断仍需核验。\n\n" + Object.values(stored.session.slots).map((slot) => "- " + slot.label + "：" + (slot.value || "待补充")).join("\n") + "\n\n" + Object.values(stored.chapters).map((chapter) => chapter.content).join("\n\n---\n\n");
}
