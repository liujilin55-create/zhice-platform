import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import JSZip from "jszip";

// Isolate credentials and persistence while exercising the real route, Word
// parser, pipeline, AI SDK and Chat Completions stream. No network is allowed.
globalThis.__analysisCaptures = 0;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier === "@/lib/ai-config") return { url: "data:text/javascript," + encodeURIComponent('export async function getAiConfig(){ return { enabled:true, apiKey:"test-key", baseUrl:"https://fixture.invalid/v1", model:"fixture", systemPrompt:"测试提示词", temperature:0, maxTokens:2400 }; }'), shortCircuit: true };
    if (specifier === "@/modules/evidence-center/server") return { url: "data:text/javascript," + encodeURIComponent('export async function captureAnalysis(){ globalThis.__analysisCaptures++; return {reportId:"fixture-report",evidenceIds:[]}; }'), shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const target = new URL("../src/" + specifier.slice(2), import.meta.url);
      return { url: existsSync(fileURLToPath(target) + ".ts") ? target.href + ".ts" : target.href + "/index.ts", shortCircuit: true };
    }
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      try { return nextResolve(specifier + ".ts", context); } catch { /* Fall through. */ }
    }
    return nextResolve(specifier, context);
  },
});
const { POST } = await import("../src/app/api/competition-requirements/route.ts");
const { emptyRequirements, emptyReport } = await import("../src/modules/competition-requirements/partial-analysis.ts");
const { readJsonLines } = await import("../src/shared/api-client/index.ts");
const { analysisEventSchema } = await import("../src/modules/competition-requirements/stream-types.ts");
const requirements = { ...emptyRequirements(), title: "算法比赛", summary: "技术实现需要验证", keywords: ["算法"] };
const report = { ...emptyReport(), overview: "流式指导摘要", topicDirections: [{ title: "算法可视化", reason: "符合专业", expectedOutput: "Web 产品" }], technicalRoute: ["建立基线", "比较实验"] };

async function uploadRequest(signal, accept = "application/x-ndjson") {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');
  zip.file("word/document.xml", '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>算法比赛：技术实现需要验证，提交 Web 产品。</w:t></w:r></w:p></w:body></w:document>');
  const body = new FormData();
  body.append("file", new Blob([await zip.generateAsync({ type: "uint8array" })]), "fixture.docx");
  body.append("major", "计算机科学与技术");
  body.append("binding", JSON.stringify({projectId:"fixture-project",competitionId:"lanqiao-cup",trackId:"lanqiao-cup-general",revision:"fixture-revision"}));
  return new Request("http://localhost/api/competition-requirements", { method: "POST", body, signal, headers: { Accept: accept } });
}
function mockUpstream() {
  const encoder = new TextEncoder();
  const json = JSON.stringify({ requirements, report });
  const split = json.indexOf(',"technicalRoute"');
  let release;
  const fetch = async (url, init) => {
    if (String(url).startsWith("https://api.semanticscholar.org/")) return Response.json({ data: [{ paperId: "p1", title: "Algorithm evaluation", year: 2025, authors: [{ name: "Test author" }], abstract: "Comparative evaluation of algorithms.", url: "https://example.org/p1", citationCount: 2 }] });
    assert.equal(String(url), "https://fixture.invalid/v1/chat/completions");
    assert.equal(JSON.parse(init.body).stream, true);
    let closed = false;
    return new Response(new ReadableStream({ start(c) {
      const send = (content, finish = null) => c.enqueue(encoder.encode("data: " + JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta: { content }, finish_reason: finish }] }) + "\n\n"));
      release = () => { if (closed) return; closed = true; send(json.slice(split), "stop"); c.enqueue(encoder.encode("data: [DONE]\n\n")); c.close(); };
      init.signal?.addEventListener("abort", () => { if (!closed) { closed = true; c.error(new DOMException("cancelled", "AbortError")); } });
      send(json.slice(0, split));
    } }), { headers: { "Content-Type": "text/event-stream" } });
  };
  return { fetch, release: () => release() };
}

test("real route parses Word and streams validated AI partials before final persistence", async () => {
  const original = globalThis.fetch;
  const upstream = mockUpstream();
  globalThis.fetch = upstream.fetch;
  try {
    const response = await POST(await uploadRequest());
    assert(response.headers.get("content-type").includes("application/x-ndjson"));
    const events = [];
    let ready;
    const draftReceived = new Promise((resolve) => { ready = resolve; });
    const consume = readJsonLines(response.body, analysisEventSchema, (event) => {
      events.push(event);
      if (event.type === "draft" && event.report?.overview) ready();
    });
    await draftReceived;
    assert(events.some((e) => e.type === "file" && e.textPreview.includes("技术实现需要验证")));
    assert(events.some((e) => e.type === "papers" && e.papers.length === 1));
    assert.equal(globalThis.__analysisCaptures, 0);
    assert(!events.some((e) => e.type === "complete"));
    upstream.release();
    await consume;
    const complete = events.at(-1);
    assert.equal(complete.type, "complete");
    assert.equal(complete.result.mode, "ai");
    assert.equal(complete.result.projectId, "fixture-project"); assert.equal(complete.result.competitionId, "lanqiao-cup");
    assert.equal(complete.result.binding.trackId, "lanqiao-cup-general"); assert.equal(complete.result.binding.verificationStatus, "pending");
    assert(complete.result.reportId.startsWith("report-")); assert(complete.result.sourceId.startsWith("upload-"));
    assert.equal(complete.result.sources[0].kind, "upload"); assert.equal(complete.result.sources[0].verificationStatus, "pending");
    assert.deepEqual(complete.result.report.technicalRoute, report.technicalRoute);
    assert.equal(complete.result.traceability.reportId, "fixture-report");
    assert.equal(globalThis.__analysisCaptures, 1);
  } finally { globalThis.fetch = original; }
});

test("request cancellation aborts upstream and never persists an incomplete report", async () => {
  const original = globalThis.fetch;
  const upstream = mockUpstream();
  globalThis.fetch = upstream.fetch;
  const controller = new AbortController();
  try {
    const before = globalThis.__analysisCaptures;
    const response = await POST(await uploadRequest(controller.signal));
    const events = [];
    await readJsonLines(response.body, analysisEventSchema, (event) => {
      events.push(event);
      if (event.type === "draft") controller.abort();
    });
    assert.equal(events.at(-1).type, "error");
    assert(!events.some((e) => e.type === "complete"));
    assert.equal(globalThis.__analysisCaptures, before);
  } finally { globalThis.fetch = original; }
});
