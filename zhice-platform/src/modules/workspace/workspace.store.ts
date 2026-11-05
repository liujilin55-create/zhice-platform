"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { setLegacyProjectId, setProjectScope } from "@/shared/store/project-scope";
import { activitySchema, emptyStudentProfile, studentProfileSchema, workspaceProjectSchema, projectScopeKey, projectBinding, type AssetStatus, type StudentProfile, type WorkspaceActivity, type WorkspaceProject } from "./types";
import { findCompetition } from "@/modules/competition-recommendation/data";
import { sameBinding, type CompetitionBinding } from "@/shared/contracts/competition-binding";
import { preparationSchema, type Preparation } from "@/shared/contracts/preparation";

type UploadHandoff = { id: string; file: File; target: "requirements"; projectId: string };
type WorkspaceState = {
  ready: boolean; studentProfile: StudentProfile | null; projects: WorkspaceProject[]; currentProjectId: string | null;
  project: WorkspaceProject | null; activities: WorkspaceActivity[]; pendingUpload: UploadHandoff | null;
  setReady: () => void; saveProfile: (profile: StudentProfile) => void;
  newProject: (name: string, profile?: StudentProfile) => string; switchProject: (id: string) => void;
  selectCompetition: (id: string, trackId?: string | null) => void;
  confirmCompetition: () => void;
  updatePreparation: (patch: Partial<Preparation>) => void;
  renameProject: (name: string) => void;
  linkReport: (reportId: string, name: string, projectId?: string, binding?: CompetitionBinding) => void;
  setAssetStatus: (asset: "documentStatus" | "pptStatus", status: AssetStatus, projectId?: string, binding?: CompetitionBinding) => void;
  handoffFile: (file: File) => void; consumeUpload: (id: string) => void;
  beginActivity: (input: Pick<WorkspaceActivity, "kind" | "title" | "detail" | "href">, projectId?: string) => string;
  finishActivity: (id: string, patch: Partial<Pick<WorkspaceActivity, "status" | "title" | "detail" | "href">>) => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(persist((set, get) => {
  const updateProject = (id: string | null, patch: Partial<WorkspaceProject>) => {
    if (!id) return;
    set((state) => {
      const projects = state.projects.map((project) => project.projectId === id ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project);
      return { projects, project: projects.find((project) => project.projectId === state.currentProjectId) ?? null };
    });
  };
  return {
    ready: false, studentProfile: null, projects: [], currentProjectId: null, project: null, activities: [], pendingUpload: null,
    setReady: () => { setProjectScope(get().currentProjectId, projectScopeKey(get().project)); set({ ready: true }); },
    saveProfile: (input) => {
      const studentProfile = studentProfileSchema.parse(input);
      set({ studentProfile });
      updateProject(get().currentProjectId, { studentProfile, projectStage: studentProfile.currentProjectStatus });
    },
    newProject: (name, profile) => {
      const studentProfile = studentProfileSchema.parse(profile || get().studentProfile || emptyStudentProfile());
      if (!name.trim()) throw new Error("请填写项目名称");
      const projectId = crypto.randomUUID(); const now = new Date().toISOString();
      const project = workspaceProjectSchema.parse({ projectId, name: name.trim().slice(0, 120), studentProfile, selectedCompetitionId: null, selectedTrackId: null, projectStage: studentProfile.currentProjectStatus, reportId: null, reportIds: [], documentStatus: "not_started", pptStatus: "not_started", createdAt: now, updatedAt: now });
      setProjectScope(projectId);
      set((state) => ({ projects: [...state.projects, project], project, currentProjectId: projectId, studentProfile, pendingUpload: null }));
      return projectId;
    },
    switchProject: (id) => {
      const project = get().projects.find((project) => project.projectId === id);
      if (!project || get().currentProjectId === id) return;
      setProjectScope(id, projectScopeKey(project));
      set({ project, currentProjectId: id, studentProfile: project.studentProfile, pendingUpload: null });
    },
    selectCompetition: (selectedCompetitionId, trackId) => {
      const previous = get().project; if (!previous) return;
      const competition = findCompetition(selectedCompetitionId);
      const selectedTrackId = trackId || competition?.tracks[0]?.trackId || null;
      if (competition && !competition.tracks.some((track) => track.trackId === selectedTrackId)) throw new Error("请选择该比赛的有效赛道");
      if (previous.selectedCompetitionId === selectedCompetitionId && previous.selectedTrackId === selectedTrackId) return;
      const next: WorkspaceProject = { ...previous, selectedCompetitionId, selectedTrackId, selectionRevision: crypto.randomUUID(), competitionConfirmedAt: null, reportId: null, reportIds: [], documentStatus: "not_started", pptStatus: "not_started", updatedAt: new Date().toISOString(), competitionHistory: [...previous.competitionHistory, { scopeKey: projectScopeKey(previous)!, competitionId: previous.selectedCompetitionId, trackId: previous.selectedTrackId, reportId: previous.reportId, reportIds: previous.reportIds, archivedAt: new Date().toISOString() }] };
      setProjectScope(next.projectId, projectScopeKey(next));
      set((state) => ({ projects: state.projects.map((item) => item.projectId === next.projectId ? next : item), project: next, pendingUpload: null }));
    },
    confirmCompetition: () => { if (projectBinding(get().project)) updateProject(get().currentProjectId, { competitionConfirmedAt: new Date().toISOString() }); },
    updatePreparation: (patch) => { const project = get().project; if (project) updateProject(project.projectId, { preparation: preparationSchema.parse({ ...project.preparation, ...patch }) }); },
    renameProject: (name) => { if (name.trim()) updateProject(get().currentProjectId, { name: name.trim().slice(0, 120) }); },
    linkReport: (reportId, _name, projectId = get().currentProjectId || undefined, binding) => {
      const project = get().projects.find((project) => project.projectId === projectId);
      if (binding && !sameBinding(binding, projectBinding(project || null))) return;
      if (project) updateProject(project.projectId, { reportId, reportIds: [...new Set([...project.reportIds, reportId])] });
    },
    setAssetStatus: (asset, status, projectId = get().currentProjectId || undefined, binding) => { const project = get().projects.find((item) => item.projectId === projectId); if (binding && !sameBinding(binding, projectBinding(project || null))) return; updateProject(projectId || null, { [asset]: status }); },
    handoffFile: (file) => { const projectId = get().currentProjectId; if (projectId) set({ pendingUpload: { id: crypto.randomUUID(), file, target: "requirements", projectId } }); },
    consumeUpload: (id) => set((state) => state.pendingUpload?.id === id ? { pendingUpload: null } : {}),
    beginActivity: (input, projectId = get().currentProjectId || undefined) => {
      const id = crypto.randomUUID(); const now = new Date().toISOString();
      if (!projectId) return id;
      const owner = get().projects.find((item) => item.projectId === projectId) || null;
      set((state) => ({ activities: [{ ...input, id, projectId, scopeKey: projectScopeKey(owner) || undefined, competitionId: owner?.selectedCompetitionId || null, status: "running" as const, createdAt: now, updatedAt: now }, ...state.activities].slice(0, 1000) }));
      return id;
    },
    finishActivity: (id, patch) => set((state) => ({ activities: state.activities.map((activity) => activity.id === id ? { ...activity, ...patch, updatedAt: new Date().toISOString(), durationMs: Math.max(0, Date.now() - Date.parse(activity.createdAt)) } : activity) })),
  };
}, {
  name: "zhice:workspace:v1", skipHydration: true,
  partialize: ({ studentProfile, projects, currentProjectId, activities }) => ({ studentProfile, projects, currentProjectId, activities }),
  merge: (persisted, current) => {
    const raw = (persisted || {}) as Record<string, unknown>;
    const profile = studentProfileSchema.safeParse(raw.studentProfile);
    let projects = (Array.isArray(raw.projects) ? raw.projects : []).flatMap((item) => { const parsed = workspaceProjectSchema.safeParse(item); return parsed.success ? [parsed.data] : []; });
    // Old unscoped content belongs only to the pre-existing workspace.
    const old = raw.project as Record<string, unknown> | undefined;
    if (!Array.isArray(raw.projects) && old && typeof old.id === "string" && typeof old.name === "string") {
      setLegacyProjectId(old.id);
      const base = { ...emptyStudentProfile(), school: "待完善", college: "待完善", major: "待完善", competitionGoal: "待完善" };
      const createdAt = typeof old.createdAt === "string" ? old.createdAt : new Date().toISOString();
      projects = [workspaceProjectSchema.parse({ projectId: old.id, name: old.name, studentProfile: base, selectedCompetitionId: null, selectedTrackId: null, projectStage: "no-project", reportId: typeof old.reportId === "string" ? old.reportId : null, reportIds: typeof old.reportId === "string" ? [old.reportId] : [], documentStatus: "not_started", pptStatus: "not_started", createdAt, updatedAt: createdAt })];
    }
    const project = projects.find((project) => project.projectId === raw.currentProjectId) ?? projects[0] ?? null;
    const activities = (Array.isArray(raw.activities) ? raw.activities : []).flatMap((item) => {
      const parsed = activitySchema.safeParse(item); if (!parsed.success) return [];
      const activity = parsed.data;
      return [{ ...activity, projectId: activity.projectId || (old?.id as string | undefined), status: activity.status === "running" ? "warning" as const : activity.status, detail: activity.status === "running" ? "上次会话在完成前离开，请核对结果或重新执行。" : activity.detail }];
    });
    return { ...current, ready: false, projects, project, currentProjectId: project?.projectId ?? null, studentProfile: project?.studentProfile || (profile.success ? profile.data : null), activities, pendingUpload: null };
  },
}));
