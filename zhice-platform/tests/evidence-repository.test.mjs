import "./register-paths.mjs";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

// Exercise the server repository in a disposable directory. Never touch the
// running project's evidence, administrator config or provider credentials.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier.startsWith(".") && !path.extname(specifier)) {
      try { return nextResolve(specifier + ".ts", context); } catch { /* Defer real module failures. */ }
    }
    return nextResolve(specifier, context);
  },
});
const workspace = process.cwd();
const temporary = await mkdtemp(path.join(tmpdir(), "zhice-evidence-"));
process.chdir(temporary);
const repository = await import("../src/modules/evidence-center/server/repository.ts");
const { captureAnalysis } = await import("../src/modules/evidence-center/server/capture-analysis.ts");

test("analysis capture persists exact originals and creates reciprocal report links; concurrent writes preserve both statuses", async () => {
  try {
    const text = "比赛通知\n技术实现评分占 30 分。\n提交时间请查看官方通知。";
    const result = {
      mode: "demo",
      file: { name: "实际规则.docx", parser: "Mammoth DOCX 文本解析" },
      requirements: { title: "测试竞赛", keywords: ["RAG"] },
      report: {
        overview: "规则兜底报告，待核验",
        topicDirections: [{ title: "校园助手", reason: "待确认", expectedOutput: "Web" }],
        technicalRoute: ["用 RAG 组织证据"], scoringSuggestions: [{ criterion: "技术实现", action: "做对照实验" }],
        innovationPoints: ["双向引用"], plan: [{ phase: "第一阶段", days: "1-2 天", tasks: ["核验规则"] }], risks: ["时间待核对"],
      },
      papers: [{
        title: "Test paper", url: "https://example.com/paper", year: 2026,
        authors: ["Test author"], source: "Semantic Scholar",
        abstract: "Original abstract.", matchedKeywords: ["RAG"], relevanceScore: 90,
      }],
    };
    const captured = await captureAnalysis(result, text);
    const report = await repository.getEvidenceReport(captured.reportId);
    assert(report);
    assert.equal(report.data.mode, "demo");
    const rules = report.evidence.find((record) => record.kind === "competitionRule");
    assert.equal(rules.body, text);
    assert.equal(rules.ruleItems[0].text, "技术实现评分占 30 分。");
    assert(rules.ruleItems[0].page.includes("待核对"));
    assert(rules.citations.some((link) => link.href.includes(captured.reportId)));
    assert(report.citations.some((link) => link.evidenceId === rules.id));
    assert(report.citations.every((link) => link.verification === "pending"));
    assert(captured.links.overview.includes(rules.id));
    assert(captured.links["reference-0"].length > 0);
    assert(captured.links["route-0"].length > 0);
    assert.deepEqual(captured.links["topic-0"], []);
    assert(report.evidence.find((record) => record.kind === "academicPaper").sourceMode === "external");
    await Promise.all([
      repository.setEvidenceStatus("paper-agent-tool-use", "confirmed"),
      repository.setEvidenceStatus(rules.id, "deprecated"),
    ]);
    const database = await repository.readEvidenceDatabase();
    assert.equal(database.records.find((record) => record.id === rules.id).status, "deprecated");
    assert.equal(database.records.find((record) => record.id === "paper-agent-tool-use").status, "confirmed");
    assert.equal((await repository.getEvidenceReport(captured.reportId)).data.id, captured.reportId);
    const before = JSON.parse(await readFile(path.join(temporary, "data/evidence-hub.json"), "utf8"));
    assert(before.reports.some((item) => item.id === captured.reportId));
  } finally {
    process.chdir(workspace);
    await rm(temporary, { recursive: true, force: true });
  }
});
