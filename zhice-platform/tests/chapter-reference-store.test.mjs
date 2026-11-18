import "./register-paths.mjs";
import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "./plan.store" && context.parentURL?.endsWith("/chapter-reference.store.ts")) return nextResolve(new URL("./plan.store.ts", context.parentURL).href, context);
  return nextResolve(specifier, context);
} });

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
const { useChapterReferenceStore: references, applyChapterReference } = await import("../src/modules/project-plan/chapter-reference.store.ts");
const { chapterReferenceContextKey } = await import("../src/modules/project-plan/reference-context.ts");
const { useProjectPlanStore: plans } = await import("../src/modules/project-plan/plan.store.ts");
const { emptySurveySession, planContextSchema } = await import("../src/modules/project-plan/types.ts");
const { workspaceProjectSchema, emptyStudentProfile, projectScopeKey, projectBinding } = await import("../src/modules/workspace/types.ts");
const { confirmedBlocks } = await import("../src/shared/contracts/plan-document.ts");

const now = "2026-11-17T01:00:00.000Z";
const storageKey = "zhice:chapter-references:v1";
const chapterId = "executive-summary";

function fixture() {
  const project = workspaceProjectSchema.parse({
    projectId: "reference-project-a", name: "竹纤维育苗容器研究", studentProfile: {
      ...emptyStudentProfile(), school: "测试大学", college: "材料学院", major: "材料工程", competitionGoal: "完成可核对的方案",
    },
    selectedCompetitionId: "reference-competition", selectedTrackId: "reference-red-tour", selectionRevision: "selection-a", competitionConfirmedAt: now,
    projectStage: "idea", reportId: null, documentStatus: "draft", pptStatus: "not_started", createdAt: now, updatedAt: now,
    preparation: { topicId: "bamboo-nursery", topicTitle: "竹纤维育苗容器研究", answers: { equipment: "设备待协调" }, research: [{ title: "育苗容器参考论文", url: "https://example.org/paper", excerpt: "湿态强度需要验证。", kind: "paper", source: "测试资料" }] },
  });
  const binding = projectBinding(project);
  const scopeKey = projectScopeKey(project);
  project.preparation.topicBinding = scopeKey;
  project.preparation.topicConfirmedAt = now;
  const session = emptySurveySession();
  session.binding = binding;
  session.slots.technicalRoute.value = "先开展需求访谈，再设计对照试验。";
  session.slots.technicalRoute.status = "captured";
  const context = planContextSchema.parse({
    binding, competitionName: "测试创新比赛", trackName: "红旅赛道", studentProfile: project.studentProfile,
    reportId: null, title: project.name, mode: null, preparation: project.preparation, verificationStatus: "verified",
    sources: [{ sourceId: "reference-source", competitionId: binding.competitionId, trackId: binding.trackId, title: "测试赛事要求", kind: "official", url: "https://example.org/rules", text: "说明真实需求与验证方法。", contentHash: "source-hash-a", verificationStatus: "verified", lastVerified: now, fetchedAt: now, warnings: [] }],
    criteria: [{ id: "reference-criterion", title: "需求与验证", text: "说明真实需求与验证方法。", sourceId: "reference-source", sourceUrl: "https://example.org/rules", verificationStatus: "verified", origin: "official" }],
    evidence: [{ id: "paper-a", title: "育苗容器参考论文", source: "测试资料", excerpt: "湿态强度需要验证。", kind: "academicPaper", href: "https://example.org/paper" }],
  });
  return { project, binding, scopeKey, session, context, instructions: "强调验证方法，避免假设已有实验结果。", currentContent: "用户已经写好的项目摘要。" };
}

function keyOf(input) {
  return chapterReferenceContextKey(input.project, input.session, input.instructions, input.context, input.currentContent);
}

function candidate(input, patch = {}) {
  return {
    chapter: { id: chapterId, title: "项目摘要", binding: input.binding, content: "【已生成】项目围绕育苗容器开展研究。\n【AI推断，请核验】拟比较不同成型方案。\n【建议补充】实测性能：____。", status: "draft", generationStatus: "draft", mode: "ai", sourceIds: ["reference-source"], evidenceIds: ["paper-a"], updatedAt: now, ...patch },
    contextKey: keyOf(input), instructions: input.instructions,
  };
}

function activate(input, initialContent = input.currentContent) {
  plans.getState().activateProject(input.project.projectId, input.scopeKey);
  plans.getState().setSession(input.session);
  plans.getState().setDocumentContext(input.project.name, input.binding, input.context.sources, input.context.criteria);
  if (initialContent) plans.getState().upsertChapter({ id: chapterId, title: "项目摘要", binding: input.binding, content: initialContent, status: "draft", generationStatus: "draft", mode: "local", sourceIds: [], evidenceIds: [], updatedAt: now }, "user");
}

