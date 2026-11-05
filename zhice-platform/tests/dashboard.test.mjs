import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Replace provider config and the evidence repository before loading routes.
// Production credentials, reports and browser storage are never touched.
globalThis.__dashboardEnabled = false;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript," + encodeURIComponent('export async function getAiConfig(){return{enabled:globalThis.__dashboardEnabled,apiKey:"test-key",baseUrl:"https://fixture.invalid/v1",model:"fixture",systemPrompt:"测试简报",temperature:0,maxTokens:2400}}'), shortCircuit: true };
  if (specifier === "@/modules/evidence-center/server") return { url: "data:text/javascript,export async function readEvidenceDatabase(){return globalThis.__dashboardDatabase}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const target = new URL("../src/" + specifier.slice(2), import.meta.url);
    return { url: existsSync(fileURLToPath(target) + ".ts") ? target.href + ".ts" : target.href + "/index.ts", shortCircuit: true };
  }
  if (specifier.startsWith(".") && !path.extname(specifier)) { try { return nextResolve(specifier + ".ts", context); } catch { /* Continue standard resolution. */ } }
  return nextResolve(specifier, context);
} });
const { seedEvidenceDatabase } = await import("../src/modules/evidence-center/data.ts");
const { buildOverviewSnapshot } = await import("../src/modules/project-overview/coverage.ts");
const { briefingEventSchema, overviewSnapshotSchema } = await import("../src/modules/project-overview/dashboard-types.ts");
const { readServerEvents } = await import("../src/shared/api-client/index.ts");
const { POST } = await import("../src/app/api/project-overview/briefing/route.ts");
const { GET } = await import("../src/app/api/project-overview/route.ts");
const fixture = () => {
  const database = structuredClone(seedEvidenceDatabase);
  database.records[0].sourceMode = "upload"; database.records[0].status = "confirmed";
  database.reports.push({ id: "actual-report", title: "算法比赛 · 指导报告", createdAt: "2026-10-30T08:00:00.000Z", mode: "ai", blocks: [
    { id: "score-0", heading: "评分点 · 创新性", text: "验证创新假设" }, { id: "score-1", heading: "评分点 · 技术实现", text: "完成对照实验" }, { id: "score-2", heading: "评分点 · 答辩", text: "" },
  ] });
  database.citations.push({ id: "actual-cite", reportId: "actual-report", blockId: "score-0", evidenceId: database.records[0].id, verification: "confirmed" });
  return database;
};
const request = (signal) => new Request("http://localhost/api/project-overview/briefing", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: "actual-report", empty: false, projectName: "算法比赛", tasks: [{ title: "完成对照实验", status: "active" }] }) });
const consume = async (response) => { const events = []; await readServerEvents(response.body, briefingEventSchema, (e) => events.push(e)); return events; };

test("coverage uses current report, confirmed citation and real active evidence; examples cannot turn green", () => {
  const database = fixture();
  assert.equal(buildOverviewSnapshot(database).reportId, null, "no implicit latest report context");
  const snapshot = buildOverviewSnapshot(database, "actual-report");
  overviewSnapshotSchema.parse({ data: snapshot });
  assert.equal(snapshot.reportId, "actual-report");
  assert.deepEqual(snapshot.coverage.map((row) => row.state), ["covered", "partial", "idle"]);
  assert(snapshot.coverage[1].href.includes("report=actual-report&criterion=score-1#coverage-score-1"));
  for (const variation of ["pending-citation", "pending-record", "sample", "deprecated", "demo"]) {
    const altered = fixture();
    if (variation === "pending-citation") altered.citations.at(-1).verification = "pending";
    if (variation === "pending-record") altered.records[0].status = "pending";
    if (variation === "sample") altered.records[0].sourceMode = "sample";
    if (variation === "deprecated") altered.records[0].status = "deprecated";
    if (variation === "demo") altered.reports.at(-1).mode = "demo";
    assert.equal(buildOverviewSnapshot(altered, "actual-report").coverage[0].state, "partial", variation);
  }
  const empty = buildOverviewSnapshot(database, null, true);
  assert.equal(empty.reportId, null); assert.equal(empty.evidenceCount, 0);
  assert(empty.coverage.every((row) => row.state === "idle"));
  assert.equal(buildOverviewSnapshot(seedEvidenceDatabase).reportId, null);
});

test("SSE reader handles split Chinese, CRLF, comments and multiple data lines; rejects truncation", async () => {
  const bytes = new TextEncoder().encode(': heartbeat\r\n\r\ndata: {"type":"delta",\r\ndata: "text":"中文流式简报"}\r\n\r\ndata: {"type":"complete"}\r\n\r\n');
  const events = [];
  await readServerEvents(new ReadableStream({ start(c) { for (let n = 0; n < bytes.length; n += 2) c.enqueue(bytes.slice(n, n + 2)); c.close(); } }), briefingEventSchema, (e) => events.push(e));
  assert.deepEqual(events, [{ type: "delta", text: "中文流式简报" }, { type: "complete" }]);
  const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"type":"complete"}\n')); c.close(); } });
  await assert.rejects(readServerEvents(body, briefingEventSchema, () => {}), /提前结束/);
});

