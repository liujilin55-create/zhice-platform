import { briefingRequestSchema, type BriefingEvent } from "@/modules/project-overview/dashboard-types";
import { generateBriefing } from "@/modules/project-overview/server/briefing";
export const maxDuration = 60;
export async function POST(request: Request) {
  const input = briefingRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "请提供有效的项目上下文。" }, { status: 400 });
  const cancelled = new AbortController();
  const signal = AbortSignal.any([request.signal, cancelled.signal, AbortSignal.timeout(55_000)]);
  const encoder = new TextEncoder();
  let closed = false;
  return new Response(new ReadableStream({
    start(controller) {
      const send = (text: string) => { if (!closed) { try { controller.enqueue(encoder.encode(text)); } catch { closed = true; cancelled.abort(); } } };
      const emit = (event: BriefingEvent) => send("data: " + JSON.stringify(event) + "\n\n");
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), 8000);
      void generateBriefing(input.data, signal, emit).catch(() => emit({ type: "error", message: "简报生成中断，可以重试；已有项目资料仍可使用。" })).finally(() => {
        clearInterval(heartbeat); if (!closed) { closed = true; controller.close(); }
      });
    }, cancel() { closed = true; cancelled.abort(); },
  }), { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