function documentSnapshot() {
  const state = plans.getState();
  return structuredClone({ chapters: state.chapters, document: state.document, versions: state.versions });
}

beforeEach(() => {
  references.setState({ byScope: {}, instructionsByScope: {}, hydrated: false });
  plans.setState({ projectId: null, scopeKey: null, byProject: {}, session: emptySurveySession(), chapters: {}, document: null, versions: [], activeChapterId: null });
  storage.clear();
});

test("successful AI preview is stored separately and does not change user text or document versions", () => {
  const input = fixture();
  activate(input);
  const before = documentSnapshot();
  assert.equal(references.getState().saveReference(input.scopeKey, candidate(input)), true);
  assert.deepEqual(documentSnapshot(), before);
  assert.equal(references.getState().byScope[input.scopeKey][chapterId].chapter.mode, "ai");
  assert.equal(references.getState().byScope[input.scopeKey][chapterId].chapter.content, candidate(input).chapter.content);
});

test("explicit adoption preserves the previous editable version and keeps facts and sources unconfirmed", () => {
  const input = fixture();
  input.context.sources[0].verificationStatus = "pending";
  input.context.criteria[0].verificationStatus = "pending";
  activate(input);
  const previous = structuredClone(plans.getState().document);
  const preview = candidate(input);
  references.getState().saveReference(input.scopeKey, preview);
  assert.equal(applyChapterReference(input.scopeKey, chapterId, preview.contextKey), true);
  const next = plans.getState();
  assert.equal(next.chapters[chapterId].content, preview.chapter.content);
  assert(next.versions.some((document) => document.version === previous.version && document.chapters.find((chapter) => chapter.id === chapterId)?.userContent === input.currentContent));
  assert.equal(next.chapters[chapterId].status, "draft");
  assert.equal(next.chapters[chapterId].generationStatus, "draft");
  assert.equal(next.document.confirmed, false);
  assert.equal(confirmedBlocks(next.document).length, 0);
  assert.equal(next.document.sources[0].verificationStatus, "pending");
  assert.equal(next.document.scoringRequirements[0].verificationStatus, "pending");
  assert.equal(next.document.chapters.find((chapter) => chapter.id === chapterId).blocks.some((block) => block.marker === "inference"), true);
  assert.deepEqual(references.getState().byScope[input.scopeKey][chapterId].chapter, preview.chapter);
});

test("adoption rejects stale keys, another chapter, foreign project and mismatched selection without mutating text", () => {
  const input = fixture();
  activate(input);
  const preview = candidate(input);
  references.getState().saveReference(input.scopeKey, preview);
  const before = documentSnapshot();
  assert.equal(applyChapterReference(input.scopeKey, chapterId, "outdated-context"), false);
  assert.equal(applyChapterReference(input.scopeKey, "technical-route", preview.contextKey), false);
  assert.deepEqual(documentSnapshot(), before);

  const other = fixture();
  other.project.projectId = "reference-project-b";
  other.binding = projectBinding(other.project);
  other.scopeKey = projectScopeKey(other.project);
  activate(other, "另一个项目的正文");
  const otherBefore = documentSnapshot();
  assert.equal(applyChapterReference(input.scopeKey, chapterId, preview.contextKey), false);
  assert.equal(references.getState().saveReference(other.scopeKey, preview), false);
  assert.deepEqual(documentSnapshot(), otherBefore);

  plans.getState().activateProject(input.project.projectId, input.scopeKey);
  const mismatchedBinding = { ...input.binding, trackId: "another-track", revision: "selection-b" };
  plans.getState().setDocumentContext(input.project.name, mismatchedBinding, [], []);
  const differentTrackBefore = documentSnapshot();
  assert.equal(applyChapterReference(input.scopeKey, chapterId, preview.contextKey), false);
  assert.deepEqual(documentSnapshot(), differentTrackBefore);
});

test("every supported chapter can keep its own AI template while local, empty or confirmed outputs are rejected", () => {
  const input = fixture();
  const ids = ["executive-summary", "project-intro", "market-analysis", "product-design", "technical-route", "team", "business-model", "finance", "risk-response", "conclusion"];
  for (const id of ids) assert.equal(references.getState().saveReference(input.scopeKey, candidate(input, { id, content: `【建议补充】${id} 的专属内容：____。` })), true, id);
  assert.equal(Object.keys(references.getState().byScope[input.scopeKey]).length, 10);
  for (const patch of [{ mode: "local" }, { status: "confirmed" }, { generationStatus: "formal" }, { content: "  " }, { binding: undefined }, { id: "unknown-chapter" }]) {
    const before = structuredClone(references.getState().byScope);
    assert.equal(references.getState().saveReference(input.scopeKey, candidate(input, patch)), false, JSON.stringify(patch));
    assert.deepEqual(references.getState().byScope, before);
  }
});

