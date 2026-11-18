import "./register-paths.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import JSZip from "jszip";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript,export async function getAiConfig(){return {enabled:false}}", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const original = process.cwd(); const temporary = await mkdtemp(path.join(tmpdir(), "zhice-simple-plan-")); process.chdir(temporary);
after(async () => { process.chdir(original); await rm(temporary, { recursive: true, force: true }); });
const storage = new Map(); globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const { POST } = await import("../src/app/api/project-plan/route.ts");
const { emptySurveySession } = await import("../src/modules/project-plan/types.ts");
const { emptyStudentProfile, workspaceProjectSchema, projectBinding } = await import("../src/modules/workspace/types.ts");
const { useProjectPlanStore: plans } = await import("../src/modules/project-plan/plan.store.ts");
const { sessionForDraft, createGeneralDraft, generalDraftMarkdown } = await import("../src/modules/project-plan/draft-workflow.ts");
const { confirmedBlocks } = await import("../src/shared/contracts/plan-document.ts");
const profile = { ...emptyStudentProfile(), college: "测试学院", major: "计算机", competitionGoal: "完成可复核的项目计划" };
const binding = { projectId: "simple-project", competitionId: "computer-design", trackId: "computer-design-general", revision: "simple-revision" };
const workspace = { binding, studentProfile: profile, selectionConfirmedAt: null, reportId: null, intent: "draft" };
const request = (body) => POST(new Request("http://localhost/api/project-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
const project = workspaceProjectSchema.parse({ projectId: binding.projectId, name: "测试通用项目", studentProfile: profile, selectedCompetitionId: null, selectedTrackId: null, projectStage: "idea", reportId: null, documentStatus: "not_started", pptStatus: "not_started", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

test("incomplete information can generate a chapter draft without a preliminary report", async () => {
  const session = emptySurveySession();
  const response = await request({ action: "chapter", workspace, session, report: null, chapterId: "technical-route" });
  assert.equal(response.status, 200);
  const events = (await response.text()).split("\n\n").filter((part) => part.startsWith("data: ")).map((part) => JSON.parse(part.slice(6)));
  const chapter = events.find((event) => event.type === "chapter").chapter;
  assert.equal(chapter.status, "draft"); assert.equal(chapter.generationStatus, "draft");
  assert.match(chapter.content, /建议补充/); assert.match(chapter.content, /____/);
  assert.deepEqual(chapter.binding, binding);
  const formal = await request({ action: "chapter", workspace: { ...workspace, intent: "formal" }, session, report: null, chapterId: "technical-route" });
  assert.equal(formal.status, 409);
});

test("incomplete draft exports retain missing-information markers in Word", async () => {
  const content = "# 项目介绍\n【已生成】正在准备项目。\n【建议补充】访谈记录：____。";
  const response = await request({ action: "export", workspace, session: emptySurveySession(), report: null, title: "计划书测试", format: "docx", chapters: [{ id: "project-intro", title: "项目介绍", content, status: "draft", updatedAt: new Date().toISOString() }] });
  assert.equal(response.status, 200);
  const payload = await response.json(); const zip = await JSZip.loadAsync(Buffer.from(payload.content, "base64"));
  const xml = await zip.file("word/document.xml").async("string");
  assert.match(xml, /建议补充/); assert.match(xml, /____/);
});

test("draft preparation keeps existing answers and leaves absent information incomplete", () => {
  const session = emptySurveySession(); session.slots.oneLineDescription.value = "用户已经修改的项目介绍";
  const seeded = sessionForDraft(session, project);
  assert.equal(seeded.slots.oneLineDescription.value, "用户已经修改的项目介绍");
  assert.equal(seeded.complete, false); assert.equal(seeded.slots.targetPain.value, null);
  assert.equal(seeded.binding, undefined); assert.equal(projectBinding(project), null);
  const draft = createGeneralDraft(project, seeded, "technical-route");
  assert.equal(draft.binding, undefined); assert.equal(draft.status, "draft");
  assert.match(draft.content, /尚未对齐具体比赛/); assert.match(generalDraftMarkdown(project.name, [draft]), /建议补充/);
});

test("unbound drafts survive reload and explicit import keeps originals without confirming claims", async () => {
  plans.getState().activateProject(project.projectId, project.projectId);
  const draft = createGeneralDraft(project, sessionForDraft(emptySurveySession(), project), "technical-route");
  draft.content += "\n【AI推断，请核验】可能降低成本。";
  plans.getState().upsertChapter(draft);
  await plans.persist.rehydrate(); plans.getState().activateProject(project.projectId, project.projectId);
  assert.equal(plans.getState().chapters[draft.id].content, draft.content);
  plans.getState().activateProject(project.projectId, "bound-scope");
  plans.getState().setDocumentContext(project.name, binding, [], []);
  assert.equal(plans.getState().importProjectDrafts({ ...binding, projectId: "someone-else" }), 0);
  assert.equal(plans.getState().importProjectDrafts(binding), 1);
  assert.equal(plans.getState().chapters[draft.id].content, draft.content);
  assert.deepEqual(plans.getState().chapters[draft.id].binding, binding);
  assert.equal(plans.getState().chapters[draft.id].status, "draft");
  assert.equal(confirmedBlocks(plans.getState().document).length, 0);
  assert.equal(plans.getState().byProject[project.projectId].chapters[draft.id].binding, undefined);
  assert.equal(plans.getState().byProject[project.projectId].chapters[draft.id].content, draft.content);
  assert.equal(plans.getState().importProjectDrafts(binding), 0, "import cannot overwrite a chapter already in this competition");
});
