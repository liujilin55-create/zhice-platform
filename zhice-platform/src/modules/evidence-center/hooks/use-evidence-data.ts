"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { evidenceSearchResponseSchema, type EvidenceRecord, type EvidenceStatus } from "../types";
import { getEvidence, updateEvidenceStatus } from "../services/evidence-api";
import { projectScopeKey, useWorkspaceStore } from "@/modules/workspace";

export function useEvidenceData() {
  const project = useWorkspaceStore((state) => state.project);
  const cacheKey = "zhice:evidence-cache:v3:" + (projectScopeKey(project) || "none");
  const reportKey = (project?.reportIds || []).join(",");
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const saveCache = useCallback((data: EvidenceRecord[]) => {
    const searchedAt = new Date().toISOString();
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ data, meta: { total: data.length, query: "", kind: "all", searchedAt, searchMode: "local-concept-expansion" } }));
    } catch { /* Storage may be full or unavailable; in-memory data stays usable. */ }
    setSavedAt(searchedAt);
  }, [cacheKey]);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await getEvidence(controller.signal, reportKey.split(",").filter(Boolean));
      if (controller.signal.aborted) return;
      setRecords(response.data);
      setError(null);
      setOffline(false);
      saveCache(response.data);
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure instanceof Error ? failure.message : "暂时无法连接证据库。");
      setOffline(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [saveCache, reportKey]);
  useEffect(() => {
    async function initialize() {
      setRecords([]);
      setSavedAt(null);
      try {
        const raw = localStorage.getItem(cacheKey);
        const cached = evidenceSearchResponseSchema.safeParse(raw ? JSON.parse(raw) : null);
        if (cached.success) {
          setRecords(cached.data.data);
          setSavedAt(cached.data.meta.searchedAt);
        }
      } catch { /* Ignore invalid/expired browser caches, never the server database. */ }
      await refresh();
    }
    void initialize();
    const onOffline = () => setOffline(true);
    const onOnline = () => void refresh();
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      request.current?.abort();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh, cacheKey]);
  const changeStatus = async (id: string, status: EvidenceStatus) => {
    const response = await updateEvidenceStatus(id, status);
    setRecords((current) => {
      const next = current.map((record) => record.id === id ? { ...record, status: response.data.status } : record);
      // Cache updated statuses only after the server acknowledges the mutation.
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: next, meta: { total: next.length, query: "", kind: "all", searchedAt: new Date().toISOString(), searchMode: "local-concept-expansion" } }));
      } catch { /* The saved server state remains authoritative. */ }
      return next;
    });
  };
  return { records, loading, error, offline, savedAt, refresh, changeStatus };
}
