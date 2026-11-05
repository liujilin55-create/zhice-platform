import { z } from "zod";
import { searchAcademicPapers } from "@/modules/competition-requirements/analyzer";
const inputSchema = z.object({ query: z.string().trim().min(2).max(200) });
export async function POST(request: Request) {
  const input = inputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "请输入 2–200 字的检索关键词。" }, { status: 400 });
  try {
    const keywords = input.data.query.split(/[\s,，、;；]+/).filter(Boolean).slice(0, 8);
    const data = await searchAcademicPapers(keywords, input.data.query, request.signal);
    return Response.json({ data, cached: data.length > 0 && data.every((paper) => !/Semantic Scholar/i.test(paper.source)) });
  } catch { return Response.json({ error: "文献检索已中断，请重试。" }, { status: 500 }); }
}
