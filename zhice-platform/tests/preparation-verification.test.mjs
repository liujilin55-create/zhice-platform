import "./register-paths.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript,export async function getAiConfig(){return {enabled:false}}", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const { preparationSchema } = await import("../src/shared/contracts/preparation.ts");
const { bindingKey } = await import("../src/shared/contracts/competition-binding.ts");
const { confirmedBlocks } = await import("../src/shared/contracts/plan-document.ts");
const { demoProfile, questions, nextQuestion, topicValues, topics, diverseShortlist, competitionDisplayName, preparationContextKey, preparationNeedsReview } = await import("../src/modules/preparation/domain.ts");
const { localChapter, localReport } = await import("../src/modules/project-plan/server/helpers.ts");
const { emptySurveySession } = await import("../src/modules/project-plan/types.ts");
const { useProjectPlanStore: plans } = await import("../src/modules/project-plan/plan.store.ts");
const { verificationKey, matchingRecord, verificationRecordSchema, safeVerificationHref } = await import("../src/modules/verification/model.ts");
const { useVerificationStore: verifications } = await import("../src/modules/verification/store.ts");
const binding = { projectId: "preparation-test", competitionId: "computer-design", trackId: "computer-design-general", revision: "demo-only" };
const profile = demoProfile();
function preparation() {
  return preparationSchema.parse({ demo: true, topicId: topics[0].id, topicTitle: topics[0].title, topicBinding: bindingKey(binding), topicConfirmedAt: new Date().toISOString(), answers: Object.fromEntries(questions.map((item) => [item.id, item.example])) });
}
function survey(prep) {
  const session = emptySurveySession(); session.binding = binding;
  for (const [id, value] of Object.entries(topicValues(prep, profile))) session.slots[id] = { ...session.slots[id], value, status: "captured" };
  session.complete = true; session.currentSlot = null; return session;
}

test("demo seed contains only supplied school, major and cooperation facts", () => {
  assert.equal(profile.school, "福建农林大学"); assert.equal(profile.college, "材料工程学院"); assert.equal(profile.major, "木材科学与工程");
  assert.match(profile.resources.bases, /政和县.*科技小院/);
  assert.equal(profile.resources.enterprises, ""); assert.equal(profile.resources.equipment, ""); assert.equal(profile.mentors, ""); assert.equal(profile.grade, "其他");
  assert.deepEqual(preparationSchema.parse({}).answers, {}); assert.equal(nextQuestion(preparationSchema.parse({})).id, "industry");
});

test("assumed resources remain explicit in survey and material chapters never fabricate measurements", () => {
  const prep = preparation(); const values = topicValues(prep, profile); const session = survey(prep);
  assert.match(values.progress, /演示假设/); assert.match(values.progress, /未提供实测数据/); assert.match(values.technicalRoute, /拟议方案/);
  assert.equal(nextQuestion(prep), undefined);
  const chapter = localChapter(session, "technical-route", null, prep);
  assert.equal(chapter.title, "工艺路线与性能验证"); assert.match(chapter.content, /对照材料/); assert.match(chapter.content, /工艺参数与实测结果：____/);
  assert.doesNotMatch(chapter.content, /成本降低\s*\d|强度提升\s*\d|已合作.*公司/);
  const report = localReport(session, [{ title: "技术方案", text: "技术路线与验证" }]);
  assert.equal(report.completeness.find((item) => item.dimension === "当前进展与资源").status, "partial");
  assert.notEqual(report.alignment[0].coverage, "covered");
});

test("shortlist groups stages of the same competition and preserves provincial names", () => {
  const entries = ["中国互联网+大学生创新创业大赛", "福建省互联网+大学生创新创业大赛", "全国林业创新创业大赛", "全国林业创新创业大赛南部赛区", "挑战杯全国大学生创业计划竞赛"].map((name) => ({ name }));
  assert.deepEqual(diverseShortlist(entries).map((item) => item.name), [entries[0].name, entries[2].name, entries[4].name]);
  assert.match(competitionDisplayName(entries[1].name), /福建省.*省赛/);
});

