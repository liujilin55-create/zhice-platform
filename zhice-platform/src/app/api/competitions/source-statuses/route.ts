import { competitionSourceStatuses } from "@/modules/competition-recommendation/server/sources";
export async function GET() {
  try { return Response.json(await competitionSourceStatuses()); }
  catch { return Response.json({ error: "来源状态暂不可用，未加载信息请保持待核验。" }, { status: 503 }); }
}
