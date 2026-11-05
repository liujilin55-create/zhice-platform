import { loadCompetitionSource, verifyCompetitionSource, flagCompetitionSourceConflict } from "@/modules/competition-recommendation/server/sources";
import { resolveCompetition } from "@/modules/campus-catalog/server/catalog";
type Context = { params: Promise<{ competitionId: string }> };
function track(request: Request) { return new URL(request.url).searchParams.get("trackId") || ""; }
export async function GET(request: Request, context: Context) {
  const { competitionId } = await context.params;
  if (!(await resolveCompetition(competitionId))?.tracks.some((item) => item.trackId === track(request))) return Response.json({ error: "请先选择有效比赛和赛道。" }, { status: 400 });
  try { return Response.json(await loadCompetitionSource(competitionId, track(request), request.signal)); }
  catch { return Response.json({ error: "来源缓存暂不可用，请稍后重试。" }, { status: 503 }); }
}
export async function POST(request: Request, context: Context) {
  const { competitionId } = await context.params;
  if (!(await resolveCompetition(competitionId))?.tracks.some((item) => item.trackId === track(request))) return Response.json({ error: "比赛与赛道不匹配。" }, { status: 400 });
  try { const input = await request.json(); return Response.json(await (input.action === "conflict" ? flagCompetitionSourceConflict : verifyCompetitionSource)(competitionId, track(request), input)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "核验失败" }, { status: 400 }); }
}
