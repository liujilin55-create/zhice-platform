"use client";
import { useEffect, useState } from "react";
import { getOverview } from "../services/overview-api";
import type { OverviewSnapshot } from "../dashboard-types";

export function useOverviewSnapshot(reportId: string | null, empty: boolean, enabled = true) {
  const [state, setState] = useState<{ data: OverviewSnapshot | null; error: string | null; loading: boolean; key: string }>({ data: null, error: null, loading: true, key: "" });
  const [revision, setRevision] = useState(0);
  const key = (empty ? "empty" : reportId || "auto") + ":" + revision;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getOverview(reportId, empty, controller.signal).then(({ data }) => {
      if (!controller.signal.aborted) setState({ data, error: null, loading: false, key });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ data: null, loading: false, error: error instanceof Error ? error.message : "项目资料读取失败。", key });
    });
    return () => controller.abort();
  }, [reportId, empty, enabled, key]);
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : null, loading: !enabled || state.key !== key || state.loading, refresh: () => setRevision((value) => value + 1) };
}
