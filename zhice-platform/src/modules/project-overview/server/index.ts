import "server-only";
import { readEvidenceDatabase } from "@/modules/evidence-center/server";
import { buildOverviewSnapshot } from "../coverage";
export async function getOverviewSnapshot(reportId?: string | null, empty = false) {
  const database = await readEvidenceDatabase();
  if (reportId && !empty && !database.reports.some((report) => report.id === reportId && report.mode !== "sample")) return null;
  return buildOverviewSnapshot(database, reportId, empty);
}
