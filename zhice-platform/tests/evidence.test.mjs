import "./register-paths.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { seedEvidenceDatabase } = await import("../src/modules/evidence-center/data.ts");
const { searchEvidence } = await import("../src/modules/evidence-center/search.ts");
const { quoteRanges } = await import("../src/modules/evidence-center/utils/quote-ranges.ts");
const { evidenceDatabaseSchema } = await import("../src/modules/evidence-center/types.ts");

const records = seedEvidenceDatabase.records.map((item) => ({ ...item, citations: [] }));

test("natural language technical-score search recalls rules and papers, while unrelated searches stay empty", () => {
  const found = searchEvidence(records, "如何提升技术实现得分", "all");
  assert(found.some((item) => item.kind === "competitionRule"));
  assert(found.some((item) => item.id === "paper-rag-grounding"));
  assert(found.some((item) => item.id === "paper-agent-tool-use"));
  assert.equal(searchEvidence(records, "zz-no-match-781283", "all").length, 0);
  const papers = searchEvidence(records, "如何提升技术实现得分", "academicPaper");
  assert(papers.length > 0);
  assert(papers.every((item) => item.kind === "academicPaper"));
});

test("quote highlighting supports repeated and overlapping exact source text without inventing matches", () => {
  const text = "RAG generates facts. RAG generates facts.";
  const ranges = quoteRanges(text, ["RAG", "RAG generates", "facts.", "", "missing quote"]);
  assert.deepEqual(ranges.map((range) => text.slice(range.start, range.end)), ["RAG generates", "facts.", "RAG generates", "facts."]);
  assert.deepEqual(quoteRanges("<script>untrusted</script>", ["missing"]), []);
});

test("initial evidence has valid report targets and real source substrings for every highlighted quote", () => {
  evidenceDatabaseSchema.parse(seedEvidenceDatabase);
  const evidenceIds = new Set(records.map((item) => item.id));
  for (const citation of seedEvidenceDatabase.citations) {
    assert(evidenceIds.has(citation.evidenceId));
    const report = seedEvidenceDatabase.reports.find((item) => item.id === citation.reportId);
    assert(report?.blocks.some((block) => block.id === citation.blockId));
  }
  for (const evidence of records) {
    const original = evidence.academic?.abstract ?? [evidence.body, evidence.excerpt, ...(evidence.ruleItems ?? []).map((item) => item.text)].join("\n");
    for (const quote of evidence.highlightedQuotes) assert(original.includes(quote));
    if (evidence.sourceMode === "sample") assert.notEqual(evidence.status, "confirmed");
  }
  assert.equal(searchEvidence(records, "", "all").at(-1).status, "deprecated");
});
