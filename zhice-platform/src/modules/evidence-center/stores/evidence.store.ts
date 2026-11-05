import { create } from "zustand";
import { registerProjectScope } from "@/shared/store/project-scope";
import type { EvidenceKindFilter } from "../types";

export type EvidenceUiState = {
  query: string;
  kind: EvidenceKindFilter;
  selectedEvidenceId: string | null;
  drawerOpen: boolean;
  setQuery: (query: string) => void;
  setKind: (kind: EvidenceKindFilter) => void;
  openEvidence: (id: string) => void;
  closeDrawer: () => void;
  reset: () => void;
};

const initialState = {
  query: "",
  kind: "all" as EvidenceKindFilter,
  selectedEvidenceId: null,
  drawerOpen: false,
};

export const useEvidenceStore = create<EvidenceUiState>()((set) => ({
  ...initialState,
  setQuery: (query) => set({ query }),
  setKind: (kind) => set({ kind }),
  openEvidence: (selectedEvidenceId) => set({ selectedEvidenceId, drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  reset: () => set(initialState),
}));
registerProjectScope(() => useEvidenceStore.getState().reset());
