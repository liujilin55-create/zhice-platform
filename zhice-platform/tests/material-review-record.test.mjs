import "./register-paths.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const { materialFingerprint, hasCurrentMaterialReview } = await import("../src/modules/ppt-generator/material-review-record.ts");
const { usePptWorkspaceStore } = await import("../src/modules/ppt-generator/ppt-workspace.store.ts");
const { buildMaterialReview } = await import("../src/modules/ppt-generator/material-review.ts");
const { workspaceProjectSchema, emptyStudentProfile, projectScopeKey } = await import("../src/modules/workspace/types.ts");
const { planDocumentSchema } = await import("../src/shared/contracts/plan-document.ts");
const { competitions } = await import("../src/modules/competition-recommendation/data.ts");
const now = "2026-11-17T01:00:00.000Z";

function fixture() {
  const competition = structuredClone(competitions[0]);
  const project = workspaceProjectSchema.parse({
    projectId: "review-project-a", name: "材料检查测试项目", studentProfile: { ...emptyStudentProfile(), college: "测试学院", major: "待补充", competitionGoal: "待补充" },
    selectedCompetitionId: competition.id, selectedTrackId: competition.tracks[0].trackId, selectionRevision: "review-selection", competitionConfirmedAt: now,
    projectStage: "idea", reportId: null, documentStatus: "draft", pptStatus: "draft", createdAt: now, updatedAt: now,
    preparation: { topicTitle: "校园材料工具", research: [{ title: "测试论文", url: "https://example.org/research", excerpt: "论文摘要仍需核对。", kind: "paper", source: "测试来源" }] },
  });
  const binding = { projectId: project.projectId, competitionId: competition.id, trackId: project.selectedTrackId, revision: project.selectionRevision };
  const plan = planDocumentSchema.parse({
    documentId: "review-plan-a", binding, projectName: project.name, title: "测试计划书", version: 1, confirmed: false, updatedAt: now,
    chapters: [{ id: "intro", title: "项目介绍", aiContent: "推断中的产品方向", userContent: null, confirmed: false, updatedAt: now, blocks: [{ id: "block-a", text: "推断中的产品方向", origin: "ai", marker: "inference", confirmed: false, evidenceIds: [], sourceIds: ["source-a"] }] }],
    sources: [{ sourceId: "source-a", competitionId: competition.id, trackId: project.selectedTrackId, title: "待核实赛事来源", kind: "official", url: "https://example.org/rules", text: "尚未核实的原文", contentHash: "test-content", verificationStatus: "pending", lastVerified: null, fetchedAt: now, warnings: [] }],
    scoringRequirements: [{ id: "criterion-a", title: "测试要求", text: "待核实评分原句", sourceId: "source-a", sourceUrl: "https://example.org/rules", verificationStatus: "pending", origin: "official" }],
  });
  return {
    project, competition, plan,
    draftChapters: [{ id: "draft-intro", title: "通用草稿", content: "通用项目介绍", status: "draft", generationStatus: "draft", sourceIds: [], updatedAt: now }],
    outline: { title: "演示草稿", subtitle: "待补材料", slides: [{ id: "slide-a", title: "方案", bullets: ["【待核验】产品方向"], speakerNotes: "【待核验】演讲备注", layout: "content", claims: [{ text: "产品方向", origin: "ai", confirmed: false, blockIds: ["block-a"], chapterIds: ["intro"], evidenceIds: [], sourceIds: ["source-a"] }] }] },
    document: null, checks: [], stale: false, template: "zhice-dark", pageRange: "8-10", options: { pages: 8, durationMinutes: 5, focus: "story" },
  };
}

test("one material review persists independently and only matches its project and selection scope", async () => {
  usePptWorkspaceStore.setState({ byProject: {}, materialReviews: {} });
  const snapshot = fixture();
  const scopeKey = projectScopeKey(snapshot.project);
  const fingerprint = materialFingerprint(snapshot);
  usePptWorkspaceStore.getState().markMaterialsReviewed(scopeKey, fingerprint);
  const record = usePptWorkspaceStore.getState().materialReviews[scopeKey];
  assert(hasCurrentMaterialReview(record, scopeKey, fingerprint));
  assert(!hasCurrentMaterialReview(record, projectScopeKey({ ...snapshot.project, projectId: "review-project-b" }), fingerprint));
  assert(!hasCurrentMaterialReview(record, projectScopeKey({ ...snapshot.project, selectionRevision: "new-selection" }), fingerprint));
  assert(!hasCurrentMaterialReview(record, null, fingerprint));
  usePptWorkspaceStore.getState().markMaterialsReviewed("review-project-b", "independent-fingerprint");
  const serialized = storage.get("zhice:ppt-workspace:v1");
  usePptWorkspaceStore.setState({ materialReviews: {} });
  storage.set("zhice:ppt-workspace:v1", serialized);
  await usePptWorkspaceStore.persist.rehydrate();
  assert.deepEqual(usePptWorkspaceStore.getState().materialReviews[scopeKey], record);
  assert.equal(usePptWorkspaceStore.getState().materialReviews["review-project-b"].fingerprint, "independent-fingerprint");
});

