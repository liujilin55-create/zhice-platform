import "./register-paths.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/shared/api-client") return { url: new URL("../src/shared/api-client/index.ts", import.meta.url).href, shortCircuit: true };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      try { return nextResolve(specifier + ".ts", context); } catch { /* Standard resolution follows. */ }
    }
    return nextResolve(specifier, context);
  },
});
const { runAnalysis } = await import("../src/modules/competition-requirements/analysis-pipeline.ts");
const { normalizePartialAnalysis, emptyRequirements, emptyReport } = await import("../src/modules/competition-requirements/partial-analysis.ts");
const { analysisReducer, initialAnalysisState } = await import("../src/modules/competition-requirements/analysis-state.ts");
const { analysisEventSchema } = await import("../src/modules/competition-requirements/stream-types.ts");
const { readJsonLines } = await import("../src/shared/api-client/index.ts");
const { requestAnalysis } = await import("../src/modules/competition-requirements/services/analysis.ts");

const requirements = { ...emptyRequirements(), title: "真实比赛", summary: "技术实现需可验证", keywords: ["算法"] };
const report = { ...emptyReport(), overview: "模型建议", topicDirections: [{ title: "算法工具", reason: "可验证", expectedOutput: "可演示产品" }], technicalRoute: ["建立基线"], scoringSuggestions: [{ criterion: "技术实现", action: "对照实验" }], plan: [{ phase: "第一阶段", days: "1-2 天", tasks: ["核对规则"] }] };
const demo = { ...emptyRequirements(), title: "演示要求", summary: "模板内容" };
const demoReport = { ...emptyReport(), overview: "演示指导" };
const file = new File(["fixture"], "test.docx");
const dependencies = (overrides = {}) => ({
  parse: async () => ({ text: "技术实现需可验证", parser: "测试解析", isImage: false, warnings: [] }),
  ocr: async () => "", keywords: () => ["算法"], search: async () => [],
  demoRequirements: () => ({ ...demo }), demoReport: () => ({ ...demoReport }),
  model: async function* () { yield { type: "complete", value: { requirements, report } }; },
  capture: async () => ({ reportId: "report-test", evidenceIds: [] }), ...overrides,
});
const run = (deps, events = [], signal = new AbortController().signal) => runAnalysis(file, "计算机", "", (e) => { analysisEventSchema.parse(e); events.push(e); }, signal, deps);

test("partial snapshots keep valid items and omit incomplete objects", () => {
  const normalized = normalizePartialAnalysis({ requirements: { title: "正在生成", timeline: [{ milestone: "初赛" }] }, report: { topicDirections: [report.topicDirections[0], { title: "半个对象" }], technicalRoute: ["第一步", 22] } });
  assert.equal(normalized.requirements.title, "正在生成");
  assert.deepEqual(normalized.requirements.timeline, []);
  assert.equal(normalized.report.topicDirections.length, 1);
  assert.deepEqual(normalized.report.technicalRoute, ["第一步"]);
  assert.deepEqual(normalizePartialAnalysis(null), {});
});

test("papers and drafts arrive before completion; model phases follow actual fields", async () => {
  const events = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let reached;
  const ready = new Promise((resolve) => { reached = resolve; });
  const task = run(dependencies({ model: async function* () {
    yield { type: "partial", value: { requirements, report: { overview: "已生成摘要", topicDirections: report.topicDirections } } };
    reached(); await gate;
    yield { type: "partial", value: { requirements, report } };
    yield { type: "complete", value: { requirements, report } };
  } }), events);
  await ready;
  assert(events.findIndex((e) => e.type === "papers") < events.findIndex((e) => e.type === "draft"));
  assert(events.some((e) => e.type === "draft" && e.report.overview === "已生成摘要"));
  assert(!events.some((e) => e.type === "complete"));
  assert(!events.some((e) => e.type === "step" && e.step === "route"));
  release();
  const result = await task;
  assert.equal(result.mode, "ai");
  assert.equal(events.at(-1).type, "complete");
  assert(events.findIndex((e) => e.type === "step" && e.step === "review") < events.findIndex((e) => e.type === "step" && e.step === "saving"));
});

