import "./register-paths.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import JSZip from "jszip";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript,export async function getAiConfig(){return globalThis.__planPptConfig || {enabled:false}}", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const originalCwd = process.cwd(); const directory = await mkdtemp(path.join(tmpdir(), "zhice-plan-ppt-")); process.chdir(directory);
after(async () => { process.chdir(originalCwd); await rm(directory, { recursive: true, force: true }); });
const { planDocumentSchema, parseContentBlocks, confirmedBlocks } = await import("../src/shared/contracts/plan-document.ts");
const { createPlanOutline, checkPlanOutline, traceOutline, PPT_TOPICS } = await import("../src/modules/ppt-generator/plan-outline.ts");
const { savePlanDocument, readPlanDocument } = await import("../src/modules/project-plan/server/document-repository.ts");
const { POST, GET } = await import("../src/app/api/ppt/route.ts");
const { PUT } = await import("../src/app/api/project-plan/document/route.ts");
const binding = { projectId: "plan-test-a", competitionId: "computer-design", trackId: "computer-design-general", revision: "plan-revision" };
const options = { pages: 12, durationMinutes: 8, focus: "evidence" };
const now = new Date().toISOString();
function makeDocument() {
  const chapters = [
    ["project-intro", "项目介绍", "用户痛点是比赛资料分散。\n核心方案是可溯源的备赛平台。\n创新点是所有建议关联原文。\n计划分为需求、开发和验证阶段。"],
    ["product-design", "用户与产品", "目标用户为计算机专业大学生。\n产品方案提供比赛推荐和计划书编辑。"],
    ["technical-route", "技术路线", "技术路线采用 React 和检索模块。\n验证结果：样本共 30 人，任务完成率为 80%。\n【AI推断，请核验】预估满意度达到 99%。\n【建议补充】市场规模为 9999 万元。"],
    ["finance", "财务资源", "资源预算为 500 元，现有计算机实验室。"],
    ["team", "团队", "团队由前端、后端与测试成员分工。"],
    ["risk-response", "风险", "风险是接口不稳定，应对措施为离线缓存。"],
    ["conclusion", "总结", "项目价值是降低学生整理竞赛材料的成本。"],
  ].map(([id, title, text]) => ({ id, title, aiContent: text, userContent: null, confirmed: true, updatedAt: now, blocks: parseContentBlocks(text, "user", ["test-evidence"], []).map((block) => ({ ...block, confirmed: block.marker === "generated" })) }));
  chapters.push({ id: "unconfirmed", title: "未确认", aiContent: "尚未确认的收入为 123456 元。", userContent: null, confirmed: false, updatedAt: now, blocks: parseContentBlocks("尚未确认的收入为 123456 元。", "ai", [], []) });
  return planDocumentSchema.parse({ documentId: "document-a", binding, projectName: "竞赛研究工作台", title: "竞赛研究工作台 · 计划书", chapters, version: 1, confirmed: false, updatedAt: now, sources: [], scoringRequirements: [] });
}
const request = (body) => POST(new Request("http://localhost/api/ppt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
let saved; let outline;

test("unified document preserves AI/user content, explicit inference gates, version restore and project isolation", async () => {
  const storage = new Map(); globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
  const { useProjectPlanStore: plans } = await import("../src/modules/project-plan/plan.store.ts");
  plans.getState().activateProject(binding.projectId, "scope-a"); plans.getState().setDocumentContext("测试计划", binding, [], []);
  const text = "【已生成】测试样本为 30 人。\n【AI推断，请核验】预测收入为 900 元。\n【建议补充】市场规模待填。";
  const chapter = { binding, id: "technical-route", title: "技术路线", content: text, status: "draft", sourceIds: [], evidenceIds: ["e1"], updatedAt: now };
  plans.getState().upsertChapter(chapter); plans.getState().upsertChapter({ ...chapter, status: "confirmed" }, "user");
  const before = plans.getState().document;
  assert.equal(before.chapters[0].aiContent, text); assert.equal(confirmedBlocks(before).length, 1); assert.equal(before.chapters[0].blocks[0].origin, "ai");
  plans.getState().saveVersion();
  plans.getState().upsertChapter({ ...chapter, content: text.replace("30", "40"), status: "confirmed" }, "user", true);
  assert.equal(confirmedBlocks(plans.getState().document).length, 2); assert.equal(plans.getState().document.chapters[0].blocks[0].origin, "user"); assert.equal(plans.getState().document.chapters[0].aiContent, text);
  const editedVersion = plans.getState().document.version; plans.getState().restoreVersion(before.version);
  assert(plans.getState().document.version > editedVersion); assert(plans.getState().chapters["technical-route"].content.includes("30 人"));
  plans.getState().activateProject("plan-test-b", "scope-b"); assert.equal(plans.getState().document, null);
  plans.getState().activateProject(binding.projectId, "scope-a"); assert(plans.getState().document.chapters[0].aiContent.includes("30 人"));
  await plans.persist.rehydrate(); plans.getState().activateProject(binding.projectId, "scope-a"); assert(plans.getState().document); delete globalThis.localStorage;
});
test("document API saves an exact bound version, is idempotent and rejects inconsistent block confirmations", async () => {
  const document = makeDocument();
  const result = await PUT(new Request("http://localhost/api/project-plan/document", { method: "PUT", body: JSON.stringify(document) })); assert.equal(result.status, 200); saved = await result.json();
  assert.equal((await savePlanDocument(document)).reference.contentHash, saved.reference.contentHash);
  const invalid = structuredClone(document); invalid.chapters[0].blocks[0].text = "伪造的正文";
  await assert.rejects(savePlanDocument(invalid), /不一致/);
  await assert.rejects(readPlanDocument({ ...binding, projectId: "other" }, saved.reference), /没有保存/);
});
test("plan outline covers all required topics at every page range and only copies confirmed facts", () => {
  const document = makeDocument();
  for (const pages of [8, 9, 12, 15]) {
    const result = createPlanOutline(document, saved.reference, { ...options, pages }); assert.equal(result.slides.length, pages);
    const topics = result.slides.flatMap((slide) => slide.topicIds); for (const topic of PPT_TOPICS) assert(topics.includes(topic.id));
    assert(!JSON.stringify(result).includes("9999")); assert(!JSON.stringify(result).includes("123456")); assert(!JSON.stringify(result).includes("99%"));
    assert.equal(checkPlanOutline(result, document).filter((check) => check.severity === "error").length, 0);
  }
});
test("projectId plan service generates without DOCX and rejects another project or missing confirmations", async () => {
  const response = await request({ action: "analyzePlan", projectId: binding.projectId, reference: saved.reference, options }); assert.equal(response.status, 200);
  const result = await response.json(); outline = result.outline; assert.equal(result.mode, "local"); assert.equal(outline.slides.length, 12); assert(outline.slides.some((slide) => slide.bullets.some((text) => text.includes("30 人"))));
  assert.equal((await request({ action: "analyzePlan", projectId: "other-project", reference: saved.reference, options })).status, 400);
  const unconfirmed = makeDocument(); unconfirmed.binding = { ...binding, projectId: "empty-plan" }; unconfirmed.documentId = "empty"; for (const chapter of unconfirmed.chapters) { chapter.confirmed = false; for (const block of chapter.blocks) block.confirmed = false; }
  const empty = await savePlanDocument(unconfirmed); assert.equal((await request({ action: "analyzePlan", projectId: "empty-plan", reference: empty.reference, options })).status, 400);
});
test("consistency rejects new numbers, unsupported conclusions, notes, blank pages and excess capacity", () => {
  const document = makeDocument();
  for (const patch of [{ bullets: ["验证结果：样本共 90 人，任务完成率为 80%。"] }, { bullets: ["已经获得全国冠军。"] }, { speakerNotes: "已经获得全国冠军。" }, { bullets: [""] }, { bullets: ["长".repeat(180)] }]) {
    const changed = structuredClone(outline); Object.assign(changed.slides[1], patch); assert(checkPlanOutline(changed, document).some((check) => check.severity === "error"));
  }
  const pending = structuredClone(outline); pending.slides[1].bullets = ["【待核验】预计收入为 999 元。"];
  assert(!checkPlanOutline(pending, document).some((check) => check.severity === "error"));
  const renamed = { ...outline, title: "其他项目" }; assert(checkPlanOutline(renamed, document).some((check) => check.code === "project-name"));
});
test("provenance is reconstructed rather than trusting client evidence IDs; rubric gaps remain warnings", () => {
  const changed = structuredClone(outline); changed.slides[1].claims = [{ text: "伪造", origin: "user", confirmed: true, blockIds: ["fake"], chapterIds: ["fake"], evidenceIds: ["fake"] }];
  const traced = traceOutline(changed, makeDocument()); assert(!JSON.stringify(traced.slides[1].claims).includes('"fake"')); assert(traced.slides.some((slide) => slide.evidenceIds.includes("test-evidence")));
  const document = makeDocument(); document.scoringRequirements.push({ id: "score", title: "测试评分", text: "测试原句", sourceId: "not-used", sourceUrl: null, verificationStatus: "verified", origin: "official" });
  assert(checkPlanOutline(outline, document).some((check) => check.code === "rubric-gap"));
});
test("an actual AI SDK selection can only choose known confirmed block IDs, never introduce new facts", async () => {
  const original = globalThis.fetch; const prompts = [];
  globalThis.__planPptConfig = { enabled: true, apiKey: "fixture", baseUrl: "https://fixture.invalid/v1", model: "fixture", systemPrompt: "测试选择", temperature: 0, maxTokens: 1800 };
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://fixture.invalid/v1/chat/completions"); prompts.push(init.body);
    return Response.json({ id: "fixture", object: "chat.completion", created: 1, model: "fixture", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify({ selections: [{ topicId: "validation", blockIds: ["unknown-9999"] }] }) }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  };
  try {
    const response = await (await request({ action: "analyzePlan", projectId: binding.projectId, reference: saved.reference, options })).json(); assert.equal(response.mode, "ai");
    assert(!prompts.join("").includes("123456")); assert(!prompts.join("").includes("9999 万元")); assert(!JSON.stringify(response.outline).includes("unknown-9999"));
    assert.equal(response.checks.filter((check) => check.severity === "error").length, 0);
  } finally { globalThis.fetch = original; globalThis.__planPptConfig = null; }
});
test("Human Gate is enforced by the API, including compatibility uploads", async () => {
  assert.equal((await request({ action: "render", projectId: binding.projectId, outline, template: "zhice-dark" })).status, 409);
  const bad = structuredClone(outline); bad.slides[1].bullets = ["项目收入为 998877 元。"];
  assert.equal((await request({ action: "render", projectId: binding.projectId, outline: bad, template: "zhice-dark", humanConfirmed: true })).status, 409);
});

test("model timeout falls back to confirmed plan text while user cancellation still aborts", async () => {
  const { generatePlanPpt } = await import("../src/modules/ppt-generator/server/plan-service.ts");
  const original = globalThis.fetch;
  globalThis.__planPptConfig = { enabled: true, apiKey: "fixture", baseUrl: "https://fixture.invalid/v1", model: "fixture", systemPrompt: "测试选择", temperature: 0, maxTokens: 1800 };
  globalThis.fetch = async () => { throw new DOMException("model deadline", "TimeoutError"); };
  try {
    const result = await generatePlanPpt(binding.projectId, saved.reference, options, new AbortController().signal);
    assert.equal(result.mode, "local"); assert(result.warnings.some((warning) => /模型策划暂不可用/.test(warning))); assert.equal(result.outline.slides.length, 12);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(generatePlanPpt(binding.projectId, saved.reference, options, controller.signal), { name: "AbortError" });
  } finally { globalThis.fetch = original; globalThis.__planPptConfig = null; }
});
test("a document snapshot cannot promote unverified or outdated sources into official PPT scoring facts", async () => {
  const document = makeDocument(); document.documentId = "snapshot-source-document"; document.binding = { ...binding, projectId: "snapshot-source-project" };
  document.sources = [{ sourceId: "not-in-current-cache", competitionId: binding.competitionId, trackId: binding.trackId, title: "旧快照来源", kind: "official", url: "https://example.invalid/rules", text: "旧快照中声称的评分原文。", contentHash: "old-hash", verificationStatus: "verified", lastVerified: now, fetchedAt: now, warnings: [] }];
  document.scoringRequirements = [{ id: "old-score", title: "旧评分", text: "旧快照中声称的评分原文。", sourceId: "not-in-current-cache", sourceUrl: "https://example.invalid/rules", verificationStatus: "verified", origin: "official" }];
  const stored = await savePlanDocument(document);
  const result = await (await request({ action: "analyzePlan", projectId: document.binding.projectId, reference: stored.reference, options })).json();
  assert(result.checks.some((check) => check.code === "unverified-source")); assert(result.checks.some((check) => check.code === "no-rubric"));
});
test("real PPTX contains editable native text and speaker notes with project, version and evidence", async () => {
  const response = await request({ action: "render", projectId: binding.projectId, outline, template: "zhice-dark", humanConfirmed: true }); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.history.planSource.version, saved.reference.version);
  const download = await GET(new Request("http://localhost" + result.history.downloadUrl)); const zip = await JSZip.loadAsync(await download.arrayBuffer());
  const slides = await Promise.all(Object.keys(zip.files).filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file)).map((file) => zip.file(file).async("string")));
  const notes = await Promise.all(Object.keys(zip.files).filter((file) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(file)).map((file) => zip.file(file).async("string")));
  assert.equal(slides.length, 12); assert(slides.join("").includes("30 人")); assert(slides.every((slide) => slide.includes("<p:sp>"))); assert(notes.join("").includes("test-evidence")); assert(notes.join("").includes(binding.projectId)); assert(!slides.join("").includes("123456"));
});
test("editing a document invalidates old outlines server-side and regeneration uses new values", async () => {
  const document = structuredClone(saved.data); document.version++; const chapter = document.chapters.find((item) => item.id === "technical-route"); chapter.userContent = chapter.aiContent.replace("30 人", "40 人"); chapter.blocks = parseContentBlocks(chapter.userContent, "user", ["test-evidence"], []).map((block) => ({ ...block, confirmed: block.marker === "generated" }));
  const updated = await savePlanDocument(document);
  assert.equal((await request({ action: "render", projectId: binding.projectId, outline, template: "zhice-dark", humanConfirmed: true })).status, 409);
  const next = await (await request({ action: "analyzePlan", projectId: binding.projectId, reference: updated.reference, options })).json(); assert(JSON.stringify(next.outline).includes("40 人")); assert(!JSON.stringify(next.outline).includes("30 人"));
  await assert.rejects(savePlanDocument({ ...document, title: "迟到更新", version: 1 }), /更新版本/);
});
test("external DOCX multipart remains available without a webpage plan", async () => {
  const zip = new JSZip(); zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'); zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>外部材料标题</w:t></w:r></w:p><w:p><w:r><w:t>用户上传的兼容材料包含项目背景、技术方案与执行计划，需要继续人工确认。</w:t></w:r></w:p></w:body></w:document>');
  const body = new FormData(); body.append("projectId", "external-project"); body.append("file", new Blob([await zip.generateAsync({ type: "uint8array" })]), "fixture.docx");
  const response = await POST(new Request("http://localhost/api/ppt", { method: "POST", body })); assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.document.fileName, "fixture.docx"); assert(result.outline.slides.length >= 8); assert.equal(result.outline.planSource, undefined);
});
