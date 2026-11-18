import "./register-paths.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { chapterReferencePrompt } = await import("../src/modules/project-plan/server/chapter-reference.ts");
const { chapterReferenceRequestSchema, planContextSchema, emptySurveySession } = await import("../src/modules/project-plan/types.ts");
const { preparationSchema } = await import("../src/shared/contracts/preparation.ts");
const { emptyStudentProfile } = await import("../src/modules/workspace/types.ts");
const { topics, topicValues } = await import("../src/modules/preparation/domain.ts");

const profile = { ...emptyStudentProfile(), college: "测试学院", major: "材料科学", competitionGoal: "完成项目验证" };
const currentTopic = topics.find((topic) => topic.id === "bamboo-nursery");
const preparation = preparationSchema.parse({ topicId: currentTopic.id, topicTitle: currentTopic.title });
const context = planContextSchema.parse({ title: currentTopic.title, competitionName: "测试比赛", trackName: "高教主赛道", reportId: null, mode: null, criteria: [], evidence: [] });
function request(values) {
  const session = emptySurveySession();
  for (const [id, value] of Object.entries(values)) session.slots[id] = { ...session.slots[id], value, status: "captured" };
  return chapterReferenceRequestSchema.parse({ action: "chapter_reference", projectName: currentTopic.title, chapterId: "technical-route", workspace: { binding: { projectId: "prompt-project", competitionId: "test-competition", trackId: "test-track", revision: "1" }, preparation, studentProfile: profile, selectionConfirmedAt: null, reportId: null }, session });
}

test("a descriptive sentence different from the title retains all genuine writing inputs", () => {
  const values = { oneLineDescription: "面向苗圃开发湿态稳定的纤维容器", targetPain: "用户反馈浇水后容器难以搬运，需要进一步访谈核实。", differentiation: "拟比较不同结构下的湿态稳定表现。", technicalRoute: "先观察浇水流程，再与指导老师确认湿态测试方案。", progress: "已整理两份参考论文，尚无实验数据。" };
  const input = request(values);
  const before = structuredClone(input);
  const interview = chapterReferencePrompt(input, context).prompt.supplementalInterview;
  for (const [id, value] of Object.entries(values)) assert.equal(interview.slots[id].value, value);
  assert.equal(interview.excludedPriorDirectionSlots, false);
  assert.deepEqual(interview.excludedSlotIds, []);
  assert.equal(interview.currentDirectionTakesPriority, true);
  assert.deepEqual(input, before, "building a reference must not rewrite stored user answers");
});

test("only exact known defaults from a prior preset direction are excluded", () => {
  const previous = topics.find((topic) => topic.id === "bamboo-packaging");
  const seed = topicValues(preparationSchema.parse({ topicId: previous.id, topicTitle: previous.title }), profile);
  const input = request(seed);
  const result = chapterReferencePrompt(input, context);
  assert.equal(result.prompt.currentSelection.direction, currentTopic.title);
  assert.deepEqual(result.prompt.supplementalInterview.excludedSlotIds.sort(), ["oneLineDescription", "targetPain", "differentiation", "technicalRoute"].sort());
  for (const id of ["team", "progress", "goal"]) assert.equal(result.prompt.supplementalInterview.slots[id].value, seed[id]);
});

test("user edits to a prior preset's route and pain remain available as supplemental material", () => {
  const previous = topics.find((topic) => topic.id === "bamboo-packaging");
  const seed = topicValues(preparationSchema.parse({ topicId: previous.id, topicTitle: previous.title }), profile);
  const values = { ...seed, technicalRoute: "用户补充：先确认苗圃湿态搬运场景，准备容器样品测试。", targetPain: "用户补充：育苗过程中容器搬运需求尚待访谈核实。" };
  const interview = chapterReferencePrompt(request(values), context).prompt.supplementalInterview;
  assert.equal(interview.slots.technicalRoute.value, values.technicalRoute);
  assert.equal(interview.slots.targetPain.value, values.targetPain);
  assert.equal(interview.slots.oneLineDescription, undefined);
  assert.equal(interview.slots.differentiation, undefined);
});

test("unrecognized previous wording is preserved rather than guessed to be obsolete", () => {
  const values = { oneLineDescription: "用户自行填写的完整项目说明", technicalRoute: "用户手动定义的技术路线与验收条件。" };
  const result = chapterReferencePrompt(request(values), context);
  assert.equal(result.prompt.supplementalInterview.slots.oneLineDescription.value, values.oneLineDescription);
  assert.equal(result.prompt.supplementalInterview.slots.technicalRoute.value, values.technicalRoute);
  assert.match(result.prompt.supplementalInterview.relevanceStatus, /相关性/);
  assert.equal(result.prompt.currentSelection.direction, currentTopic.title);
});