test("out-of-order provider output never marks absent sections generated", async () => {
  const events = [];
  await run(dependencies({ model: async function* () {
    yield { type: "partial", value: { report: { plan: report.plan } } };
    assert(!events.some((e) => e.type === "step" && ["topics", "route", "scoring"].includes(e.step) && e.status === "done"));
    yield { type: "complete", value: { requirements, report } };
  } }), events);
});

test("no model, failed model and invalid final all clearly replace drafts with demo", async () => {
  for (const behavior of ["disabled", "failed", "invalid"]) {
    const events = [];
    const result = await run(dependencies({ model: async function* () {
      if (behavior === "disabled") return;
      yield { type: "partial", value: { requirements, report } };
      if (behavior === "invalid") yield { type: "complete", value: { requirements, report: {} } };
      else throw new Error("provider failure");
    } }), events);
    assert.equal(result.mode, "demo");
    assert.equal(result.requirements.title, demo.title);
    const replacement = events.filter((e) => e.type === "draft").at(-1);
    assert.equal(replacement.reset, true);
    assert.equal(replacement.report.overview, demoReport.overview);
    assert(result.warnings.length > 0);
  }
});

test("cancellation stops later work and persistence; persistence failure keeps a readable report", async () => {
  const controller = new AbortController();
  let captured = false;
  await assert.rejects(run(dependencies({ search: async () => { controller.abort(); return []; }, capture: async () => { captured = true; } }), [], controller.signal), { name: "AbortError" });
  assert.equal(captured, false);
  const result = await run(dependencies({ capture: async () => { throw new Error("disk error"); } }));
  assert.equal(result.report.overview, report.overview);
  assert.equal(result.traceability, undefined);
  assert(result.warnings.some((warning) => warning.includes("保存失败")));
});

test("NDJSON handles split Unicode, batched lines, trailing line and malformed events", async () => {
  const events = [{ type: "keywords", keywords: ["技术实现", "AI"] }, { type: "heartbeat" }];
  const bytes = new TextEncoder().encode(events.map((e) => JSON.stringify(e)).join("\n"));
  const decoded = [];
  await readJsonLines(new ReadableStream({ start(c) { for (let n = 0; n < bytes.length; n += 2) c.enqueue(bytes.slice(n, n + 2)); c.close(); } }), analysisEventSchema, (e) => decoded.push(e));
  assert.deepEqual(decoded, events);
  const bad = (value) => new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(value)); c.close(); } });
  await assert.rejects(readJsonLines(bad('{"type":"keywords"'), analysisEventSchema, () => {}), /不完整/);
  await assert.rejects(readJsonLines(bad('{"type":"keywords","keywords":12}'), analysisEventSchema, () => {}), /格式异常/);
});

test("client rejects clean EOF without completion and accepts legacy JSON", async () => {
  const savedFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('{"type":"keywords","keywords":["AI"]}\n');
    const received = [];
    await assert.rejects(requestAnalysis(file, "", "", new AbortController().signal, (e) => received.push(e)), /尚未完成/);
    assert.equal(received.length, 1);
    const result = await run(dependencies());
    globalThis.fetch = async () => Response.json(result);
    await requestAnalysis(file, "", "", new AbortController().signal, (e) => assert.equal(e.type, "complete"));
  } finally { globalThis.fetch = savedFetch; }
});

test("UI reducer preserves content on stop and replaces failed model snapshots", () => {
  let state = analysisReducer(initialAnalysisState(), { type: "start", now: 1 });
  state = analysisReducer(state, { type: "event", now: 2, event: { type: "keywords", keywords: ["AI"] } });
  state = analysisReducer(state, { type: "event", now: 3, event: { type: "draft", requirements, report, mode: "ai" } });
  const beforeHeartbeat = state;
  assert.equal(analysisReducer(state, { type: "event", now: 4, event: { type: "heartbeat" } }), beforeHeartbeat);
  state = analysisReducer(state, { type: "stop", now: 5, error: "中断" });
  assert.deepEqual(state.preview.keywords, ["AI"]);
  assert.equal(state.preview.report.overview, report.overview);
  state = analysisReducer(state, { type: "event", now: 6, event: { type: "draft", requirements: demo, report: demoReport, mode: "demo", reset: true } });
  assert.deepEqual(state.preview.report.technicalRoute, []);
  assert.equal(analysisReducer(state, { type: "start", now: 7 }).preview.report, undefined);
});
