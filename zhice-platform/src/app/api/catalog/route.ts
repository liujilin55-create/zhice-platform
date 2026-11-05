import { readCatalog } from "@/modules/campus-catalog/server/repository";
import { directoryToCompetition } from "@/modules/campus-catalog/adapter";
export async function GET() {
  try { const db = await readCatalog(); return Response.json({ data: { revision: db.revision, competitions: db.records.map(directoryToCompetition), templates: db.templates } }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "目录暂不可用，请重试。" }, { status: 503 }); }
}
