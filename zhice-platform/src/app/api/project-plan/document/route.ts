import { competitionBindingSchema } from "@/shared/contracts/competition-binding";
import { savePlanDocument, readPlanDocument, PlanDocumentError } from "@/modules/project-plan/server/document-repository";

export async function PUT(request: Request) {
  try {
    const text = await request.text(); if (text.length > 2_000_000) return Response.json({ error: "计划书过大，请精简后保存。" }, { status: 413 });
    return Response.json(await savePlanDocument(JSON.parse(text)));
  } catch (error) { return Response.json({ error: error instanceof PlanDocumentError ? error.message : "计划书格式异常或保存失败。" }, { status: error instanceof PlanDocumentError ? error.status : 400 }); }
}
export async function GET(request: Request) {
  try {
    const binding = competitionBindingSchema.parse(JSON.parse(new URL(request.url).searchParams.get("binding") || "null"));
    return Response.json(await readPlanDocument(binding), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof PlanDocumentError ? error.message : "无法读取该项目的计划书。" }, { status: error instanceof PlanDocumentError ? error.status : 400 }); }
}
