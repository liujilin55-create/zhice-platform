import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier === "@/modules/evidence-center/server") return { url: "data:text/javascript,export async function readEvidenceDatabase(){return globalThis.__projectDatabase}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const target = new URL("../src/" + specifier.slice(2), import.meta.url);
    return { url: existsSync(fileURLToPath(target) + ".ts") ? target.href + ".ts" : target.href + "/index.ts", shortCircuit: true };
  }
  if (specifier.startsWith(".") && !path.extname(specifier)) { try { return nextResolve(specifier + ".ts", context); } catch { /* Standard resolution follows. */ } }
  return nextResolve(specifier, context);
} });
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const { useWorkspaceStore: workspace } = await import("../src/modules/workspace/workspace.store.ts");
const { useProjectPlanStore: plans } = await import("../src/modules/project-plan/plan.store.ts");
const { useTaskStore: tasks } = await import("../src/modules/task-orchestration/task.store.ts");
const { emptyStudentProfile, preparationStepView, projectScopeKey, studentProfileSchema, workspaceProjectSchema } = await import("../src/modules/workspace/types.ts");
const { emptySurveySession } = await import("../src/modules/project-plan/types.ts");
const { localReport } = await import("../src/modules/project-plan/server/helpers.ts");
const profile = { ...emptyStudentProfile(), college: "测试学院", major: "计算机科学与技术", competitionGoal: "验证原型", skills: ["React"], currentProjectStatus: "idea" };
const task = { id: "task-a", title: "项目 A 任务", description: "独立任务", owner: "测试同学", due: "待定", tag: "技术", priority: "high", status: "active", sample: false, dependencies: [], checklist: ["验收"] };
let first, second;

test("student profile validates editable school, resource limits and required information", () => {
  assert.equal(emptyStudentProfile().school, "福建农林大学");
  assert(studentProfileSchema.safeParse({ ...profile, school: "其他高校" }).success);
  for (const patch of [{ major: "" }, { college: "" }, { weeklyHours: 0 }, { budget: -1 }]) assert(!studentProfileSchema.safeParse({ ...profile, ...patch }).success);
  assert.throws(() => workspace.getState().newProject("尚未填写画像"));
});

test("project resume destination follows the four-step material path", () => {
  const now = new Date().toISOString();
  const base = workspaceProjectSchema.parse({ projectId: "resume-fixture", name: "Resume fixture", studentProfile: profile, selectedCompetitionId: null, selectedTrackId: null, projectStage: "idea", reportId: null, reportIds: [], documentStatus: "not_started", pptStatus: "not_started", createdAt: now, updatedAt: now });
  assert.equal(preparationStepView(base), "competitions");
  const selected = { ...base, selectedCompetitionId: "competition-a", selectedTrackId: "track-a", competitionConfirmedAt: new Date().toISOString() };
  assert.equal(preparationStepView(selected), "topics");
  const topicConfirmed = { ...selected, preparation: { ...selected.preparation, topicId: "topic-a", topicConfirmedAt: new Date().toISOString(), topicBinding: "wrong-scope" } };
  assert.equal(preparationStepView(topicConfirmed), "topics", "an unbound topic must return to direction confirmation");
  const boundTopic = { ...topicConfirmed, preparation: { ...topicConfirmed.preparation, topicBinding: projectScopeKey(selected) }, documentStatus: "confirmed" };
  assert.equal(preparationStepView(boundTopic), "ppt");
});

test("second project starts clean; selection preserves profile, plan, report, tasks and project metadata", () => {
  first = workspace.getState().newProject("项目 A", profile);
  workspace.getState().selectCompetition("competition-a", "track-a");
  workspace.getState().linkReport("report-a", "比赛 A", first);
  const session = emptySurveySession(); session.messages.push({ id: "answer-a", role: "user", content: "仅属于项目 A 的想法", createdAt: new Date().toISOString() });
  plans.getState().setSession(session); plans.getState().setReport(localReport(session, []));
  plans.getState().upsertChapter({ id: "executive-summary", title: "执行总结", content: "项目 A 计划书", status: "confirmed", updatedAt: new Date().toISOString() });
  tasks.getState().setTasks(() => [task]);
  workspace.getState().setAssetStatus("documentStatus", "confirmed");
  const activity = workspace.getState().beginActivity({ kind: "project", title: "项目 A 记录", detail: "A", href: "/?view=plan" });
  workspace.getState().finishActivity(activity, { status: "success" });
  workspace.getState().handoffFile(new File(["fixture"], "a.docx"));
  second = workspace.getState().newProject("项目 B", { ...profile, major: "农业资源与环境", currentProjectStatus: "no-project" });
  assert.notEqual(first, second); assert.equal(plans.getState().projectId, second);
  assert.equal(plans.getState().session.messages.length, 0); assert.equal(plans.getState().report, null); assert.deepEqual(plans.getState().chapters, {}); assert.deepEqual(tasks.getState().tasks, []);
  assert.equal(workspace.getState().project.reportId, null); assert.equal(workspace.getState().project.selectedCompetitionId, null); assert.equal(workspace.getState().project.documentStatus, "not_started");
  assert.equal(workspace.getState().pendingUpload, null);
  const before = structuredClone(workspace.getState().project);
  workspace.getState().selectCompetition("competition-b");
  assert.deepEqual(workspace.getState().project.studentProfile, before.studentProfile); assert.equal(workspace.getState().project.name, before.name); assert.equal(workspace.getState().project.createdAt, before.createdAt);
  assert(workspace.getState().project.updatedAt >= before.updatedAt);
  assert(!storage.get("zhice:workspace:v1").includes("pendingUpload"));
});

