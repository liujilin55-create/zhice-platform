import "./register-paths.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { preparationProgress } = await import("../src/modules/preparation/progress.ts");
const { emptyStudentProfile, projectScopeKey, workspaceProjectSchema } = await import("../src/modules/workspace/types.ts");

const timestamp = "2026-11-17T12:00:00.000Z";
const profile = { ...emptyStudentProfile(), school: "测试高校", college: "测试学院", major: "测试专业", competitionGoal: "完成独立测试项目" };
const competition = {
  id: "fixture-competition", verificationStatus: "pending",
  tracks: [{ trackId: "fixture-track", name: "测试赛道", verificationStatus: "pending" }],
};
function project(patch = {}) {
  return workspaceProjectSchema.parse({
    projectId: "fixture-project", name: "四步进度独立测试", studentProfile: profile,
    selectedCompetitionId: competition.id, selectedTrackId: competition.tracks[0].trackId,
    selectionRevision: "fixture-revision", competitionConfirmedAt: timestamp,
    projectStage: "idea", reportId: null, documentStatus: "not_started", pptStatus: "not_started",
    createdAt: timestamp, updatedAt: timestamp, ...patch,
  });
}
function savedTopic(current, patch = {}) {
  return workspaceProjectSchema.parse({ ...current, preparation: {
    ...current.preparation, topicId: "fixture-topic", topicTitle: "独立测试方向",
    topicConfirmedAt: timestamp, topicBinding: projectScopeKey(current), research: [], ...patch,
  } });
}

test("a saved valid selection completes step one even while official competition and track data are pending", () => {
  const current = project();
  const validTrack = current.selectedCompetitionId === competition.id && competition.tracks.some((track) => track.trackId === current.selectedTrackId);
  assert.deepEqual(preparationProgress(current, validTrack)[0], { complete: true, label: "已选择" });
  assert.equal(competition.verificationStatus, "pending");
  assert.equal(competition.tracks[0].verificationStatus, "pending");
});

test("an invalid or unsaved selection cannot be marked complete by an old confirmation timestamp", () => {
  assert.deepEqual(preparationProgress(project({ selectedTrackId: "removed-track" }), false)[0], { complete: false, label: "选择中" });
  assert.deepEqual(preparationProgress(project({ competitionConfirmedAt: null }), true)[0], { complete: false, label: "选择中" });
  assert.deepEqual(preparationProgress(project({ selectedCompetitionId: null, selectedTrackId: null, competitionConfirmedAt: null }), false)[0], { complete: false, label: "未选择" });
});

test("a saved topic with a matching scope is complete without requiring research or verified claims", () => {
  const current = savedTopic(project());
  const before = structuredClone(current);
  assert.deepEqual(current.preparation.research, []);
  assert.deepEqual(preparationProgress(current, true)[1], { complete: true, label: "已保存" });
  assert.deepEqual(current, before, "reading workflow progress must not change source or preparation data");
});

test("changing competition, track, selection revision or project cannot reuse an old topic's completion", () => {
  const current = savedTopic(project());
  for (const patch of [
    { selectedCompetitionId: "other-competition" },
    { selectedTrackId: "other-track" },
    { selectionRevision: "new-revision" },
    { projectId: "other-project" },
  ]) {
    const changed = workspaceProjectSchema.parse({ ...current, ...patch });
    assert.notEqual(projectScopeKey(changed), current.preparation.topicBinding);
    assert.deepEqual(preparationProgress(changed, true)[1], { complete: false, label: "进行中" });
  }
});

test("a custom topic can be saved in the project scope before choosing a competition", () => {
  const current = savedTopic(project({ selectedCompetitionId: null, selectedTrackId: null, competitionConfirmedAt: null }), { topicId: null });
  assert.equal(current.preparation.topicBinding, current.projectId);
  const progress = preparationProgress(current, false);
  assert.equal(progress[0].complete, false);
  assert.deepEqual(progress[1], { complete: true, label: "已保存" });
  const unsaved = workspaceProjectSchema.parse({ ...current, preparation: { ...current.preparation, topicConfirmedAt: null } });
  assert.equal(preparationProgress(unsaved, false)[1].complete, false);
  const empty = workspaceProjectSchema.parse({ ...current, preparation: { ...current.preparation, topicTitle: "  " } });
  assert.equal(preparationProgress(empty, false)[1].complete, false);
});

test("document and slide progress distinguishes drafts, saved work and exports without claiming source verification", () => {
  for (const [status, complete, documentLabel, pptLabel] of [
    ["not_started", false, "未开始", "未开始"],
    ["draft", false, "已有草稿", "已有大纲"],
    ["confirmed", true, "已保存", "已保存"],
    ["exported", true, "已导出", "已导出"],
  ]) {
    const progress = preparationProgress(project({ documentStatus: status, pptStatus: status }), true);
    assert.deepEqual(progress[2], { complete, label: documentLabel });
    assert.deepEqual(progress[3], { complete, label: pptLabel });
    assert(progress.every((step) => !/核验|提交就绪/.test(step.label)));
  }
  assert.equal(competition.verificationStatus, "pending", "an exported file does not verify its official source");
});
