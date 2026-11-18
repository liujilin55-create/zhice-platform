import "./register-paths.mjs";
import assert from "node:assert/strict";
import test from "node:test";
const { buildMaterialReview } = await import("../src/modules/ppt-generator/material-review.ts");
const { createProjectDraftOutline, checkProjectDraftOutline, projectDraftKey } = await import("../src/modules/ppt-generator/project-draft-outline.ts");
const { workspaceProjectSchema, emptyStudentProfile } = await import("../src/modules/workspace/types.ts");
const { competitions } = await import("../src/modules/competition-recommendation/data.ts");
const now = new Date().toISOString();
const project = workspaceProjectSchema.parse({ projectId: "material-review", name: "独立测试项目", studentProfile: { ...emptyStudentProfile(), college: "测试学院", major: "待补充", competitionGoal: "待补充" }, selectedCompetitionId: null, selectedTrackId: null, projectStage: "idea", reportId: null, documentStatus: "draft", pptStatus: "not_started", createdAt: now, updatedAt: now });

test("central review reports actual missing inputs and never treats a draft as source verification", () => {
  const items = buildMaterialReview({ project, competition: null, plan: null, draftChapterCount: 2, outline: null, checks: [], stale: false });
  assert.equal(items.find((item) => item.id === "document").state, "review");
  assert.match(items.find((item) => item.id === "document").detail, /2 个章节/);
  for (const id of ["competition", "topic", "research", "presentation"]) assert.equal(items.find((item) => item.id === id).state, "missing", id);
  assert.equal(items.find((item) => item.id === "official").state, "review");
});

test("invalid saved track, unverified references and stale presentation are visible in central review", () => {
  const competition = competitions[0];
  const changed = { ...project, selectedCompetitionId: competition.id, selectedTrackId: "outdated-track", competitionConfirmedAt: now, preparation: { ...project.preparation, topicTitle: "已有方向", research: [{ title: "测试论文", url: "https://example.org/source", excerpt: "待核对的来源", kind: "paper", source: "OpenAlex" }] } };
  const outline = { title: "独立测试项目", subtitle: "", slides: [] };
  const items = buildMaterialReview({ project: changed, competition, plan: null, outline, checks: [], stale: true });
  for (const id of ["topic", "research", "presentation"]) assert.equal(items.find((item) => item.id === id).state, "review", id);
  assert.equal(items.find((item) => item.id === "competition").state, "missing");
});

test("general draft pages retain real content with pending markers and invalidate after edits", () => {
  const chapters = [{ id: "project-intro", title: "项目介绍", content: "我们计划开发校园材料整理工具。", status: "draft", updatedAt: now }];
  const outline = createProjectDraftOutline(project.projectId, project.name, chapters, { pages: 8, durationMinutes: 5, focus: "story" });
  assert.equal(outline.slides.length, 8); assert.equal(outline.planSource, undefined);
  assert(JSON.stringify(outline).includes("校园材料整理工具"));
  assert.equal(checkProjectDraftOutline(outline).filter((check) => check.severity === "error").length, 0);
  assert.notEqual(projectDraftKey(project.name, [{ ...chapters[0], content: "修改后的项目内容" }]), outline.draftSource.contentKey);
  const forged = structuredClone(outline); forged.slides[1].speakerNotes = "未经核对却声称已经获得冠军。";
  assert(checkProjectDraftOutline(forged).some((check) => check.code === "draft-marker" && check.severity === "error"));
});