test("research, plan, generic draft, slides, source facts and presentation changes invalidate the review", () => {
  const snapshot = fixture();
  const fingerprint = materialFingerprint(snapshot);
  const scopeKey = projectScopeKey(snapshot.project);
  const record = { scopeKey, fingerprint, reviewedAt: now };
  const changes = [
    (copy) => { copy.project.preparation.research[0].excerpt = "新摘录"; },
    (copy) => { copy.project.studentProfile.major = "计算机科学"; },
    (copy) => { copy.project.preparation.answers.problem = "更新项目痛点"; },
    (copy) => { copy.plan.chapters[0].blocks[0].text = "计划书正文已修改"; },
    (copy) => { copy.draftChapters[0].content = "通用草稿正文已修改"; },
    (copy) => { copy.outline.slides[0].bullets[0] = "【待核验】修改演示要点"; },
    (copy) => { copy.outline.slides[0].speakerNotes = "【待核验】修改演讲备注"; },
    (copy) => { copy.plan.sources[0].verificationStatus = "conflict"; },
    (copy) => { copy.competition.tracks[0].verificationStatus = "conflict"; },
    (copy) => { copy.stale = true; },
    (copy) => { copy.template = "minimal"; },
    (copy) => { copy.options.durationMinutes = 10; },
    (copy) => { copy.document = { fileName: "新稿.docx", paragraphs: ["上传的实际正文"] }; },
  ];
  for (const change of changes) {
    const changed = structuredClone(snapshot);
    change(changed);
    assert(!hasCurrentMaterialReview(record, scopeKey, materialFingerprint(changed)), change.toString());
  }
});

test("saving or exporting unchanged materials does not invalidate the checked content", () => {
  const snapshot = fixture();
  const changed = structuredClone(snapshot);
  changed.project.updatedAt = "2026-11-17T03:00:00.000Z";
  changed.project.pptStatus = "exported";
  changed.project.reportIds = ["unrelated-activity-report"];
  changed.plan.updatedAt = "2026-11-17T03:00:00.000Z";
  changed.plan.chapters[0].updatedAt = "2026-11-17T03:00:00.000Z";
  changed.draftChapters[0].updatedAt = "2026-11-17T03:00:00.000Z";
  changed.plan.sources[0].fetchedAt = "2026-11-17T03:00:00.000Z";
  changed.options = { focus: "story", durationMinutes: 5, pages: 8 };
  assert.equal(materialFingerprint(changed), materialFingerprint(snapshot));
});

test("checking a version preserves missing data, stale slides, errors and all genuine verification states", () => {
  const snapshot = fixture();
  snapshot.project.preparation.topicTitle = "";
  snapshot.stale = true;
  snapshot.checks = [{ code: "test-error", severity: "error", message: "正文与演示不一致" }];
  const before = structuredClone(snapshot);
  const checklist = () => buildMaterialReview({ ...snapshot, draftChapterCount: snapshot.draftChapters.length });
  const originalItems = checklist();
  const scopeKey = projectScopeKey(snapshot.project);
  usePptWorkspaceStore.getState().markMaterialsReviewed(scopeKey, materialFingerprint(snapshot));
  assert(hasCurrentMaterialReview(usePptWorkspaceStore.getState().materialReviews[scopeKey], scopeKey, materialFingerprint(snapshot)));
  assert.deepEqual(snapshot, before);
  assert.deepEqual(checklist(), originalItems);
  for (const id of ["profile", "topic"]) assert.equal(checklist().find((item) => item.id === id).state, "missing");
  for (const id of ["research", "document", "official", "presentation"]) assert.equal(checklist().find((item) => item.id === id).state, "review");
  assert.equal(snapshot.plan.confirmed, false);
  assert.equal(snapshot.plan.chapters[0].blocks[0].confirmed, false);
  assert.equal(snapshot.plan.chapters[0].blocks[0].marker, "inference");
  assert.equal(snapshot.plan.sources[0].verificationStatus, "pending");
  assert.equal(snapshot.plan.scoringRequirements[0].verificationStatus, "pending");
  assert.equal(snapshot.outline.slides[0].claims[0].confirmed, false);
  assert.equal(snapshot.draftChapters[0].status, "draft");
});

test("old saved workspaces hydrate without reviews and mismatched stored record scopes are rejected", async () => {
  storage.set("zhice:ppt-workspace:v1", JSON.stringify({ state: { byProject: {} }, version: 0 }));
  await usePptWorkspaceStore.persist.rehydrate();
  assert.deepEqual(usePptWorkspaceStore.getState().materialReviews, {});
  storage.set("zhice:ppt-workspace:v1", JSON.stringify({ state: { byProject: {}, materialReviews: { "project-a": { scopeKey: "project-b", fingerprint: "wrong-scope", reviewedAt: now }, "project-c": { scopeKey: "project-c", fingerprint: "valid", reviewedAt: now } } }, version: 0 }));
  await usePptWorkspaceStore.persist.rehydrate();
  assert.equal(usePptWorkspaceStore.getState().materialReviews["project-a"], undefined);
  assert.equal(usePptWorkspaceStore.getState().materialReviews["project-c"].fingerprint, "valid");
});
