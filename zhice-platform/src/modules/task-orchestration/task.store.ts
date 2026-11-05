"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getLegacyProjectId, registerProjectScope } from "@/shared/store/project-scope";
import { orchestrationTaskSchema, type OrchestrationTask } from "./types";

type TaskState = {
  projectId: string | null; scopeKey: string | null; tasks: OrchestrationTask[]; byProject: Record<string, OrchestrationTask[]>;
  activateProject: (id: string | null, key?: string | null) => void;
  setTasks: (update: (current: OrchestrationTask[]) => OrchestrationTask[]) => void;
};
export const useTaskStore = create<TaskState>()(persist((set, get) => ({
  projectId: null, scopeKey: null, tasks: [], byProject: {},
  activateProject: (projectId, scopeKey = projectId) => {
    const state = get(); if (state.projectId === projectId && state.scopeKey === scopeKey) return;
    const byProject = { ...state.byProject, ...(state.scopeKey ? { [state.scopeKey]: state.tasks } : {}) };
    set({ projectId, scopeKey, byProject, tasks: scopeKey ? byProject[scopeKey] || [] : [] });
  },
  setTasks: (update) => set((state) => ({ tasks: state.projectId ? update(state.tasks).map((task) => ({ ...task, projectId: state.projectId! })) : [] })),
}), {
  name: "zhice:tasks:v1", skipHydration: true,
  partialize: (state) => ({ byProject: { ...state.byProject, ...(state.scopeKey ? { [state.scopeKey]: state.tasks } : {}) } }),
  merge: (persisted, current) => {
    const stored = (persisted || {}) as { byProject?: Record<string, unknown>; tasks?: unknown };
    const byProject = Object.fromEntries(Object.entries(stored.byProject || {}).flatMap(([id, tasks]) => {
      const parsed = orchestrationTaskSchema.array().safeParse(tasks); return parsed.success ? [[id, parsed.data.map((task) => ({ ...task, projectId: id.includes("::") ? decodeURIComponent(id.split("::")[0]) : id }))]] : [];
    }));
    const legacy = orchestrationTaskSchema.array().safeParse(stored.tasks);
    if (!stored.byProject && legacy.success) for (const task of legacy.data) {
      const id = task.projectId || getLegacyProjectId();
      if (id && !task.sample) byProject[id] = [...(byProject[id] || []), { ...task, projectId: id }];
    }
    return { ...current, projectId: null, scopeKey: null, tasks: [], byProject };
  },
}));
registerProjectScope((id, key) => useTaskStore.getState().activateProject(id, key));
