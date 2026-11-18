import "./register-paths.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { searchRemotePapers, AcademicSearchUnavailableError } = await import("../src/modules/competition-requirements/academic-search.ts");
const { searchAcademicPapers } = await import("../src/modules/competition-requirements/analyzer.ts");
const { POST } = await import("../src/app/api/papers/route.ts");
const materialQuery = "竹纤维 模塑缓冲包装 压缩性能 吸湿性能";
const materialKeywords = materialQuery.split(" ");
const request = (query = materialQuery) => new Request("http://localhost/api/papers", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }),
});
const work = (patch = {}) => ({
  id: "https://openalex.org/W123", doi: "https://doi.org/10.1234/fixture",
  title: "Bamboo fiber molded pulp cushioning: independent fixture",
  publication_year: 2024, cited_by_count: 12,
  authorships: [{ author: { display_name: "Fixture author" } }],
  abstract_inverted_index: { packaging: [3], fibers: [1], Bamboo: [0], improve: [2] },
  primary_location: { landing_page_url: "https://example.org/fixture" },
  ...patch,
});
const provider = (url) => new URL(url).hostname;
const crossrefWork = (patch = {}) => ({
  DOI: "10.1234/crossref-fixture",
  title: ["Bamboo fiber nursery container wet strength"],
  author: [{ given: "Fixture", family: "Author" }],
  published: { "date-parts": [[2024]] },
  abstract: "<jats:p>Bamboo fibers improve wet strength.</jats:p>",
  "is-referenced-by-count": 7,
  URL: "https://doi.org/10.1234/crossref-fixture",
  ...patch,
});

test("rate-limited primary search falls back to real OpenAlex metadata for Chinese material keywords", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push(new URL(url));
    assert(init.signal instanceof AbortSignal);
    if (provider(url) === "api.semanticscholar.org") return new Response("limited", { status: 429 });
    assert.equal(provider(url), "api.openalex.org");
    assert.match(new URL(url).searchParams.get("search"), /bamboo/i);
    return Response.json({ results: [work()] });
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.cached, false, "a second online provider is not a local cache");
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].source, "OpenAlex");
  assert.equal(result.data[0].url, "https://doi.org/10.1234/fixture");
  assert.equal(result.data[0].abstract, "Bamboo fibers improve packaging");
  assert.deepEqual(result.data[0].authors, ["Fixture author"]);
  assert.equal(result.data[0].year, 2024);
  assert.equal(calls.length, 2);
});

test("a good paper survives malformed neighbors, duplicates, missing abstracts and unknown years", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (provider(url) === "api.semanticscholar.org") return Response.json({ data: [] });
    assert.equal(provider(url), "api.openalex.org");
    return Response.json({ results: [
      null,
      { id: "invalid", title: { unexpected: true } },
      work({ abstract_inverted_index: null, publication_year: null, authorships: [] }),
      work({ id: "https://openalex.org/W124", title: "Duplicate DOI record" }),
      work({ id: "javascript:bad", doi: "javascript:bad", primary_location: { landing_page_url: "data:text/html,bad" } }),
    ] });
  });
  const papers = await searchRemotePapers(materialKeywords);
  assert.equal(papers.length, 1);
  assert.equal(papers[0].year, 0, "missing publication year must not become a fabricated date");
  assert.match(papers[0].abstract, /摘要.*未提供/);
  assert.deepEqual(papers[0].authors, []);
  assert.match(papers[0].url, /^https?:\/\//);
});

test("an invalid primary response shape triggers fallback rather than pretending there are no matches", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (provider(url) === "api.semanticscholar.org") return Response.json({ data: "unexpected" });
    assert.equal(provider(url), "api.openalex.org");
    return Response.json({ results: [work()] });
  });
  const papers = await searchRemotePapers(materialKeywords);
  assert.equal(papers.length, 1);
  assert.equal(papers[0].source, "OpenAlex");
});

test("a provider timeout or network failure still allows fallback while the caller remains active", async (t) => {
  let primaryFailure = new DOMException("Provider deadline exceeded", "TimeoutError");
  const calls = [];
  const caller = new AbortController();
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(provider(url));
    if (provider(url) === "api.semanticscholar.org") throw primaryFailure;
    assert.equal(provider(url), "api.openalex.org");
    return Response.json({ results: [work()] });
  });
  for (const error of [primaryFailure, new TypeError("Connection unavailable")]) {
    primaryFailure = error;
    const papers = await searchRemotePapers(materialKeywords, caller.signal);
    assert.equal(papers.length, 1);
    assert.equal(papers[0].source, "OpenAlex");
    assert.equal(caller.signal.aborted, false);
  }
  assert.deepEqual(calls, ["api.semanticscholar.org", "api.openalex.org", "api.semanticscholar.org", "api.openalex.org"]);
});

