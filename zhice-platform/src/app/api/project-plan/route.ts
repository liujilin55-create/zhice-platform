import { runChapter, runReport, runSurvey } from "@/modules/project-plan/server";
import { planExportResponseSchema, planReportSchema, surveySessionSchema, planWorkspaceSchema, type PlanEvent } from "@/modules/project-plan/types";
import { createDocxBase64 } from "@/modules/project-plan/server/docx";
import { z } from "zod";
import { sameBinding } from "@/shared/contracts/competition-binding";
import { resolveCompetition } from "@/modules/campus-catalog/server/catalog";
import { getPlanContext } from "@/modules/project-plan/server";

export const maxDuration = 120;
const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("survey"), workspace: planWorkspaceSchema, session: surveySessionSchema, message: z.string().trim().min(1).max(1200), reportId: z.string().max(180).nullable().optional() }),
  z.object({ action: z.literal("report"), workspace: planWorkspaceSchema, session: surveySessionSchema, reportId: z.string().max(180).nullable().optional() }),
  z.object({ action: z.literal("chapter"), workspace: planWorkspaceSchema, session: surveySessionSchema, report: planReportSchema.nullable(), reportId: z.string().max(180).nullable().optional(), chapterId: z.string().min(1).max(120) }),
  z.object({ action: z.literal("export"), workspace: planWorkspaceSchema, format: z.enum(["markdown", "docx"]), title: z.string().trim().min(1).max(180), session: surveySessionSchema, report: planReportSchema.nullable(), chapters: z.array(z.object({ id: z.string(), title: z.string(), content: z.string().max(20_000), status: z.enum(["draft", "confirmed", "partial", "blocked", "ready"]), updatedAt: z.string() })).max(20) }),
]);

function streamResponse(request: Request, run: (signal: AbortSignal, emit: (event: PlanEvent) => void) => Promise<void>) {
  const cancellation = new AbortController(); const timeout = AbortSignal.timeout(110_000); const signal = AbortSignal.any([request.signal, cancellation.signal, timeout]); const encoder = new TextEncoder(); let closed = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    const emit = (event: PlanEvent) => { if (!closed) { try { controller.enqueue(encoder.encode("data: " + JSON.stringify(event) + "\n\n")); } catch { closed = true; cancellation.abort(); } } };
    const heartbeat = setInterval(() => { if (!closed) { try { controller.enqueue(encoder.encode(": keep-alive\n\n")); } catch { closed = true; cancellation.abort(); } } }, 8000);
    void run(signal, emit).catch(() => { if (!signal.aborted) emit({ type: "error", message: timeout.aborted ? "生成超时，请保留已有草稿并重试。" : "本次生成中断，已接收内容仍可阅读并重试。" }); }).finally(() => { clearInterval(heartbeat); if (!closed) { closed = true; controller.close(); } });
  }, cancel() { closed = true; cancellation.abort(); } });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}

function markdown(title: string, session: z.infer<typeof surveySessionSchema>, report: z.infer<typeof planReportSchema> | null, chapters: Array<{ title: string; content: string }>) {
  const slots = Object.values(session.slots).map((slot) => `- **${slot.label}**：${slot.value || "____（建议补充）"}${slot.status === "needsVerification" ? "【AI推断，请核验】" : ""}`).join("\n");
  const result = [`# ${title}`, "> 项目计划书工作稿 · AI 建议，仅供参考。赛事要求和数据请以官方资料及人工核验为准。", "\n## 项目信息槽位\n" + slots];
  if (report) result.push("\n## 预期结果报告\n\n### 信息完整度\n" + report.completeness.map((item) => `- ${item.dimension}：${item.status}。${item.nextAction}`).join("\n") + "\n\n### 赛事要求对齐\n" + report.alignment.map((item) => `- ${item.criterion}：${item.coverage}。${item.action}`).join("\n") + "\n\n### 风险与评委追问\n" + report.risks.map((item) => `- ${item.question}\n  准备建议：${item.suggestion}`).join("\n") + "\n\n### 章节就绪度\n" + report.chapters.map((item) => `- ${item.title}：${item.status}。${item.reason}`).join("\n"));
  result.push("\n## 计划书初稿\n" + (chapters.length ? chapters.map((chapter) => chapter.content).join("\n\n---\n\n") : "各章节尚未生成。"));
  if (report) result.push("\n## 归属与来源\n" + `项目：${report.projectId || "待确认"}\n比赛：${report.competitionId || "待确认"}\n报告：${report.reportId || "待确认"}\n状态：${report.generationStatus === "formal" ? "正式计划书初稿" : "待核验草稿"}\n` + report.sources.map((source) => `- ${source.title} · ${source.verificationStatus === "verified" ? "已人工核验" : "待核验"} · ${source.url || "用户上传，非官方来源"} · ${source.sourceId}`).join("\n") + "\n" + report.alignment.filter((item) => item.sourceId).map((item) => `- ${item.criterion}：${item.sourceQuote}\n  来源：${item.sourceId} ${item.sourceUrl || ""}`).join("\n"));
  return result.join("\n");
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "请求参数不完整或格式不正确。" }, { status: 400 });
  const input = parsed.data;
  const competition = (await resolveCompetition(input.workspace.binding.competitionId));
  if (!competition?.tracks.some((track) => track.trackId === input.workspace.binding.trackId)) return Response.json({ error: "请先选择有效比赛和赛道。" }, { status: 409 });
  if (input.session.binding && !sameBinding(input.session.binding, input.workspace.binding)) return Response.json({ error: "问卷属于其他比赛或项目，请重新开始。" }, { status: 409 });
  if ((input.action === "chapter" || input.action === "export") && input.report && !sameBinding(input.report.binding, input.workspace.binding)) return Response.json({ error: "报告不属于当前比赛或项目，请重新生成。" }, { status: 409 });
  if (input.action !== "survey" && !input.session.complete) return Response.json({ error: "请先完成当前比赛的项目问卷。" }, { status: 409 });
  const context = await getPlanContext(input.workspace.reportId, input.workspace);
  if (input.workspace.intent === "formal" && !context.canGenerateFormal) return Response.json({ error: "暂不能生成正式计划书：" + context.blockers.join("；") }, { status: 409 });
  if (input.action === "survey") return streamResponse(request, (signal, emit) => runSurvey(input.session, input.message, input.workspace.reportId, signal, emit, input.workspace));
  if (input.action === "report") return streamResponse(request, (signal, emit) => runReport(input.session, input.workspace.reportId, signal, emit, input.workspace));
  if (input.action === "chapter") return streamResponse(request, (signal, emit) => runChapter(input.session, input.report, input.workspace.reportId, input.chapterId, signal, emit, input.workspace));
  const markdownContent = markdown(input.title, input.session, input.report, input.chapters);
  const isDocx = input.format === "docx";
  const content = isDocx ? await createDocxBase64(markdownContent) : markdownContent;
  const payload = planExportResponseSchema.parse({ ok: true, format: input.format, filename: input.title.replace(/[\\/:*?"<>|]/g, "-") + (isDocx ? ".docx" : ".md"), content, encoding: isDocx ? "base64" : "utf8" });
  return Response.json(payload);
}