test("unconfigured briefing returns explicit local context without contacting a provider", async () => {
  globalThis.__dashboardDatabase = fixture(); globalThis.__dashboardEnabled = false;
  const saved = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("No network allowed"); };
  try {
    const response = await POST(request());
    assert(response.headers.get("content-type").startsWith("text/event-stream"));
    const events = await consume(response);
    assert.deepEqual(events[0], { type: "meta", mode: "local" });
    assert(events.find((e) => e.type === "delta").text.includes("完成对照实验"));
    assert.equal(events.at(-1).type, "complete");
    const missing = await GET(new Request("http://localhost/api/project-overview?reportId=missing"));
    assert.equal(missing.status, 404);
    const invalid = await POST(new Request("http://localhost/api/project-overview/briefing", { method: "POST", body: "{}" }));
    assert.equal(invalid.status, 400);
  } finally { globalThis.fetch = saved; }
});

function upstream(mode) {
  const encoder = new TextEncoder();
  return async (url, init) => {
    assert.equal(String(url), "https://fixture.invalid/v1/chat/completions");
    const payload = JSON.parse(init.body);
    assert.equal(payload.stream, true); assert(payload.messages.some((message) => JSON.stringify(message).includes("完成对照实验")));
    return new Response(new ReadableStream({ start(c) {
      const send = (text, finish = null) => c.enqueue(encoder.encode("data: " + JSON.stringify({ id: "test", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta: { content: text }, finish_reason: finish }] }) + "\n\n"));
      send("已收到模型片段");
      if (mode === "success") { send("，这是项目简报。", "stop"); c.enqueue(encoder.encode("data: [DONE]\n\n")); c.close(); }
      if (mode === "failure") queueMicrotask(() => c.error(new Error("private-provider-error")));
      if (mode === "cancel") init.signal.addEventListener("abort", () => c.error(new DOMException("cancelled", "AbortError")));
    } }), { headers: { "Content-Type": "text/event-stream" } });
  };
}
test("actual AI SDK briefing streams text and cleanly replaces provider failure with local summary", async () => {
  const saved = globalThis.fetch;
  globalThis.__dashboardDatabase = fixture(); globalThis.__dashboardEnabled = true;
  try {
    globalThis.fetch = upstream("success");
    const success = await consume(await POST(request()));
    assert.equal(success[0].mode, "ai");
    assert.equal(success.filter((e) => e.type === "delta").map((e) => e.text).join(""), "已收到模型片段，这是项目简报。");
    assert.equal(success.at(-1).type, "complete");
    globalThis.fetch = upstream("failure");
    const fallback = await consume(await POST(request()));
    const replacement = fallback.find((e) => e.type === "replace");
    assert.equal(replacement.mode, "local"); assert(!replacement.text.includes("模型片段"));
    assert(!JSON.stringify(fallback).includes("private-provider-error"));
    assert.equal(fallback.at(-1).type, "complete");
  } finally { globalThis.fetch = saved; globalThis.__dashboardEnabled = false; }
});

test("cancelled briefing stops upstream and emits no completed status", async () => {
  const saved = globalThis.fetch;
  globalThis.__dashboardDatabase = fixture(); globalThis.__dashboardEnabled = true;
  const controller = new AbortController();
  try {
    globalThis.fetch = upstream("cancel");
    const events = [];
    const response = await POST(request(controller.signal));
    await readServerEvents(response.body, briefingEventSchema, (event) => { events.push(event); if (event.type === "delta") controller.abort(); });
    assert.equal(events.at(-1).type, "error"); assert(!events.some((e) => e.type === "complete"));
  } finally { globalThis.fetch = saved; globalThis.__dashboardEnabled = false; }
});

test("new workspace preserves history, excludes File from persistence, and restores interrupted activity honestly", async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  const { useWorkspaceStore } = await import("../src/modules/workspace/workspace.store.ts");
  const store = useWorkspaceStore.getState();
  const { emptyStudentProfile } = await import("../src/modules/workspace/types.ts");
  const profile = { ...emptyStudentProfile(), college: "测试学院", major: "计算机", competitionGoal: "完成原型" };
  store.newProject("首个项目", profile);
  const id = store.beginActivity({ kind: "search", title: "检索中", detail: "RAG", href: "/?view=overview" });
  store.handoffFile(new File(["fixture"], "test.docx"));
  store.newProject("第二个项目");
  assert.equal(useWorkspaceStore.getState().activities[0].id, id);
  assert.equal(useWorkspaceStore.getState().project.reportId, null);
  const serialized = storage.get("zhice:workspace:v1");
  assert(!serialized.includes("pendingUpload"));
  await useWorkspaceStore.persist.rehydrate();
  assert.equal(useWorkspaceStore.getState().activities[0].status, "warning");
  assert.equal(useWorkspaceStore.getState().project.name, "第二个项目");
  delete globalThis.localStorage;
});