test("material preparation suggestions never verify school recognition or official qualification", async () => {
  const { competitions } = await import("../src/modules/competition-recommendation/data.ts");
  const { matchCompetitions } = await import("../src/modules/competition-recommendation/matcher.ts");
  const fixture = { ...competitions[0], id: "pending-material", competitionId: "pending-material", name: "中国互联网+大学生创新创业大赛", majorTags: [], keywords: [], verificationStatus: "pending", campusRecognitionLevel: "A+", campusSourceUrl: null, campusCatalog: undefined };
  const [match] = matchCompetitions({ major: profile.major, grade: "不限", interests: [], levelPreference: "不限", timePreference: "不限", profile }, [fixture]);
  assert(match); assert.equal(match.category, "资料待完善"); assert.equal(match.verificationStatus, "pending");
  assert(match.reasons.some((reason) => reason.label === "专业与资源准备建议" && /非官方/.test(reason.detail)));
  assert(!match.reasons.some((reason) => reason.detail === "建议补齐 "));
  assert(match.reasons.some((reason) => reason.label === "校内认定" && /不计入/.test(reason.detail)));
});

test("source changes invalidate prepared material without losing edited chapters or versions", () => {
  const prep = preparation(); const key = preparationContextKey(prep, profile);
  plans.getState().activateProject(binding.projectId, bindingKey(binding)); plans.getState().reset();
  plans.getState().setDocumentContext(prep.topicTitle, binding, [], [], key);
  const chapter = { binding, id: "technical-route", title: "工艺路线", content: "【已生成】拟设置对照材料并记录测试条件。", status: "confirmed", mode: "local", sourceIds: [], evidenceIds: [], updatedAt: new Date().toISOString() };
  plans.getState().upsertChapter(chapter, "user");
  const original = plans.getState().document;
  assert(confirmedBlocks(original).length > 0); assert.equal(preparationNeedsReview(original, prep, profile), false);
  const changed = { ...prep, answers: { ...prep.answers, materials: "原料供应仍需协调，本轮先设计验证方案。" } };
  assert.equal(preparationNeedsReview(original, changed, profile), true);
  plans.getState().setDocumentContext(changed.topicTitle, binding, [], [], preparationContextKey(changed, profile));
  assert.equal(preparationNeedsReview(plans.getState().document, changed, profile), true, "loading a new context must not silently approve old materials");
  plans.getState().acceptPreparation(preparationContextKey(changed, profile), survey(changed));
  const updated = plans.getState().document;
  assert(updated.version > original.version); assert.equal(updated.chapters[0].userContent, original.chapters[0].userContent);
  assert.equal(confirmedBlocks(updated).length, 0); assert(plans.getState().versions.some((item) => item.version === original.version));
  assert.equal(preparationNeedsReview(updated, changed, profile), false);
  assert.equal(preparationNeedsReview(updated, { ...changed, topicConfirmedAt: null }, profile), true);
  assert.equal(preparationNeedsReview(updated, { ...changed, topicBinding: "different-selection" }, profile), true);
});

test("reference and profile changes also invalidate material provenance, answer key ordering does not", () => {
  const prep = preparation(); const key = preparationContextKey(prep, profile);
  assert.equal(key, preparationContextKey({ ...prep, answers: Object.fromEntries(Object.entries(prep.answers).reverse()) }, profile));
  assert.notEqual(key, preparationContextKey({ ...prep, research: [{ title: "测试来源", url: "https://example.com/paper", excerpt: "适配性尚需核对", kind: "paper", source: "test" }] }, profile));
  assert.notEqual(key, preparationContextKey(prep, { ...profile, major: "林学" }));
});

