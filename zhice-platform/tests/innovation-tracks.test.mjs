import "./register-paths.mjs";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const originalCwd = process.cwd();
const temporary = await mkdtemp(path.join(tmpdir(), "zhice-innovation-tracks-"));
process.chdir(temporary);
after(async () => { process.chdir(originalCwd); await rm(temporary, { recursive: true, force: true }); });

const { directoryRecordSchema } = await import("../src/modules/campus-catalog/types.ts");
const { directoryToCompetition } = await import("../src/modules/campus-catalog/adapter.ts");
const { previewImport, commitImport } = await import("../src/modules/campus-catalog/server/repository.ts");
const { resolveCompetition } = await import("../src/modules/campus-catalog/server/catalog.ts");
const { competitions, findCompetition, installCampusCatalog } = await import("../src/modules/competition-recommendation/data.ts");
const { loadCompetitionSource } = await import("../src/modules/competition-recommendation/server/sources.ts");
const { useWorkspaceStore: workspace } = await import("../src/modules/workspace/workspace.store.ts");
const { emptyStudentProfile, projectBinding } = await import("../src/modules/workspace/types.ts");

const trackNames = ["高教主赛道", "红旅赛道", "职教赛道", "产业命题赛道", "萌芽赛道"];
const profile = { ...emptyStudentProfile(), college: "测试学院", major: "计算机", competitionGoal: "验证赛道选择" };
function directory(name, tracks = [], verificationStatus = "pending") {
  return directoryRecordSchema.parse({
    id: "fixture-innovation", editionId: "fixture-edition", version: 1,
    importedAt: "2026-11-01T00:00:00Z", verificationStatus, lastVerified: null, reviews: [],
    data: { name, academicYear: "2026-2027", tracks },
  });
}

test("current and legacy innovation competition names expose the five requested tracks", () => {
  const names = [
    "中国国际大学生创新大赛",
    "中国“互联网+”大学生创新创业大赛",
    "互联网+大学生创新创业大赛",
    "‘互联网+’大学生创新创业大赛",
    "福建省“互联网+”大学生创新创业大赛",
    "福建省大学生创新大赛",
    " 中国 ‘互联网 ＋’ 大学生 创新创业 大赛 ",
  ];
  for (const name of names) {
    const record = directory(name);
    const result = directoryToCompetition(record);
    assert.deepEqual(result.tracks.map((track) => track.name), trackNames, name);
    assert.equal(new Set(result.tracks.map((track) => track.trackId)).size, 5, name);
    assert(result.tracks.every((track) => track.verificationStatus === "pending"), name);
    assert.deepEqual(directoryToCompetition(record).tracks, result.tracks, "IDs must survive catalog reloads");
  }
});

test("unrelated internet and innovation events retain their own tracks", () => {
  for (const name of ["互联网+创新创业挑战赛", "中国互联网+大学生创新创业大赛培训赛", "全国大学生工业互联网大赛", "中国国际大学生创新大赛案例研讨会"]) {
    const result = directoryToCompetition(directory(name, ["工业设计", "网络应用"]));
    assert.deepEqual(result.tracks.map((track) => track.name), ["工业设计", "网络应用"], name);
    assert.deepEqual(result.tracks.map((track) => track.trackId), ["fixture-innovation-t0", "fixture-innovation-t1"], name);
  }
});

test("placeholder track identities cannot silently become a specific innovation track", () => {
  for (const existing of [[], ["赛道待核验"], ["通用准备（正式赛道待核验）"]]) {
    const result = directoryToCompetition(directory("中国国际大学生创新大赛", existing));
    assert.deepEqual(result.tracks.map((track) => track.name), trackNames);
    assert(!result.tracks.some((track) => track.trackId === "fixture-innovation-t0"));
  }
  for (const id of ["innovation-entrepreneurship", "internet-plus"]) {
    const result = competitions.find((item) => item.id === id);
    assert(result, id);
    assert.deepEqual(result.tracks.map((track) => track.name), trackNames);
    assert(!result.tracks.some((track) => track.trackId === id + "-general"));
    assert(result.tracks.every((track) => track.verificationStatus === "pending"));
  }
  assert.deepEqual(findCompetition("computer-design").tracks.map((track) => track.trackId), ["computer-design-general"]);
});

