import "./register-paths.mjs";
import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
import { registerHooks } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

globalThis.referenceTestConfig = { enabled: true, provider: "custom", apiKey: "unit-test-secret", baseUrl: "https://model.example.test/v1", model: "configured-reference-model", temperature: 0.4, maxTokens: 3000, systemPrompt: "后台自定义写作要求" };
globalThis.referenceFeatures = [];
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript,export async function getAiConfig(feature){globalThis.referenceFeatures.push(feature);return globalThis.referenceTestConfig;}", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const originalCwd = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), "zhice-reference-api-"));
process.chdir(directory);
const originalFetch = globalThis.fetch;
after(async () => { globalThis.fetch = originalFetch; process.chdir(originalCwd); await rm(directory, { recursive: true, force: true }); });

const { POST } = await import("../src/app/api/project-plan/route.ts");
const { chapterReferencePrompt } = await import("../src/modules/project-plan/server/chapter-reference.ts");
const { emptySurveySession, chapterReferenceRequestSchema, PLAN_CHAPTERS, preparationChapters, planContextSchema } = await import("../src/modules/project-plan/types.ts");
const { emptyStudentProfile } = await import("../src/modules/workspace/types.ts");
const { preparationSchema } = await import("../src/shared/contracts/preparation.ts");
const { competitions } = await import("../src/modules/competition-recommendation/data.ts");
const { bindingKey } = await import("../src/shared/contracts/competition-binding.ts");
const { topics, topicValues } = await import("../src/modules/preparation/domain.ts");
const competition = competitions.find((item) => item.tracks.some((track) => track.name === "红旅赛道"));
const now = "2026-11-17T10:00:00.000Z";
let requests = [];
let responseKind = "success";
const answer = "## 场景与目标\n【已生成】当前项目拟研究竹纤维育苗容器，面向合作苗圃的湿态使用场景。\n【AI推断，请核验】可先比较容器浇水后的结构稳定性。\n【建议补充】苗圃访谈、实际设备和测试数据：____。";

beforeEach(() => {
  requests = []; responseKind = "success";
  globalThis.referenceTestConfig.enabled = true;
  globalThis.referenceTestConfig.apiKey = "unit-test-secret";
  globalThis.referenceFeatures = [];
  globalThis.fetch = async (url, init) => {
    const request = { url: String(url), body: JSON.parse(init.body), signal: init.signal };
    requests.push(request);
    assert.equal(request.url, "https://model.example.test/v1/chat/completions");
    if (responseKind === "auth-error") return Response.json({ error: { message: "unit-test-secret rejected", type: "invalid_api_key" } }, { status: 401 });
    if (responseKind === "cancel") return new Response(new ReadableStream({ start(controller) {
      init.signal.addEventListener("abort", () => controller.error(new DOMException("Stopped", "AbortError")), { once: true });
    } }), { headers: { "content-type": "text/event-stream" } });
    const chunk = (content, finish_reason) => `data: ${JSON.stringify({ id: "test-reference", object: "chat.completion.chunk", created: 1, model: "configured-reference-model", choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason }] })}\n\n`;
    const content = responseKind === "empty" ? "" : answer;
    const events = chunk(content.slice(0, 30), null) + chunk(content.slice(30), responseKind === "length" ? "length" : responseKind === "interrupted" ? null : "stop");
    return new Response(events + (responseKind === "interrupted" ? "" : "data: [DONE]\n\n"), { headers: { "content-type": "text/event-stream" } });
  };
});