test("reload restores selection and current project, and switching restores only its own plan and tasks", async () => {
  await workspace.persist.rehydrate(); await plans.persist.rehydrate(); await tasks.persist.rehydrate(); workspace.getState().setReady();
  assert.equal(workspace.getState().currentProjectId, second); assert.equal(workspace.getState().project.selectedCompetitionId, "competition-b"); assert.equal(plans.getState().report, null);
  workspace.getState().switchProject(first);
  assert.equal(plans.getState().session.messages[0].content, "仅属于项目 A 的想法"); assert.equal(plans.getState().chapters["executive-summary"].content, "项目 A 计划书");
  assert.equal(tasks.getState().tasks[0].projectId, first); assert.equal(workspace.getState().project.reportId, "report-a"); assert.equal(workspace.getState().project.documentStatus, "confirmed");
  assert.equal(workspace.getState().project.selectedTrackId, "track-a");
  assert.equal(workspace.getState().activities.filter((item) => item.projectId === second).length, 0);
  workspace.getState().switchProject(second);
  // A delayed operation must update its captured owner, never the newly selected project.
  workspace.getState().linkReport("late-report-a", "旧请求", first);
  workspace.getState().setAssetStatus("pptStatus", "exported", first);
  assert.equal(workspace.getState().project.reportId, null); assert.equal(workspace.getState().project.pptStatus, "not_started");
  assert.equal(workspace.getState().projects.find((item) => item.projectId === first).reportId, "late-report-a");
});

test("legacy global data migrates only to the pre-existing project", async () => {
  const session = emptySurveySession(); session.messages.push({ id: "old", role: "user", content: "迁移内容", createdAt: new Date().toISOString() });
  storage.set("zhice:workspace:v1", JSON.stringify({ state: { project: { id: "legacy-project", name: "旧项目", reportId: "old-report", createdAt: "2026-10-01" }, activities: [] }, version: 0 }));
  storage.set("zhice:project-plan:v1", JSON.stringify({ state: { phase: "survey", session, report: null, chapters: {}, activeChapterId: null }, version: 0 }));
  storage.set("zhice:tasks:v1", JSON.stringify({ state: { tasks: [task] }, version: 0 }));
  await workspace.persist.rehydrate(); await plans.persist.rehydrate(); await tasks.persist.rehydrate(); workspace.getState().setReady();
  assert.equal(plans.getState().session.messages[0].content, "迁移内容"); assert.equal(tasks.getState().tasks[0].projectId, "legacy-project");
  const fresh = workspace.getState().newProject("全新项目", profile);
  assert.equal(plans.getState().session.messages.length, 0); assert.equal(tasks.getState().tasks.length, 0);
  workspace.getState().switchProject("legacy-project"); assert.equal(plans.getState().session.messages[0].content, "迁移内容");
  assert.notEqual(fresh, "legacy-project");
});

test("plan context never auto-selects another project's newest report", async () => {
  globalThis.__projectDatabase = { records: [], citations: [], reports: [{ id: "unrelated-latest", title: "其他项目", mode: "ai", createdAt: "2026-10-31", blocks: [{ id: "score-0", heading: "技术实现", text: "其他项目条款" }] }] };
  const { getPlanContext } = await import("../src/modules/project-plan/server/context.ts");
  assert.equal((await getPlanContext(null)).reportId, null);
  assert.equal((await getPlanContext("missing")).criteria.length, 0);
  assert.equal((await getPlanContext("unrelated-latest")).criteria.length, 0);
});