test("existing named tracks keep their identities and verification while added tracks remain pending", () => {
  for (const verificationStatus of ["pending", "verified"]) {
    const record = directory("中国国际大学生创新大赛", ["红旅赛道", "萌芽赛道"], verificationStatus);
    const before = structuredClone(record);
    const result = directoryToCompetition(record);
    assert.deepEqual(result.tracks.map((track) => track.name), trackNames);
    for (const [name, index] of [["红旅赛道", 0], ["萌芽赛道", 1]]) {
      const track = result.tracks.find((item) => item.name === name);
      assert.equal(track.trackId, "fixture-innovation-t" + index);
      assert.equal(track.verificationStatus, verificationStatus);
    }
    assert(result.tracks.filter((track) => !["红旅赛道", "萌芽赛道"].includes(track.name)).every((track) => track.verificationStatus === "pending"));
    assert.deepEqual(record, before, "adapting a record must not rewrite its source data");
  }
});

test("imported catalog tracks resolve on the server and load sources under the same identity", async () => {
  const sourceText = "独立测试通知原文：项目团队应核对所选赛道的资格与本届要求。此处不构成真实赛事核验。";
  const content = JSON.stringify([{ name: "中国“互联网+”大学生创新创业大赛", academicYear: "2026-2027", sourceFile: "独立测试通知.txt", sourcePage: 1, sourceText }]);
  const preview = await previewImport(content, "json");
  const { added: [record] } = await commitImport(content, "json", preview.token);
  const clientCompetition = directoryToCompetition(record);
  installCampusCatalog([clientCompetition]);
  try {
    const serverCompetition = await resolveCompetition(record.id);
    assert.deepEqual(serverCompetition.tracks, clientCompetition.tracks);
    assert.deepEqual(serverCompetition.tracks.map((track) => track.name), trackNames);
    assert.deepEqual(findCompetition(record.id).tracks, serverCompetition.tracks);
    for (const track of clientCompetition.tracks) {
      const result = await loadCompetitionSource(record.id, track.trackId, new AbortController().signal);
      assert.equal(result.source.trackId, track.trackId);
      assert.equal(result.source.competitionId, record.id);
      assert.equal(result.source.text, sourceText);
    }
    await assert.rejects(loadCompetitionSource(record.id, record.id + "-t0", new AbortController().signal), /赛道不存在/);
  } finally { installCampusCatalog([]); }
});

test("a non-first innovation track survives persistence and changing tracks archives its reports", async () => {
  const competition = findCompetition("innovation-entrepreneurship");
  const selectedTrack = competition.tracks.find((track) => track.name === "产业命题赛道");
  const nextTrack = competition.tracks.find((track) => track.name === "萌芽赛道");
  assert(selectedTrack); assert(nextTrack);
  const projectId = workspace.getState().newProject("赛道持久化测试", profile);
  workspace.getState().selectCompetition(competition.id, selectedTrack.trackId);
  workspace.getState().confirmCompetition();
  const originalBinding = projectBinding(workspace.getState().project);
  workspace.getState().linkReport("industry-report", "产业赛道报告", projectId, originalBinding);
  workspace.getState().setAssetStatus("documentStatus", "confirmed", projectId, originalBinding);
  const saved = storage.get("zhice:workspace:v1");
  assert(saved);
  workspace.getState().newProject("切换会话后的临时项目", profile);
  storage.set("zhice:workspace:v1", saved);
  await workspace.persist.rehydrate();
  workspace.getState().setReady();
  assert.equal(workspace.getState().currentProjectId, projectId);
  assert.equal(workspace.getState().project.selectedTrackId, selectedTrack.trackId);
  assert.deepEqual(projectBinding(workspace.getState().project), originalBinding);
  assert(workspace.getState().project.competitionConfirmedAt);

  workspace.getState().selectCompetition(competition.id, nextTrack.trackId);
  const current = workspace.getState().project;
  assert.equal(current.selectedTrackId, nextTrack.trackId);
  assert.notEqual(current.selectionRevision, originalBinding.revision);
  assert.equal(current.competitionConfirmedAt, null);
  assert.equal(current.reportId, null);
  assert.equal(current.documentStatus, "not_started");
  assert.equal(current.competitionHistory.at(-1).trackId, selectedTrack.trackId);
  assert.equal(current.competitionHistory.at(-1).reportId, "industry-report");
  workspace.getState().linkReport("late-industry-report", "旧赛道迟到结果", projectId, originalBinding);
  assert.equal(workspace.getState().project.reportId, null);
  assert.throws(() => workspace.getState().selectCompetition(competition.id, competition.id + "-general"), /有效赛道/);
  assert.equal(workspace.getState().project.selectedTrackId, nextTrack.trackId);
});