function input(chapterId = "executive-summary") {
  const binding = { projectId: "reference-project", competitionId: competition.id, trackId: competition.tracks.find((track) => track.name === "红旅赛道").trackId, revision: "current-selection" };
  const preparation = preparationSchema.parse({ topicId: "bamboo-nursery", topicTitle: "竹纤维育苗容器的结构与湿态性能研究", topicBinding: bindingKey(binding), answers: { equipment: "只有基础加工条件，湿态测试条件待联系" }, research: [{ title: "测试论文：育苗容器湿态测试", url: "https://example.org/nursery", excerpt: "仅有摘要记录，需要核对全文的实验条件。", kind: "paper", source: "测试资料" }] });
  return chapterReferenceRequestSchema.parse({ action: "chapter_reference", chapterId, projectName: "当前育苗项目", workspace: { binding, preparation, studentProfile: { ...emptyStudentProfile(), school: "测试大学", college: "材料学院", major: "木材科学与工程", competitionGoal: "完成育苗容器验证方案" }, selectionConfirmedAt: now, reportId: null, intent: "draft" }, session: emptySurveySession(), instructions: "侧重湿态稳定性，先提供可执行验证方案。", currentContent: "原有正文保留，尚无测试结论。" });
}
const request = (body, signal) => POST(new Request("http://localhost/api/project-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal }));
async function eventsOf(response) {
  assert.equal(response.status, 200);
  return (await response.text()).split("\n\n").filter((part) => part.startsWith("data: ")).map((part) => JSON.parse(part.slice(6)));
}
const userPrompt = (request) => JSON.parse(request.body.messages.find((message) => message.role === "user").content);

test("real API route uses configured backend model and streams a personalized reference without saving a document", async () => {
  const body = input(); const events = await eventsOf(await request(body));
  assert.equal(requests.length, 2);
  assert(globalThis.referenceFeatures.every((feature) => feature === "projectPlan"));
  for (const call of requests) {
    assert.equal(call.body.model, "configured-reference-model");
    assert.equal(call.body.temperature, 0.4);
    assert.equal(call.body.stream, true);
    assert.match(call.body.messages[0].content, /后台自定义写作要求/);
  }
  const outlinePrompt = userPrompt(requests[0]);
  assert.equal(outlinePrompt.task, "personalized_chapter_outline");
  const prompt = userPrompt(requests[1]);
  assert.equal(prompt.currentSelection.trackName, "红旅赛道");
  assert.equal(prompt.currentSelection.direction, body.workspace.preparation.topicTitle);
  assert.equal(prompt.currentSelection.projectName, "当前育苗项目");
  assert.equal(prompt.studentProfile.major, "木材科学与工程");
  assert.equal(prompt.writingPreferences, body.instructions);
  assert.equal(prompt.existingChapterForRevision, body.currentContent);
  assert.match(JSON.stringify(prompt.selectedReferences), /example.org\/nursery/);
  assert.match(JSON.stringify(prompt.currentProjectAnswers), /湿态测试条件待联系/);
  assert.deepEqual(prompt.verifiedOfficialCriteria, []);
  const generated = events.find((event) => event.type === "chapter").chapter;
  assert.equal(generated.mode, "ai"); assert.equal(generated.status, "draft");
  assert.deepEqual(generated.binding, body.workspace.binding);
  assert.match(generated.content, /湿态使用场景/);
  assert(events.some((event) => event.type === "chapter_delta"));
  assert(events.some((event) => event.type === "reference_outline_delta"));
  assert(events.some((event) => event.type === "reference_outline"));
  assert.deepEqual(events.filter((event) => event.type === "reference_stage").map((event) => `${event.stage}:${event.status}`), ["context:running", "context:done", "outline:running", "outline:done", "writing:running", "writing:done", "review:running", "review:done"]);
  assert.equal(events.at(-1).type, "complete");
  assert(!events.some((event) => event.mode === "local" || event.type === "replace"));
});

test("outline is visible before expansion and stays available if the body model call fails", async () => {
  const defaultFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (requests.length === 1) responseKind = "auth-error";
    return defaultFetch(url, init);
  };
  const events = await eventsOf(await request(input()));
  assert.equal(requests.length, 2);
  const outlineIndex = events.findIndex((event) => event.type === "reference_outline");
  const errorIndex = events.findIndex((event) => event.type === "error");
  assert(outlineIndex > 0 && errorIndex > outlineIndex);
  assert(events.some((event) => event.type === "reference_stage" && event.stage === "outline" && event.status === "done"));
  assert(!events.some((event) => event.type === "chapter" || event.type === "complete"));
});

test("all ten chapters have distinct tasks and receive official criteria without a preliminary report", async () => {
  const tasks = new Set();
  for (const { id } of PLAN_CHAPTERS) {
    const body = input(id); await eventsOf(await request(body));
    const prompt = userPrompt(requests.at(-1));
    tasks.add(JSON.stringify([prompt.chapter.goal, prompt.chapter.sections, prompt.chapter.deliverable]));
    assert.equal(prompt.chapter.id, id);
    const context = planContextSchema.parse({ binding: body.workspace.binding, reportId: null, title: "当前比赛", mode: null, criteria: [{ id: "criterion", title: "真实条款", text: "说明项目验证过程", sourceId: "official-source", sourceUrl: "https://example.org/rules", verificationStatus: "verified", origin: "official" }], evidence: [] });
    assert.equal(chapterReferencePrompt(body, context).prompt.verifiedOfficialCriteria.length, 1);
  }
  assert.equal(tasks.size, 10);
  assert.equal(requests.length, 20);
});

test("five tracks keep their selected identity and use distinct writing guidance", async () => {
  const focuses = new Set();
  for (const track of competition.tracks) {
    const body = input(); body.workspace.binding.trackId = track.trackId;
    body.workspace.preparation.topicBinding = bindingKey(body.workspace.binding);
    await eventsOf(await request(body));
    const prompt = userPrompt(requests.at(-1));
    assert.equal(prompt.currentSelection.trackName, track.name);
    focuses.add(prompt.trackWritingSuggestions.focus);
    assert.match(prompt.trackWritingSuggestions.status, /不是官方/);
  }
  assert.equal(focuses.size, 5);
});

test("an unsaved current direction overrides older seeded route and pain without discarding selected papers", async () => {
  const body = input(); body.workspace.preparation.topicBinding = null;
  const oldSeed = topicValues({ ...body.workspace.preparation, topicId: topics[0].id, topicTitle: topics[0].title }, body.workspace.studentProfile);
  body.session.slots.oneLineDescription.value = oldSeed.oneLineDescription;
  body.session.slots.technicalRoute.value = oldSeed.technicalRoute;
  body.session.slots.targetPain.value = oldSeed.targetPain;
  await eventsOf(await request(body));
  const prompt = userPrompt(requests.at(-2));
  assert.equal(prompt.currentSelection.direction, body.workspace.preparation.topicTitle);
  assert.equal(prompt.supplementalInterview.excludedPriorDirectionSlots, true);
  assert(!JSON.stringify(prompt).includes(oldSeed.technicalRoute));
  assert(!JSON.stringify(prompt).includes(oldSeed.targetPain));
  assert.equal(prompt.selectedReferences.length, 1);
});

test("invalid chapters, cross-project sessions and old track directions never call the model", async () => {
  const badChapter = { ...input(), chapterId: "not-a-real-chapter" };
  assert.equal((await request(badChapter)).status, 400);
  const cross = input(); cross.session.binding = { ...cross.workspace.binding, projectId: "foreign-project" };
  assert.equal((await request(cross)).status, 409);
  const oldDirection = input(); oldDirection.workspace.preparation.topicBinding = "foreign-binding";
  const events = await eventsOf(await request(oldDirection));
  assert(events.some((event) => event.type === "error"));
  assert.equal(requests.length, 0);
});

test("disabled or absent credentials and provider errors produce honest errors without local substitutes or secrets", async () => {
  globalThis.referenceTestConfig.enabled = false;
  let events = await eventsOf(await request(input()));
  assert(events.some((event) => event.type === "error")); assert.equal(requests.length, 0);
  globalThis.referenceTestConfig.enabled = true; globalThis.referenceTestConfig.apiKey = "";
  events = await eventsOf(await request(input()));
  assert(events.some((event) => event.type === "error")); assert.equal(requests.length, 0);
  globalThis.referenceTestConfig.apiKey = "unit-test-secret"; responseKind = "auth-error";
  events = await eventsOf(await request(input()));
  assert(events.some((event) => event.type === "error"));
  assert(!events.some((event) => event.type === "chapter" || event.type === "complete" || event.type === "replace"));
  assert(!JSON.stringify(events).includes("unit-test-secret"));
});

test("truncated, empty or prematurely ended model streams never become adoptable templates", async () => {
  for (const mode of ["length", "empty", "interrupted"]) {
    responseKind = mode; const events = await eventsOf(await request(input()));
    assert(events.some((event) => event.type === "error"), mode);
    assert(!events.some((event) => event.type === "chapter" || event.type === "complete"), mode);
  }
});

test("cancelling generation reaches the model request and produces no completed reference", async () => {
  responseKind = "cancel";
  const abort = new AbortController();
  const response = await request(input(), abort.signal);
  const text = response.text();
  const deadline = Date.now() + 2000;
  while (!requests.length && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(requests.length, 1);
  abort.abort();
  assert.equal(requests[0].signal.aborted, true);
  const output = await text;
  assert(!output.includes('"type":"chapter"'));
  assert(!output.includes('"type":"complete"'));
});

test("non-material project directions keep general chapter titles", () => {
  const preparation = preparationSchema.parse({ topicId: "custom-campus-app", topicTitle: "校园自习室预约系统" });
  const chapters = preparationChapters(preparation);
  assert.equal(chapters.length, 10);
  assert(!chapters.some((chapter) => /材料与产品|工艺路线/.test(chapter.title)));
});
