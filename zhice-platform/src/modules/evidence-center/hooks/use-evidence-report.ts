"use client";

import { useCallback, useEffect, useState } from "react";
import { getReport } from "../services/evidence-api";
import { reportResponseSchema, type ReportResponse } from "../types";

export function useEvidenceReport(id: string) {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const cacheKey = "zhice:evidence-report:v1:" + id;
    async function load() {
      setLoading(true);
      setError(null);
      setReport(null);
      try {
        const cached = reportResponseSchema.safeParse(JSON.parse(localStorage.getItem(cacheKey) ?? "null"));
        if (cached.success) setReport(cached.data);
      } catch { /* Browser storage is optional. */ }
      try {
        const response = await getReport(id, controller.signal);
        if (controller.signal.aborted) return;
        setReport(response);
        setOffline(false);
        try { localStorage.setItem(cacheKey, JSON.stringify(response)); } catch { /* Keep in-memory response. */ }
      } catch (failure) {
        if (controller.signal.aborted) return;
        setOffline(true);
        setError(failure instanceof Error ? failure.message : "报告加载失败。");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    window.addEventListener("online", retry);
    return () => { controller.abort(); window.removeEventListener("online", retry); };
  }, [id, attempt, retry]);
  return { report, loading, offline, error, retry };
}
