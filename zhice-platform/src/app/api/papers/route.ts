import { z } from "zod";
import { searchAcademicPapers } from "@/modules/competition-requirements/analyzer";
import { AcademicSearchUnavailableError } from "@/modules/competition-requirements/academic-search";
const inputSchema = z.object({ query: z.string().trim().min(2).max(200) });
export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "请输入 2–200 字的检索关键词。" }, { status: 400 });
  try {
    const keywords = input.data.query.split(/[\s,，、;；]+/).filter(Boolean).slice(0, 8);
    const data = await searchAcademicPapers(keywords, input.data.query, request.signal, { onlineOnly: true });
    return Response.json({ data, cached: false });
  } catch (failure) {
    if (request.signal.aborted) return Response.json({ error: "文献检索已取消。" }, { status: 499 });
    if (failure instanceof AcademicSearchUnavailableError) return Response.json({ error: failure.message }, { status: 503 });
    return Response.json({ error: "文献检索失败，请稍后重试。" }, { status: 500 });
  }
}
