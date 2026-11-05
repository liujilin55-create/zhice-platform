"use client";
import { useCallback, useEffect, useState } from "react";
import { getCompetitionSource, verifyCompetitionSource, type CompetitionSourceResponse } from "@/modules/competition-recommendation";
export function useCompetitionSource(competitionId: string | null, trackId: string | null) {
  const [data, setData] = useState<CompetitionSourceResponse | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!competitionId || !trackId) return;
    const controller = new AbortController();
    queueMicrotask(() => { if (!controller.signal.aborted) { setLoading(true); setError(null); } });
    void getCompetitionSource(competitionId, trackId, controller.signal).then((value) => { if (!controller.signal.aborted) setData(value); }).catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "读取来源失败"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [competitionId, trackId, version]);
  const verify = useCallback(async (criteria: Array<{ title: string; quote: string }>, conflictReason?: string) => {
    if (!competitionId || !trackId || !data?.source) return;
    setError(null);
    try { setData(await verifyCompetitionSource(competitionId, trackId, { sourceId: data.source.sourceId, contentHash: data.source.contentHash, criteria, confirm: true, ...(conflictReason ? { action: "conflict", reason: conflictReason } : {}) }, new AbortController().signal)); }
    catch (error) { setError(error instanceof Error ? error.message : "核验保存失败"); }
  }, [competitionId, trackId, data]);
  return { data, loading, error, verify, reload: () => setVersion((value) => value + 1) };
}