test("fully malformed upstream records are a service failure rather than a successful empty search", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const source = provider(url);
    calls.push(source);
    if (source === "api.semanticscholar.org") return Response.json({ data: [{ title: null }] });
    if (source === "api.openalex.org") return Response.json({ results: [{ title: { malformed: true } }] });
    assert.equal(source, "api.crossref.org");
    return Response.json({ message: { items: [{ title: [null] }] } });
  });
  const response = await POST(request());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /检索服务.*不可用/);
  assert.deepEqual(calls, ["api.semanticscholar.org", "api.openalex.org", "api.crossref.org"]);
});

test("two unavailable providers produce an actionable HTTP 503 and never online demo data", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("unavailable", { status: 503 }));
  await assert.rejects(searchRemotePapers(materialKeywords), AcademicSearchUnavailableError);
  await assert.rejects(searchAcademicPapers(["算法"], "算法研究", undefined, { onlineOnly: true }), AcademicSearchUnavailableError);
  const response = await POST(request());
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.match(result.error, /检索服务.*不可用.*重试/);
  assert.equal(result.data, undefined);
});

test("Crossref is used when Semantic Scholar and OpenAlex are rate-limited", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    if (parsed.hostname === "api.crossref.org") {
      assert.equal(parsed.searchParams.get("query.title"), "bamboo fiber nursery containers wet strength");
      assert.equal(parsed.searchParams.get("rows"), "6");
      return Response.json({ message: { items: [crossrefWork()] } });
    }
    return new Response("limited", { status: 429 });
  });
  const response = await POST(request("竹纤维 育苗容器 湿态强度"));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data[0].source, "Crossref");
  assert.equal(result.data[0].abstract, "Bamboo fibers improve wet strength.");
  assert.deepEqual(result.data[0].authors, ["Fixture Author"]);
  assert.deepEqual(calls.map((url) => url.hostname), ["api.semanticscholar.org", "api.openalex.org", "api.crossref.org"]);
});

test("two valid empty provider responses remain a successful empty search", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    if (provider(url) === "api.semanticscholar.org") return Response.json({ data: [] });
    if (provider(url) === "api.openalex.org") return Response.json({ results: [] });
    assert.equal(provider(url), "api.crossref.org");
    return Response.json({ message: { items: [] } });
  });
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: [], cached: false });
});

test("one failed source does not erase another source's valid empty result", async (t) => {
  let emptyPrimary = false;
  t.mock.method(globalThis, "fetch", async (url) => {
    if (provider(url) === "api.semanticscholar.org") {
      return emptyPrimary ? Response.json({ data: [] }) : new Response("limited", { status: 429 });
    }
    if (provider(url) === "api.openalex.org") {
      if (emptyPrimary) throw new TypeError("network unavailable");
      return Response.json({ results: [] });
    }
    assert.equal(provider(url), "api.crossref.org");
    if (emptyPrimary) return Response.json({ message: { items: [] } });
    throw new TypeError("network unavailable");
  });
  assert.deepEqual(await searchRemotePapers(materialKeywords), []);
  emptyPrimary = true;
  assert.deepEqual(await searchRemotePapers(materialKeywords), []);
});

test("an aborted caller stops before fetching and cannot start the fallback provider", async (t) => {
  const abort = new AbortController();
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    calls++;
    abort.abort();
    assert(init.signal.aborted);
    throw abort.signal.reason;
  });
  await assert.rejects(searchRemotePapers(materialKeywords, abort.signal), { name: "AbortError" });
  assert.equal(calls, 1);
  await assert.rejects(searchRemotePapers(materialKeywords, abort.signal), { name: "AbortError" });
  assert.equal(calls, 1);
});

test("unrelated queries preserve their search terms and use primary results without fallback", async (t) => {
  const queries = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(provider(url), "api.semanticscholar.org");
    queries.push(new URL(url).searchParams.get("query"));
    return Response.json({ data: [{
      paperId: "algorithm-fixture", title: "Algorithm comparison fixture", year: 2023,
      authors: [{ name: "Fixture author" }], abstract: "Evaluation fixture.",
      url: "https://example.org/algorithms", citationCount: 1,
    }] });
  });
  const papers = await searchRemotePapers(["graph", "algorithms"]);
  assert.deepEqual(queries, ["graph algorithms"]);
  assert.equal(papers.length, 1);
  assert.equal(papers[0].source, "Semantic Scholar");
});

test("invalid user input is rejected before any external request", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Unexpected request"); });
  for (const query of ["", "a", "x".repeat(201)]) {
    const response = await POST(request(query));
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});
