import "./register-paths.mjs";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { registerHooks } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript,export async function getAiConfig(){return globalThis.__bindingConfig || {enabled:false}}", shortCircuit: true };
  if (specifier === "@/modules/evidence-center/server") return { url: "data:text/javascript,export async function readEvidenceDatabase(){return globalThis.__bindingDatabase};export async function captureAnalysis(result){globalThis.__lastBoundAnalysis=result;return {reportId:result.reportId,evidenceIds:[]}}", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const originalCwd = process.cwd(); const temporary = await mkdtemp(path.join(tmpdir(), "zhice-competition-binding-"));
process.chdir(temporary);
after(async () => { process.chdir(originalCwd); await rm(temporary, { recursive: true, force: true }); });
const { competitions, findCompetition } = await import("../src/modules/competition-recommendation/data.ts");
const { checkEligibility, matchCompetitions } = await import("../src/modules/competition-recommendation/matcher.ts");
const { useWorkspaceStore: workspace } = await import("../src/modules/workspace/workspace.store.ts");
const { emptyStudentProfile, projectBinding, projectScopeKey } = await import("../src/modules/workspace/types.ts");
const { useProjectPlanStore: plans } = await import("../src/modules/project-plan/plan.store.ts");
const { useTaskStore: tasks } = await import("../src/modules/task-orchestration/task.store.ts");
const { emptySurveySession } = await import("../src/modules/project-plan/types.ts");
const { loadCompetitionSource, verifyCompetitionSource, flagCompetitionSourceConflict } = await import("../src/modules/competition-recommendation/server/sources.ts");
const { getPlanContext } = await import("../src/modules/project-plan/server/context.ts");
const { runSurvey, runReport } = await import("../src/modules/project-plan/server/generator.ts");
const { POST } = await import("../src/app/api/project-plan/route.ts");
const profile = { ...emptyStudentProfile(), college: "测试学院", major: "计算机科学与技术", competitionGoal: "AI 研究获奖与学分认定", skills: ["Python", "Web", "AI"], hasTeam: true, teamSize: 3, teamCapabilities: "软件工程与计算机开发", mentors: "人工智能导师", resources: { ...emptyStudentProfile().resources, labs: "计算机实验室", equipment: "硬件设备" }, weeklyHours: 12, budget: 500 };
const binding = { projectId: "fixture-project", competitionId: "computer-design", trackId: "computer-design-general", revision: "revision-a" };
const input = { major: profile.major, grade: "大二", interests: ["AI", "算法"], levelPreference: "国家级", timePreference: "不限", profile, now: "2026-10-31T00:00:00Z" };
const officialText = "本通知用于独立测试。技术实现评分需展示核心算法、可运行原型和可复核测试结果。创新性评分应说明与已有方案的差异，并提供对照实验。";
let source;
const planWorkspace = (patch = {}) => ({ binding, studentProfile: profile, selectionConfirmedAt: null, reportId: null, intent: "draft", ...patch });
function completeSession() { const session = emptySurveySession(); session.complete = true; session.currentSlot = null; session.binding = binding; for (const slot of Object.values(session.slots)) { slot.value = "测试项目事实与可复核验证结果"; slot.status = "captured"; } return session; }
const post = (input) => POST(new Request("http://localhost/api/project-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
function events(text) { return text.split("\n\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6))); }

test("catalog keeps demo dates, recognition and tracks pending rather than inventing official facts", () => {
  for (const item of competitions) { assert.equal(item.competitionId, item.id); assert.equal(item.verificationStatus, "pending"); assert.equal(item.lastVerified, null); assert.equal(item.campusRecognitionLevel, null); assert.equal(item.signupDeadline, null); assert(item.tracks.every((track) => track.verificationStatus === "pending")); }
});
test("verified eligibility hard-filters grades, majors, team bounds and registration windows before ranking", () => {
  const known = { ...competitions[0], dataMode: "curated", verificationStatus: "verified", gradeRestrictions: ["大二"], majorRestrictions: ["计算机"], teamSize: { min: 2, max: 4 }, signupStart: "2026-10-01", signupDeadline: "2026-12-01", registrationStatus: "open" };
  assert(checkEligibility(known, input).eligible);
  for (const change of [{ gradeRestrictions: ["大三"] }, { majorRestrictions: ["农学"] }, { teamSize: { min: 4, max: 5 } }, { teamSize: { min: 1, max: 2 } }, { registrationStatus: "closed" }, { signupDeadline: "2026-10-01" }, { signupStart: "2026-12-01" }]) {
    assert(!checkEligibility({ ...known, ...change }, input).eligible); assert.equal(matchCompetitions(input, [{ ...known, ...change }]).length, 0);
  }
  const unknownTeam = checkEligibility(known, { ...input, profile: { ...profile, teamSize: null } }); assert(unknownTeam.warnings.some((item) => item.includes("团队人数")));
  assert(checkEligibility(competitions[0], input).warnings.length > 0);
});
test("ranking accounts for skills, team, mentor, resources, time, budget, recognition and goal", () => {
  const known = { ...competitions[1], dataMode: "curated", verificationStatus: "verified", campusRecognitionLevel: "测试等级", recognitionYear: 2026, campusSourceUrl: "https://example.invalid/campus", fit: { ...competitions[1].fit, skills: ["Python", "AI"], team: ["计算机"], mentor: ["人工智能"], resources: ["计算机"], weeklyHours: 10, budget: 300, goals: ["AI"] } };
  const result = matchCompetitions(input, [known])[0];
  for (const label of ["专业标签匹配", "技能基础", "团队能力", "导师支持", "资源基础", "时间投入", "预算适配", "校内认定", "参赛目标"]) assert(result.reasons.some((item) => item.label === label), label);
  const limited = matchCompetitions({ ...input, profile: { ...profile, weeklyHours: 2, budget: 0, mentors: "", skills: [], teamCapabilities: "", hasTeam: false, competitionGoal: "体验", resources: emptyStudentProfile().resources } }, [known])[0];
  assert(result.matchScore > limited.matchScore); assert(["高匹配", "提升型", "挑战型"].includes(result.category));
});
test("changing competition archives old plan and detaches reports; delayed results cannot attach to the new selection", async () => {
  const first = workspace.getState().newProject("绑定项目 A", profile); workspace.getState().selectCompetition("computer-design");
  const oldBinding = projectBinding(workspace.getState().project); const oldScope = projectScopeKey(workspace.getState().project);
  plans.getState().setSession({ ...emptySurveySession(), binding: oldBinding, messages: [{ id: "a", role: "user", content: "仅属于旧比赛", createdAt: new Date().toISOString() }] });
  workspace.getState().linkReport("old-report", "旧比赛", first, oldBinding);
  tasks.getState().setTasks(() => [{ id: "task-old", title: "旧比赛任务", description: "fixture", owner: "测试", due: "待定", tag: "技术", priority: "high", status: "active", sample: false, dependencies: [], checklist: [] }]);
  workspace.getState().selectCompetition("math-modeling");
  assert.equal(workspace.getState().project.reportId, null); assert.equal(workspace.getState().project.competitionConfirmedAt, null); assert.equal(plans.getState().session.messages.length, 0); assert.deepEqual(tasks.getState().tasks, []);
  assert.equal(plans.getState().byProject[oldScope].session.messages[0].content, "仅属于旧比赛");
  workspace.getState().linkReport("late-old-report", "迟到结果", first, oldBinding); assert.equal(workspace.getState().project.reportId, null);
  assert.equal(workspace.getState().project.studentProfile.major, profile.major);
  const second = workspace.getState().newProject("绑定项目 B", profile); workspace.getState().selectCompetition("computer-design");
  assert.equal(plans.getState().session.messages.length, 0); await workspace.persist.rehydrate(); await plans.persist.rehydrate(); await tasks.persist.rehydrate(); workspace.getState().setReady();
  assert.equal(workspace.getState().currentProjectId, second); assert.equal(workspace.getState().project.selectedTrackId, "computer-design-general");
  workspace.getState().switchProject(first); assert.equal(workspace.getState().project.selectedCompetitionId, "math-modeling"); assert.equal(plans.getState().session.messages.length, 0);
});
test("official retrieval remains pending; verification requires unchanged source hash and exact original quotations", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => { assert(String(url).startsWith("https://jsjds.blcu.edu.cn/")); return new Response("<html><body><p>" + officialText + "</p></body></html>", { headers: { "Content-Type": "text/html" } }); };
  try { source = await loadCompetitionSource(binding.competitionId, binding.trackId, new AbortController().signal); } finally { globalThis.fetch = original; }
  assert.equal(source.source.verificationStatus, "pending"); assert.deepEqual(source.criteria, []);
  const request = { sourceId: source.source.sourceId, contentHash: source.source.contentHash, criteria: [{ title: "技术实现", quote: "技术实现评分需展示核心算法、可运行原型和可复核测试结果。" }], confirm: true };
  await assert.rejects(verifyCompetitionSource(binding.competitionId, binding.trackId, { ...request, contentHash: "changed" }));
  await assert.rejects(verifyCompetitionSource(binding.competitionId, binding.trackId, { ...request, criteria: [{ title: "虚构", quote: "不存在的评分规则不能作为官方标准" }] }));
  source = await verifyCompetitionSource(binding.competitionId, binding.trackId, request);
  assert.equal(source.source.verificationStatus, "verified"); assert.equal(source.criteria[0].text, request.criteria[0].quote);
});
test("context ignores foreign reports and AI/demo score blocks, and keeps upload override pending", async () => {
  globalThis.__bindingDatabase = { records: [], citations: [], reports: [{ id: "foreign", binding: { ...binding, projectId: "other-project" }, mode: "ai", sources: [], blocks: [{ id: "score-0", heading: "虚构评分点", text: "不能使用" }] }] };
  const foreign = await getPlanContext("foreign", planWorkspace({ reportId: "foreign" }));
  assert.equal(foreign.reportId, null); assert(!foreign.criteria.some((item) => item.title.includes("虚构"))); assert(foreign.warnings.some((item) => item.includes("已排除")));
  globalThis.__bindingDatabase.reports.push({ id: "demo-current", binding, mode: "demo", sources: [source.source], blocks: [{ id: "score-0", heading: "AI虚构评分点", text: "不能用" }] });
  const current = await getPlanContext("demo-current", planWorkspace({ reportId: "demo-current" }));
  assert.equal(current.criteria.length, 1); assert.equal(current.criteria[0].title, "技术实现"); assert(current.warnings.some((item) => item.includes("演示")));
  globalThis.__bindingDatabase.reports.push({ id: "override", binding, mode: "ai", sources: [{ ...source.source, sourceId: "upload-only", kind: "upload", verificationStatus: "pending", url: null }], blocks: [] });
  const override = await getPlanContext("override", planWorkspace({ reportId: "override" })); assert.equal(override.criteria.length, 0); assert.equal(override.verificationStatus, "pending");
});
test("formal generation requires a confirmed competition, verified track and verified official scoring clauses", async () => {
  const session = completeSession();
  assert.equal((await post({ action: "report", session })).status, 400);
  assert.equal((await post({ action: "report", session, workspace: planWorkspace({ intent: "formal" }) })).status, 409);
  assert.equal((await post({ action: "report", session, workspace: planWorkspace({ intent: "formal", selectionConfirmedAt: new Date().toISOString() }) })).status, 409);
  const track = findCompetition(binding.competitionId).tracks[0]; const previous = track.verificationStatus; track.verificationStatus = "verified";
  try {
    const response = await post({ action: "report", session, workspace: planWorkspace({ intent: "formal", selectionConfirmedAt: new Date().toISOString() }) }); assert.equal(response.status, 200);
    const report = events(await response.text()).find((item) => item.type === "report").report;
    assert.equal(report.generationStatus, "formal"); assert.equal(report.projectId, binding.projectId); assert.equal(report.competitionId, binding.competitionId); assert(report.reportId.startsWith("plan-report-"));
    assert.equal(report.alignment[0].sourceQuote, source.criteria[0].text);
  } finally { track.verificationStatus = previous; }
});
test("local dynamic questions use the current competition, profile and real verified clause", async () => {
  const output = []; await runSurvey(emptySurveySession(), "构建面向大学生的算法交互学习平台", null, new AbortController().signal, (event) => output.push(event), planWorkspace());
  const turn = output.find((item) => item.type === "survey"); assert(turn.turn.reply_to_user.includes("中国大学生计算机设计大赛")); assert(turn.turn.reply_to_user.includes(profile.major)); assert(turn.turn.reply_to_user.includes(source.criteria[0].text)); assert.equal(turn.session.slots.goal.value, profile.competitionGoal); assert.equal(turn.session.binding.projectId, binding.projectId);
});
test("AI report prompt receives the binding/profile; hallucinated scoring names are discarded and source provenance is server-owned", async () => {
  const original = globalThis.fetch; const encoder = new TextEncoder(); let prompt;
  globalThis.__bindingConfig = { enabled: true, apiKey: "fixture", baseUrl: "https://fixture.invalid/v1", model: "fixture", systemPrompt: "测试", temperature: 0, maxTokens: 3000 };
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://fixture.invalid/v1/chat/completions"); prompt = init.body;
    const report = { completeness: [], alignment: [{ criterion: "AI编造的评分标准", coverage: "covered", detail: "假的", missing: "无", action: "忽略" }], risks: [{ question: "如何验证？", suggestion: "对照实验" }], chapters: [], summary: "fixture" };
    const chunk = { id: "fixture", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta: { content: JSON.stringify(report) }, finish_reason: "stop" }] };
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode("data: " + JSON.stringify(chunk) + "\n\ndata: [DONE]\n\n")); controller.close(); } }), { headers: { "Content-Type": "text/event-stream" } });
  };
  try {
    const output = []; await runReport(completeSession(), null, new AbortController().signal, (event) => output.push(event), planWorkspace());
    assert(prompt.includes(profile.major)); assert(prompt.includes(binding.competitionId) || prompt.includes("中国大学生计算机设计大赛"));
    const report = output.find((item) => item.type === "report").report; assert.equal(report.mode, "ai"); assert(!report.alignment.some((item) => item.criterion.includes("编造"))); assert.equal(report.alignment[0].sourceId, source.source.sourceId);
  } finally { globalThis.fetch = original; globalThis.__bindingConfig = null; }
});
test("API rejects an old competition survey or report even with a valid current workspace", async () => {
  const stale = completeSession(); stale.binding = { ...binding, competitionId: "math-modeling", trackId: "math-modeling-general" };
  assert.equal((await post({ action: "report", session: stale, workspace: planWorkspace() })).status, 409);
});

