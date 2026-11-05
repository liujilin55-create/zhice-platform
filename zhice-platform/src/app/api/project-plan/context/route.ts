import { getPlanContext } from "@/modules/project-plan/server";
import { planWorkspaceSchema } from "@/modules/project-plan/types";
export async function POST(request: Request) {
  const input = planWorkspaceSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "请先选择比赛，并提供当前项目画像。" }, { status: 400 });
  try { return Response.json({ data: await getPlanContext(input.data.reportId, input.data) }); }
  catch { return Response.json({ error: "赛事来源上下文暂不可用，请稍后重试。" }, { status: 503 }); }
}
export async function GET() { return Response.json({ data: await getPlanContext(null) }); }
