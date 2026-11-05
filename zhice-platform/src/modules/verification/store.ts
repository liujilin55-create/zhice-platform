"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { verificationKey, verificationRecordSchema, verificationTaskSchema, type VerificationRecord, type VerificationTask } from "./model";

type State = {
  tasks: Record<string, VerificationTask>; records: Record<string, VerificationRecord>; active: VerificationTask | null;
  register: (task: VerificationTask) => void; open: (task: VerificationTask) => void; quickConfirm: (task: VerificationTask) => void; close: () => void;
  confirm: (record: VerificationRecord) => void; revoke: (key: string) => void;
};
export const useVerificationStore = create<State>()(persist((set) => ({
  tasks: {}, records: {}, active: null,
  register: (task) => set((state) => {
    const key = verificationKey(task);
    if (JSON.stringify(state.tasks[key]) === JSON.stringify(task)) return {};
    const tasks = Object.fromEntries(Object.entries(state.tasks).filter(([, previous]) => previous.scope !== task.scope || previous.id !== task.id));
    return { tasks: { ...tasks, [key]: task } };
  }),
  open: (active) => set({ active }),
  quickConfirm: (task) => { const record = verificationRecordSchema.parse({ ...task, outcome: "pending", value: "已查看，暂时无法确认", reviewer: "当前用户", source: "当前项目内快速确认", note: "已查看当前内容，暂时没有足够依据；保持待补资料状态。", confirmedAt: new Date().toISOString() }); set((state) => ({ records: { ...state.records, [verificationKey(record)]: record } })); },
  close: () => set({ active: null }),
  confirm: (input) => { const record = verificationRecordSchema.parse(input); set((state) => ({ records: { ...state.records, [verificationKey(record)]: record }, active: null })); },
  revoke: (key) => set((state) => { const records = { ...state.records }; delete records[key]; return { records }; }),
}), {
  name: "zhice:verifications:v1", skipHydration: true,
  partialize: ({ tasks, records }) => ({ tasks, records }),
  merge: (persisted, current) => {
    const raw = (persisted || {}) as Record<string, unknown>;
    const parse = <T extends VerificationTask,>(input: unknown, schema: { safeParse: (value: unknown) => { success: boolean; data?: T } }) => Object.fromEntries(Object.values((input || {}) as Record<string, unknown>).flatMap((value) => { const result = schema.safeParse(value); return result.success && result.data ? [[verificationKey(result.data), result.data]] : []; }));
    return { ...current, tasks: parse(raw.tasks, verificationTaskSchema), records: parse(raw.records, verificationRecordSchema), active: null };
  },
}));
