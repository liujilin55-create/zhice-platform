import { evidenceKindFilterSchema, evidenceStatusSchema, searchEvidence, materializeEvidence, readEvidenceDatabase, setEvidenceStatus } from "@/modules/evidence-center/server";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q")?.trim() || "").slice(0, 500);
    const kind = evidenceKindFilterSchema.safeParse(url.searchParams.get("kind") ?? "all");
    if (!kind.success) return Response.json({ error: "不支持的证据分类。" }, { status: 400 });
    const database = await readEvidenceDatabase();
    const scoped = url.searchParams.get("scope") === "project";
    const reportIds = new Set((url.searchParams.get("reports") || "").split(",").filter(Boolean));
    const visible = scoped ? { ...database, reports: database.reports.filter((report) => reportIds.has(report.id)), citations: database.citations.filter((link) => reportIds.has(link.reportId)) } : database;
    const records = materializeEvidence(visible).filter((record) => !scoped || record.citations.length > 0);
    const data = searchEvidence(records, query, kind.data);
    return Response.json({ data, meta: { total: data.length, query, kind: kind.data, searchedAt: new Date().toISOString(), searchMode: "local-concept-expansion" } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "证据库暂时不可用，请稍后重试。" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const parsed = z.object({ id: z.string().min(1), status: evidenceStatusSchema }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请提供证据 ID 和有效状态。" }, { status: 400 });
  try {
    const data = await setEvidenceStatus(parsed.data.id, parsed.data.status);
    if (!data) return Response.json({ error: "证据不存在。" }, { status: 404 });
    return Response.json({ data });
  } catch {
    return Response.json({ error: "状态保存失败，请重试。" }, { status: 503 });
  }
}
