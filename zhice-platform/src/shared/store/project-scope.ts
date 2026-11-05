type Listener = (projectId: string | null, scopeKey: string | null) => void;
let activeId: string | null = null;
let legacyId: string | null = null;
const listeners = new Set<Listener>();
export const getProjectScope = () => activeId;
export const getLegacyProjectId = () => legacyId;
export function setLegacyProjectId(id: string | null) { legacyId = id; }
export function registerProjectScope(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function setProjectScope(projectId: string | null, scopeKey: string | null = projectId) {
  activeId = projectId;
  for (const listener of listeners) listener(projectId, scopeKey);
}