test("requirements API binds automatic official input and upload override without inventing fallback facts", async () => {
  const { POST: requirementsPost } = await import("../src/app/api/competition-requirements/route.ts");
  const original = globalThis.fetch; globalThis.fetch = async (url) => { assert(String(url).includes("api.semanticscholar.org")); return Response.json({ data: [] }); };
  const request = (body) => requirementsPost(new Request("http://localhost/api/competition-requirements", { method: "POST", body }));
  try {
    assert.equal((await request(new FormData())).status, 400);
    const official = new FormData(); official.append("binding", JSON.stringify(binding)); official.append("sourceId", source.source.sourceId);
    const result = await (await request(official)).json();
    assert.equal(result.mode, "demo"); assert.equal(result.competitionId, binding.competitionId); assert.equal(result.projectId, binding.projectId); assert.equal(result.reportId, result.traceability.reportId); assert.equal(result.sourceId, source.source.sourceId);
    assert.equal(result.requirements.title, "中国大学生计算机设计大赛"); assert.deepEqual(result.requirements.deliverables, []); assert.deepEqual(result.requirements.timeline, []);
    assert(result.requirements.scoringCriteria.every((item) => source.source.text.includes(item)));
    const zip = new JSZip(); zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'); zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>用户补充的项目资料，评分标准尚不明确。</w:t></w:r></w:p></w:body></w:document>');
    const upload = new FormData(); upload.append("binding", JSON.stringify(binding)); upload.append("sourceMode", "override"); upload.append("file", new Blob([await zip.generateAsync({ type: "uint8array" })]), "fixture.docx");
    const replacement = await (await request(upload)).json(); assert.equal(replacement.sources.length, 1); assert.equal(replacement.sources[0].kind, "upload"); assert.equal(replacement.binding.verificationStatus, "pending"); assert.deepEqual(replacement.scoringClauses, []); assert.deepEqual(replacement.requirements.scoringCriteria, []);
  } finally { globalThis.fetch = original; }
});
test("reported source conflicts are visible and block formal output until exact clauses are reverified", async () => {
  const result = await flagCompetitionSourceConflict(binding.competitionId, binding.trackId, { sourceId: source.source.sourceId, contentHash: source.source.contentHash, reason: "测试另一份资料的评分细则与本届年份存在冲突", confirm: true });
  assert.equal(result.source.verificationStatus, "conflict");
  const context = await getPlanContext(null, planWorkspace({ selectionConfirmedAt: new Date().toISOString(), intent: "formal" }));
  assert.equal(context.verificationStatus, "conflict"); assert.equal(context.canGenerateFormal, false); assert.equal(context.criteria.length, 0);
  globalThis.__bindingDatabase.reports.push({ id: "before-conflict", binding, mode: "ai", sources: [source.source], blocks: [] });
  const existingReport = await getPlanContext("before-conflict", planWorkspace({ reportId: "before-conflict", selectionConfirmedAt: new Date().toISOString(), intent: "formal" }));
  assert.equal(existingReport.verificationStatus, "conflict"); assert.equal(existingReport.sources[0].verificationStatus, "conflict"); assert.equal(existingReport.canGenerateFormal, false);
  const { POST: requirementsPost } = await import("../src/app/api/competition-requirements/route.ts");
  const original = globalThis.fetch; globalThis.fetch = async (url) => { assert(String(url).includes("api.semanticscholar.org")); return Response.json({ data: [] }); };
  try {
    const body = new FormData(); body.append("binding", JSON.stringify(binding)); body.append("sourceId", result.source.sourceId);
    const analysis = await (await requirementsPost(new Request("http://localhost/api/competition-requirements", { method: "POST", body }))).json();
    assert.equal(analysis.binding.verificationStatus, "conflict"); assert(analysis.warnings.some((warning) => warning.includes("来源存在冲突")));
  } finally { globalThis.fetch = original; }
});
