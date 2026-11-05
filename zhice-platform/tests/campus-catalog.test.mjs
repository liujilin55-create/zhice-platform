import "./register-paths.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import JSZip from "jszip";
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript,export async function getAiConfig(){return {enabled:false}}", shortCircuit: true };
  return nextResolve(specifier, context);
} });
const original = process.cwd(); const temporary = await mkdtemp(path.join(tmpdir(), "zhice-campus-catalog-")); process.chdir(temporary);
after(async () => { process.chdir(original); await rm(temporary, { recursive: true, force: true }); });
const { parseDirectory, parseCsv } = await import("../src/modules/campus-catalog/import.ts");
const { readCatalog, previewImport, commitImport, reviewRecord, registerTemplate, latestDirectory } = await import("../src/modules/campus-catalog/server/repository.ts");
const { directoryToCompetition } = await import("../src/modules/campus-catalog/adapter.ts");
const { resolveCompetition } = await import("../src/modules/campus-catalog/server/catalog.ts");
const { formalTemplate, defaultVisualConfig } = await import("../src/modules/campus-catalog/types.ts");
const { resolveRenderTemplate } = await import("../src/modules/campus-catalog/server/templates.ts");
const { extractPptStyle } = await import("../src/modules/campus-catalog/server/ppt-extractor.ts");
const { loadCompetitionSource, verifyCompetitionSource } = await import("../src/modules/competition-recommendation/server/sources.ts");
const { checkEligibility, matchCompetitions } = await import("../src/modules/competition-recommendation/matcher.ts");
const { renderPptx, confirmedChartData } = await import("../src/modules/ppt-generator/render.ts");
const { createAdminSession, adminCookieName } = await import("../src/lib/admin-auth.ts");
const { POST: adminPost, GET: adminGet } = await import("../src/app/api/admin/catalog/route.ts");
const { GET: publicGet } = await import("../src/app/api/catalog/route.ts");
const { POST: pptPost } = await import("../src/app/api/ppt/route.ts");
const fixture = { name: "独立测试赛事（非真实目录）", academicYear: "2026-2027", externalLevel: null, campusRecognitionLevel: "测试认定标签", colleges: ["测试学院"], majors: ["计算机"], grades: ["大二"], tracks: ["测试赛道"], campusRegistration: "测试用报名流程", campusDeadline: "2099-12-01T23:59:59+08:00", officialUrl: "https://example.org/contest", campusUrl: "https://example.org/campus-notice", sourceFile: "非真实目录-测试.json", sourcePage: 2, sourceText: "测试原文：技术实现评分要求提供可运行原型与完整测试证据。", keywords: ["AI"] };
const importRows = async (rows) => { const content = JSON.stringify(rows); const preview = await previewImport(content, "json"); return commitImport(content, "json", preview.token); };
const review = (target, status = "verified") => ({ target, status, note: "独立测试核对来源，不代表真实赛事核验结论。" });
const authHeaders = () => ({ "Content-Type": "application/json", cookie: `${adminCookieName}=${createAdminSession()}` });
const postAdmin = (body, authenticated = true) => adminPost(new Request("http://localhost/api/admin/catalog", { method: "POST", headers: authenticated ? authHeaders() : { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
let first; let second;

test("empty registry contains no invented real directory or award templates", async () => {
  assert.deepEqual(await readCatalog(), { revision: 0, records: [], templates: [] });
  const response = await publicGet(); assert.equal(response.status, 200); assert.deepEqual((await response.json()).data.competitions, []);
});
test("CSV parses BOM, quoted commas/newlines, Chinese headers and multi-value fields", () => {
  const csv = '\uFEFF比赛名称,学年度,外部赛事级别,适用学院,适用专业,来源文件名,来源页码,来源原文\r\n"测试,赛事",2026-2027,,学院甲;学院乙,计算机,测试文件.pdf,3,"第一行\n第二行"';
  const [row] = parseDirectory(csv, "csv"); assert.equal(row.name, "测试,赛事"); assert.equal(row.externalLevel, null); assert.deepEqual(row.colleges, ["学院甲", "学院乙"]); assert.equal(row.sourcePage, 3); assert(row.sourceText.includes("\n"));
  assert.throws(() => parseCsv('a,b\n"unfinished,b'), /未闭合/); assert.throws(() => parseCsv("a,a\n1,2"), /重复列名/);
  assert.throws(() => parseDirectory('[{"name":"x","academicYear":"2026-2028"}]', "json"), /连续/);
  assert.throws(() => parseDirectory(JSON.stringify([{ ...fixture, officialUrl: "javascript:alert(1)" }]), "json"), /HTTP/);
});
test("directory import starts pending even if input claims verified; unknown external levels remain unknown", async () => {
  const imported = await importRows([{ ...fixture, verificationStatus: "verified", lastVerified: "2026-01-01" }]); first = imported.added[0];
  assert.equal(first.verificationStatus, "pending"); assert.equal(first.lastVerified, null);
  const competition = directoryToCompetition(first); assert.equal(competition.level, "待核验"); assert.equal(competition.externalLevel, "待核验"); assert.equal(competition.scoringDimensions.length, 0); assert(competition.tracks.every((t) => t.verificationStatus === "pending"));
});
test("duplicates skip, stale preview rejects and editions keep immutable IDs and historical facts", async () => {
  const duplicate = await previewImport(JSON.stringify([fixture, fixture]), "json"); assert(duplicate.rows.every((r) => r.action === "skip"));
  const next = { ...fixture, campusRecognitionLevel: "另一测试认定标签" }; const preview = await previewImport(JSON.stringify([next]), "json"); assert(preview.rows[0].warnings.some((w) => w.includes("等级冲突")));
  await reviewRecord("competition", first.id, review("competition"));
  await assert.rejects(commitImport(JSON.stringify([next]), "json", preview.token), /变化/);
  second = (await importRows([next])).added[0]; assert.notEqual(second.id, first.id); assert.equal(second.version, 2); assert.equal(second.verificationStatus, "conflict");
  assert.equal((await resolveCompetition(first.id)).campusRecognitionLevel, fixture.campusRecognitionLevel); assert.equal((await resolveCompetition(second.id)).campusRecognitionLevel, next.campusRecognitionLevel);
  const year = await previewImport(JSON.stringify([{ ...fixture, academicYear: "2025-2026" }]), "json"); assert(year.rows[0].warnings.some((w) => w.includes("其他学年度"))); await importRows([{ ...fixture, academicYear: "2025-2026" }]);
  assert.equal(latestDirectory((await readCatalog()).records).length, 2);
});
test("independent review gates require sources and cannot verify unknown recognition or links", async () => {
  const [missing] = (await importRows([{ name: "缺来源测试", academicYear: "2026-2027" }])).added;
  await assert.rejects(reviewRecord("competition", missing.id, review("competition")), /缺少/); await assert.rejects(reviewRecord("competition", missing.id, review("officialLink")), /缺少/);
  const [unknown] = (await importRows([{ ...fixture, name: "未知等级测试", campusRecognitionLevel: "待核验" }])).added;
  await assert.rejects(reviewRecord("competition", unknown.id, review("recognition")), /缺少/);
  let r = await reviewRecord("competition", first.id, review("recognition")); assert.equal(r.verificationStatus, "pending");
  r = await reviewRecord("competition", first.id, review("officialLink")); assert.equal(r.verificationStatus, "verified"); assert(r.lastVerified); assert.equal(r.reviews.length, 3);
  r = await reviewRecord("competition", first.id, review("officialLink", "conflict")); assert.equal(r.verificationStatus, "conflict");
  r = await reviewRecord("competition", first.id, review("officialLink")); assert.equal(r.verificationStatus, "verified");
});
test("recognition materially improves ranking only after its independent verification; expiry cannot silently pass eligibility", async () => {
  const known = directoryToCompetition((await readCatalog()).records.find((r) => r.id === first.id)); const pending = directoryToCompetition(second);
  const input = { major: "计算机科学与技术", grade: "大二", interests: ["AI"], levelPreference: "不限", timePreference: "不限", profile: { school: "福建农林大学", grade: "大二", major: "计算机科学与技术", skills: [], hasTeam: false, teamSize: 1, teamCapabilities: "", mentors: "", resources: {}, weeklyHours: 10, budget: 100, competitionGoal: "获奖与学分认定" } };
  const result = matchCompetitions(input, [known, pending]); assert.equal(result[0].competitionId, known.competitionId); assert(result[0].matchScore - result[1].matchScore >= 20);
  const expired = { ...known, signupDeadline: "2000-01-01T00:00:00Z" }; assert.equal(checkEligibility(expired, input).eligible, false); assert.equal(checkEligibility(expired, { ...input, includeExpired: true }).eligible, true);
  assert.equal(checkEligibility({ ...known, gradeRestrictions: ["大四"] }, input).eligible, false);
});
test("imported notices resolve by exact historical competition and track without fetching unrelated newest data", async () => {
  const competition = await resolveCompetition(first.id); const track = competition.tracks[0].trackId;
  const loaded = await loadCompetitionSource(first.id, track, new AbortController().signal); assert.equal(loaded.source.kind, "campus"); assert.equal(loaded.source.text, fixture.sourceText); assert.equal(loaded.source.verificationStatus, "pending");
  const verified = await verifyCompetitionSource(first.id, track, { sourceId: loaded.source.sourceId, contentHash: loaded.source.contentHash, criteria: [{ title: "技术实现", quote: "技术实现评分要求提供可运行原型与完整测试证据。" }], confirm: true }); assert.equal(verified.criteria[0].origin, "campus");
  const missing = directoryToCompetition((await readCatalog()).records.find((r) => r.data.name === "缺来源测试")); const empty = await loadCompetitionSource(missing.id, missing.tracks[0].trackId, new AbortController().signal); assert.equal(empty.source, null); assert.equal(empty.criteria.length, 0);
});
test("all admin import, review and reference upload operations require administrator session", async () => {
  assert.equal((await adminGet(new Request("http://localhost/api/admin/catalog"))).status, 401);
  for (const action of ["preview", "import", "review", "template"]) assert.equal((await postAdmin({ action }, false)).status, 401);
  const preview = await postAdmin({ action: "preview", format: "json", content: JSON.stringify([fixture]) }); assert.equal(preview.status, 200); assert((await preview.json()).data.token);
});
test("school notification file plus exact page remains traceable without inventing a campus URL", async () => {
  const record = (await importRows([{ ...fixture, name: "仅文件来源的独立测试", campusUrl: null }])).added[0];
  const competition = await resolveCompetition(record.id); const track = competition.tracks[0].trackId;
  const loaded = await loadCompetitionSource(record.id, track, new AbortController().signal); assert.equal(loaded.source.url, null); assert(loaded.source.title.includes("第 2 页"));
  const verified = await verifyCompetitionSource(record.id, track, { sourceId: loaded.source.sourceId, contentHash: loaded.source.contentHash, criteria: [{ title: "技术实现", quote: "技术实现评分要求提供可运行原型与完整测试证据。" }], confirm: true });
  assert.equal(verified.source.verificationStatus, "verified"); assert.equal(verified.criteria[0].sourceUrl, null); assert.equal(verified.criteria[0].origin, "campus");
});
const templateData = (rights = "unknown") => ({ name: "独立测试自有版式", sourceCompetition: "独立测试赛事", year: 2026, sourceFile: "测试参考.pptx", sourceUrl: "https://example.org/reference", usageRights: rights, authorizationNote: rights === "unknown" ? "授权范围待核验" : "独立测试授权，明确允许提取衍生视觉规则", authorizationSource: rights === "unknown" ? null : "测试授权文件.pdf 第 1 页", type: "竞赛答辩", scenarios: ["技术答辩"], config: defaultVisualConfig });
test("unclear-rights and reference-only templates are server-blocked even after provenance review", async () => {
  for (const rights of ["unknown", "reference_only"]) {
    const t = await registerTemplate(templateData(rights)); assert.equal(formalTemplate(t), false); await reviewRecord("template", t.templateId, review("provenance"));
    await assert.rejects(reviewRecord("template", t.templateId, review("rights")), /授权/); await assert.rejects(resolveRenderTemplate(t.templateId), /禁止/);
  }
});
let authorized;
test("explicit provenance and rights reviews unlock an owned config; revocation blocks subsequent rendering", async () => {
  const t = await registerTemplate(templateData("derivation_allowed")); await reviewRecord("template", t.templateId, review("provenance")); authorized = await reviewRecord("template", t.templateId, review("rights"));
  assert(formalTemplate(authorized)); assert.equal((await resolveRenderTemplate(t.templateId)).templateId, t.templateId);
  await reviewRecord("template", t.templateId, review("rights", "expired")); await assert.rejects(resolveRenderTemplate(t.templateId), /禁止/);
  authorized = await reviewRecord("template", t.templateId, review("rights")); assert(formalTemplate(authorized));
});
test("PPTX extraction returns only normalized design rules and hash; private text and media are never persisted", async () => {
  const zip = new JSZip(); zip.file("ppt/slides/slide1.xml", '<p:sld><a:t>PRIVATE_AWARD_TEXT_DO_NOT_COPY</a:t><a:rPr sz="3200"/><a:srgbClr val="DA5577"/><a:latin typeface="TestFont"/></p:sld>'); zip.file("ppt/media/image1.png", Buffer.from("PRIVATE_LOGO_DO_NOT_COPY"));
  const file = new File([await zip.generateAsync({ type: "nodebuffer" })], "测试获奖参考.pptx"); const result = await extractPptStyle(file);
  assert.equal(result.slideCount, 1); assert.equal(result.config.colors.accent, "DA5577"); assert.equal(result.config.layouts.length, 11); assert.equal(result.sourceHash.length, 64); assert(!JSON.stringify(result).includes("PRIVATE_"));
  const form = new FormData(); form.set("file", file); form.set("metadata", JSON.stringify(templateData()));
  const response = await adminPost(new Request("http://localhost/api/admin/catalog", { method: "POST", headers: { cookie: `${adminCookieName}=${createAdminSession()}` }, body: form })); assert.equal(response.status, 200);
  const registry = await readFile(path.join(temporary, "data/campus-catalog.json"), "utf8"); assert(!registry.includes("PRIVATE_")); assert.equal((await readdir(path.join(temporary, "data"))).filter((s) => s.endsWith(".pptx")).length, 0);
  await assert.rejects(extractPptStyle(new File(["bad"], "bad.pdf")), /仅支持/);
});
test("native editable charts only use confirmed numeric facts with matching units", async () => {
  const chartSlide = { id: "chart", title: "验证数据", layout: "data", bullets: ["方案甲完成率为 82%。", "方案乙完成率为 75%。", "【待核验】预计收入 9999 元"], speakerNotes: "测试备注", claims: ["方案甲完成率为 82%。", "方案乙完成率为 75%。"].map((text) => ({ text, origin: "user", confirmed: true, blockIds: ["b"], chapterIds: ["c"], evidenceIds: [], sourceIds: [] })) };
  assert.deepEqual(confirmedChartData(chartSlide).map((r) => r.value), [82, 75]); assert.equal(confirmedChartData({ ...chartSlide, claims: [] }).length, 0);
  const outline = { title: "自有项目", subtitle: "平台原创内容", slides: [chartSlide, ...["cover", "process", "architecture", "closing"].map((layout) => ({ id: layout, title: "自有内容", bullets: ["仅来自用户计划书"], speakerNotes: "备注", layout }))] };
  const bytes = await renderPptx(outline, authorized.templateId, authorized.data.config); const zip = await JSZip.loadAsync(bytes);
  const chartFiles = Object.keys(zip.files).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name)); assert.equal(chartFiles.length, 1);
  const xml = await zip.file(chartFiles[0]).async("string"); assert(xml.includes("82")); assert(!xml.includes("9999")); assert(Object.keys(zip.files).some((n) => n.endsWith(".xlsx"))); assert(!Object.keys(zip.files).some((n) => n.startsWith("ppt/media/") && !zip.files[n].dir));
});
test("real PPT API rejects a forged unauthorized template and records authorized templateId/source/rights", async () => {
  const outline = { title: "测试项目", subtitle: "自有内容", slides: Array.from({ length: 5 }, (_, i) => ({ id: "s" + i, title: "测试页", bullets: ["自有内容"], speakerNotes: "演讲者备注", layout: i ? "content" : "cover" })) };
  const post = (template) => pptPost(new Request("http://localhost/api/ppt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "render", projectId: "test-project", outline, template, humanConfirmed: true }) }));
  const pending = (await readCatalog()).templates.find((t) => t.data.usageRights === "unknown"); assert.equal((await post(pending.templateId)).status, 400);
  const response = await post(authorized.templateId); assert.equal(response.status, 200); const history = (await response.json()).history; assert.equal(history.templateId, authorized.templateId); assert.equal(history.templateVersion, 1); assert(history.templateAuthorization.includes("测试授权文件")); assert(history.templateSource.includes("测试参考.pptx"));
});