test("reference versions change with current choices, writing inputs, chapter text and effective sources", () => {
  const input = fixture();
  const original = keyOf(input);
  const changes = [
    (copy) => { copy.project.selectedCompetitionId = "another-competition"; },
    (copy) => { copy.project.selectedTrackId = "another-track"; },
    (copy) => { copy.project.selectionRevision = "new-selection"; },
    (copy) => { copy.project.preparation.topicTitle = "竹纤维缓冲包装研究"; },
    (copy) => { copy.project.preparation.answers.equipment = "可申请压缩试验机"; },
    (copy) => { copy.project.studentProfile.resources.equipment = "需预约湿态测试设备"; },
    (copy) => { copy.session.slots.technicalRoute.value = "用户修改了对照试验路线"; },
    (copy) => { copy.session.slots.technicalRoute.status = "needsVerification"; },
    (copy) => { copy.instructions = "改为面向苗圃负责人的口吻"; },
    (copy) => { copy.currentContent = "用户更新后的正文"; },
    (copy) => { copy.project.preparation.research[0].excerpt = "更新的论文摘录"; },
    (copy) => { copy.context.sources[0].contentHash = "changed-source"; },
    (copy) => { copy.context.sources[0].verificationStatus = "conflict"; },
    (copy) => { copy.context.criteria[0].text = "新的本届要求原句"; },
    (copy) => { copy.context.evidence[0].excerpt = "更新依据原文"; },
  ];
  for (const change of changes) {
    const changed = structuredClone(input);
    change(changed);
    assert.notEqual(keyOf(changed), original, change.toString());
  }
});

test("custom directions without preset IDs invalidate references and unrelated timestamps do not", () => {
  const input = fixture();
  input.project.preparation.topicId = null;
  input.project.preparation.topicTitle = "用户自定义的社区服务方案";
  const original = keyOf(input);
  const changed = structuredClone(input);
  changed.project.preparation.topicTitle = "用户修改后的社区出行服务";
  assert.notEqual(keyOf(changed), original);
  const newPaper = structuredClone(input);
  newPaper.project.preparation.research[0].url = "https://example.org/new-paper";
  assert.notEqual(keyOf(newPaper), original);

  const later = structuredClone(input);
  later.project.updatedAt = "2026-11-17T03:00:00.000Z";
  later.project.createdAt = "2026-11-17T02:00:00.000Z";
  later.session.updatedAt = "2026-11-17T03:00:00.000Z";
  later.context.sources[0].fetchedAt = "2026-11-17T03:00:00.000Z";
  later.instructions = `  ${input.instructions}  `;
  assert.equal(keyOf(later), original);
  const wrongContext = structuredClone(input.context);
  wrongContext.binding.projectId = "foreign-project";
  assert.equal(chapterReferenceContextKey(input.project, input.session, input.instructions, wrongContext, input.currentContent), chapterReferenceContextKey(input.project, input.session, input.instructions, null, input.currentContent));
});

test("AI previews and per-chapter instructions survive reload without filling the document", async () => {
  const input = fixture();
  activate(input);
  const documentBefore = documentSnapshot();
  references.getState().saveReference(input.scopeKey, candidate(input));
  references.getState().setInstructions(input.scopeKey, chapterId, input.instructions);
  references.getState().setInstructions(input.scopeKey, "technical-route", "提供对照试验模板");
  const saved = storage.get(storageKey);
  const original = structuredClone({ byScope: references.getState().byScope, instructionsByScope: references.getState().instructionsByScope });
  references.setState({ byScope: {}, instructionsByScope: {} });
  storage.set(storageKey, saved);
  await references.persist.rehydrate();
  assert.deepEqual(references.getState().byScope, original.byScope);
  assert.deepEqual(references.getState().instructionsByScope, original.instructionsByScope);
  assert.deepEqual(documentSnapshot(), documentBefore);
});

test("hydration excludes malformed, foreign-scope and mislabelled chapter references", async () => {
  const input = fixture();
  const valid = { ...candidate(input), createdAt: now };
  storage.set(storageKey, JSON.stringify({ state: { byScope: {
    [input.scopeKey]: {
      [chapterId]: valid,
      "technical-route": valid,
      finance: { ...valid, chapter: { ...valid.chapter, id: "finance", mode: "local" } },
      team: { ...valid, chapter: { ...valid.chapter, id: "team", status: "confirmed" } },
      conclusion: { ...valid, chapter: { ...valid.chapter, id: "conclusion" }, createdAt: "invalid-date" },
    },
    "foreign-scope": { [chapterId]: valid },
  }, instructionsByScope: {} }, version: 0 }));
  await references.persist.rehydrate();
  assert.deepEqual(Object.keys(references.getState().byScope[input.scopeKey]), [chapterId]);
  assert.deepEqual(references.getState().byScope["foreign-scope"], {});
  assert.equal(plans.getState().document, null);
  assert.deepEqual(plans.getState().chapters, {});
});
