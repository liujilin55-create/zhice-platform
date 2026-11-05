import { getEvidenceReport } from "@/modules/evidence-center/server";

export async function GET(_request: Request, context: { params: Promise<{ reportId: string }> }) {
  try {
    const { reportId } = await context.params;
    const result = await getEvidenceReport(reportId);
    if (!result) return Response.json({ error: "报告不存在或已删除。" }, { status: 404 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "报告暂时不可用，请重试。" }, { status: 503 });
  }
}
