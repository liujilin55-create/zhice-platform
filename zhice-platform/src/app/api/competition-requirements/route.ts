import { analyzeRequirements, validateUpload } from "@/modules/competition-requirements/server";
import type { AnalysisEvent } from "@/modules/competition-requirements/stream-types";
import { competitionBindingSchema, type CompetitionBinding, type RequirementSource, type ScoringClause } from "@/shared/contracts/competition-binding";
import { resolveCompetition } from "@/modules/campus-catalog/server/catalog";
import { cachedCompetitionSource } from "@/modules/competition-recommendation/server/sources";

export const maxDuration = 120;

function errorResponse(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  let file: File | null;
  let major: string;
  let notes: string;
  let binding: CompetitionBinding; let source: RequirementSource | null = null; let scoringClauses: ScoringClause[] = [];
  let sourceMode: "official" | "supplement" | "override";
  try {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) return errorResponse("请使用 multipart/form-data 上传文件。");
    const form = await request.formData();
    const parsedBinding = competitionBindingSchema.safeParse(JSON.parse(String(form.get("binding") || "null")));
    if (!parsedBinding.success) return errorResponse("请先为当前备赛项目选择比赛和赛道。");
    binding = parsedBinding.data;
    const competition = (await resolveCompetition(binding.competitionId));
    if (!competition?.tracks.some((track) => track.trackId === binding.trackId)) return errorResponse("当前比赛和赛道无效，请重新选择。");
    const upload = form.get("file");
    file = upload instanceof File ? upload : null;
    if (file) validateUpload(file);
    sourceMode = form.get("sourceMode") === "override" ? "override" : file ? "supplement" : "official";
    const entry = await cachedCompetitionSource(binding.competitionId, binding.trackId, String(form.get("sourceId") || "") || undefined);
    source = entry?.source || null; scoringClauses = entry?.criteria || [];
    if (!file && !source?.text) return errorResponse("当前比赛没有可读的官方资料，请先加载来源或上传补充文件。", 409);
    if (!file && sourceMode === "override") return errorResponse("覆盖来源需要上传文件。");
    major = String(form.get("major") || "").trim().slice(0, 200);
    notes = String(form.get("notes") || "").trim().slice(0, 3000);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "文件接收失败，请重新上传。");
  }
  const cancellation = new AbortController();
  const timeout = AbortSignal.timeout(110_000);
  const signal = AbortSignal.any([request.signal, cancellation.signal, timeout]);
  const failure = () => timeout.aborted ? "分析耗时较长，本次已停止。已接收内容仍可阅读，请稍后重试。" : "分析中断，已接收内容仍可阅读，请检查文件后重试。";
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
    try { return Response.json(await analyzeRequirements(file, major, notes, () => {}, signal, { binding, source, scoringClauses, sourceMode })); }
    catch { return errorResponse(failure(), timeout.aborted ? 504 : 500); }
  }
  const encoder = new TextEncoder();
  let closed = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: AnalysisEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); }
        catch { closed = true; cancellation.abort(); }
      };
      // A heartbeat only confirms the connection; it never advances a step.
      const heartbeat = setInterval(() => emit({ type: "heartbeat" }), 8000);
      void (async () => {
        try { await analyzeRequirements(file, major, notes, emit, signal, { binding, source, scoringClauses, sourceMode }); }
        catch { emit({ type: "error", message: failure() }); }
        finally {
          clearInterval(heartbeat);
          if (!closed) { closed = true; controller.close(); }
        }
      })();
    },
    cancel() { closed = true; cancellation.abort(); },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
