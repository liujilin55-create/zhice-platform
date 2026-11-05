import { getOverviewSnapshot } from "@/modules/project-overview/server";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const data = await getOverviewSnapshot(params.get("reportId"), params.get("scope") === "empty");
    return data ? Response.json({ data }) : Response.json({ error: "该指导报告暂不可用，请从证据中心查看历史记录。" }, { status: 404 });
  } catch { return Response.json({ error: "暂时无法读取项目资料，请重试。" }, { status: 500 }); }
}