test("verification requires attribution and evidence; records are isolated by content and project", () => {
  const task = { id: "resource", scope: "project-a", subject: "原料可获得性", fingerprint: "version-a", source: "", href: "/?view=verification" };
  assert.equal(verificationRecordSchema.safeParse({ ...task, value: "通过", reviewer: "", source: "", note: "", confirmedAt: new Date().toISOString() }).success, false);
  const record = verificationRecordSchema.parse({ ...task, outcome: "pending", value: "暂缺来源", reviewer: "功能测试", source: "本地测试记录", note: "测试留痕功能，不证明资源已经落实。", confirmedAt: new Date().toISOString() });
  verifications.getState().register(task); verifications.getState().confirm(record);
  assert.equal(matchingRecord(task, verifications.getState().records)?.outcome, "pending");
  assert.equal(matchingRecord({ ...task, scope: "project-b" }, verifications.getState().records), undefined);
  const changed = { ...task, fingerprint: "version-b", subject: "原料可获得性更新" };
  assert.equal(matchingRecord(changed, verifications.getState().records), undefined);
  verifications.getState().register(changed);
  assert.equal(verifications.getState().tasks[verificationKey(task)], undefined); assert(verifications.getState().records[verificationKey(task)]);
  assert(storage.get("zhice:verifications:v1").includes("本地测试记录"));
});

test("verification receipts survive rehydration and can be revoked", async () => {
  const saved = storage.get("zhice:verifications:v1");
  verifications.setState({ records: {}, tasks: {} }); storage.set("zhice:verifications:v1", saved);
  await verifications.persist.rehydrate();
  const key = Object.keys(verifications.getState().records)[0]; assert(key);
  verifications.getState().revoke(key); assert.equal(verifications.getState().records[key], undefined);
});

test("quick confirmation records viewed state without promoting official verification", () => {
  const task = { id: "quick-resource", scope: "project-quick", subject: "设备可用性", fingerprint: "quick-v1", source: "", href: "/?view=verification" };
  verifications.getState().register(task); verifications.getState().quickConfirm(task);
  const record = matchingRecord(task, verifications.getState().records);
  assert(record); assert.equal(record.outcome, "pending"); assert.equal(record.value, "已查看，暂时无法确认"); assert.equal(record.reviewer, "当前用户");
});

test("verification links reject executable and disguised external relative URLs", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,test", "//evil.example", "/\\evil.example", "https://example.com\nunsafe"]) assert.equal(safeVerificationHref(value), "/?view=verification");
  assert.equal(safeVerificationHref("https://example.com/rules"), "https://example.com/rules");
  assert.equal(safeVerificationHref("/?view=requirements"), "/?view=requirements");
});

test("failed material paper search returns no irrelevant software demo papers", async () => {
  const { searchAcademicPapers } = await import("../src/modules/competition-requirements/analyzer.ts");
  const originalFetch = globalThis.fetch; let query = "";
  globalThis.fetch = async (url) => { query = new URL(url).searchParams.get("query"); return new Response("rate limited", { status: 429 }); };
  try {
    assert.deepEqual(await searchAcademicPapers(["竹纤维", "缓冲包装"], "竹材料方案"), []); assert.match(query, /bamboo/);
    const { POST } = await import("../src/app/api/papers/route.ts");
    const response = await POST(new Request("http://localhost/api/papers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "竹纤维 模塑缓冲包装 压缩性能" }) }));
    assert.deepEqual(await response.json(), { data: [], cached: false });
  }
  finally { globalThis.fetch = originalFetch; }
});

test("unconfigured recommendation and existing task assistant report unavailable honestly", async () => {
  const { POST } = await import("../src/app/api/assistant/route.ts");
  for (const body of [{ message: "比较候选", recommendationContext: { profile, preparation: preparation(), candidates: [{ id: "computer-design" }] } }, { featureId: "taskOrchestration", message: "分析现有任务" }]) {
    const response = await POST(new Request("http://localhost/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
    assert.equal(response.status, 503); assert.match((await response.json()).error, /未配置/);
  }
});
