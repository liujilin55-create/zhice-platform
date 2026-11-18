import { z } from "zod";
import { paperSchema, type Paper } from "./types";

export class AcademicSearchUnavailableError extends Error {
  constructor() {
    super("论文检索服务暂时不可用，请稍后重试。");
    this.name = "AcademicSearchUnavailableError";
  }
}

const semanticResponse = z.object({ data: z.array(z.unknown()) });
const openAlexResponse = z.object({ results: z.array(z.unknown()) });
const crossrefResponse = z.object({ message: z.object({ items: z.array(z.unknown()) }) });
const semanticPaper = z.object({
  paperId: z.string().nullish(), title: z.string().trim().min(1),
  authors: z.array(z.object({ name: z.string().nullish() })).nullish(),
  year: z.number().int().nonnegative().nullish(), abstract: z.string().nullish(),
  url: z.string().nullish(), citationCount: z.number().nonnegative().nullish(),
  externalIds: z.object({ DOI: z.string().nullish() }).nullish(),
});
const openAlexPaper = z.object({
  id: z.string().nullish(), title: z.string().trim().min(1), doi: z.string().nullish(),
  publication_year: z.number().int().nonnegative().nullish(),
  authorships: z.array(z.object({ author: z.object({ display_name: z.string().nullish() }).nullish() })).nullish(),
  abstract_inverted_index: z.record(z.string(), z.array(z.number().int().nonnegative())).nullish(),
  cited_by_count: z.number().nonnegative().nullish(),
  primary_location: z.object({ landing_page_url: z.string().nullish() }).nullish(),
});
const crossrefPaper = z.object({
  DOI: z.string().nullish(),
  title: z.array(z.string().trim().min(1)).nullish(),
  author: z.array(z.object({ given: z.string().nullish(), family: z.string().nullish() })).nullish(),
  published: z.object({ "date-parts": z.array(z.array(z.number().int().nonnegative())) }).nullish(),
  issued: z.object({ "date-parts": z.array(z.array(z.number().int().nonnegative())) }).nullish(),
  abstract: z.string().nullish(),
  "is-referenced-by-count": z.number().nonnegative().nullish(),
  URL: z.string().nullish(),
});

const missingAbstract = "摘要暂未提供，请打开论文原文查看。";
function httpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function configuredUrl(value: string | undefined, fallback: string) {
  try {
    return new URL(value || fallback);
  } catch {
    throw new AcademicSearchUnavailableError();
  }
}

function cleanAbstract(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function academicQuery(keywords: string[]) {
  const input = keywords.join(" ");
  if (/竹|木质|缓冲|育苗|板材/.test(input)) {
    if (/育苗/.test(input)) return "bamboo fiber nursery containers wet strength";
    if (/板材/.test(input)) return "bamboo wood residues composite board mechanical properties";
    return "bamboo fiber molded pulp cushioning packaging compression moisture";
  }
  return keywords.slice(0, 6).join(" ");
}

function readSemanticPaper(value: unknown): Paper | null {
  const parsed = semanticPaper.safeParse(value);
  if (!parsed.success) return null;
  const paper = parsed.data;
  const doi = paper.externalIds?.DOI;
  const url = httpUrl(doi ? `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : null) ?? httpUrl(paper.url);
  if (!url) return null;
  return paperSchema.parse({
    id: paper.paperId || url, title: paper.title,
    authors: (paper.authors ?? []).flatMap((author) => author.name ? [author.name] : []).slice(0, 4),
    year: paper.year ?? 0, abstract: paper.abstract?.trim() || missingAbstract,
    url, source: "Semantic Scholar", citationCount: paper.citationCount ?? 0,
    relevanceScore: 0, matchedKeywords: [],
  });
}

function readOpenAlexPaper(value: unknown): Paper | null {
  const parsed = openAlexPaper.safeParse(value);
  if (!parsed.success) return null;
  const paper = parsed.data;
  const url = httpUrl(paper.doi) ?? httpUrl(paper.primary_location?.landing_page_url);
  if (!url) return null;
  const words = Object.entries(paper.abstract_inverted_index ?? {})
    .flatMap(([word, positions]) => positions.filter((position) => position < 5000).map((position) => ({ word, position })))
    .sort((a, b) => a.position - b.position);
  return paperSchema.parse({
    id: paper.id || url, title: paper.title,
    authors: (paper.authorships ?? []).flatMap((item) => item.author?.display_name ? [item.author.display_name] : []).slice(0, 4),
    year: paper.publication_year ?? 0,
    abstract: words.map((item) => item.word).join(" ").trim() || missingAbstract,
    url, source: "OpenAlex", citationCount: paper.cited_by_count ?? 0,
    relevanceScore: 0, matchedKeywords: [],
  });
}

function readCrossrefPaper(value: unknown): Paper | null {
  const parsed = crossrefPaper.safeParse(value);
  if (!parsed.success) return null;
  const paper = parsed.data;
  const doi = paper.DOI?.trim();
  const url = httpUrl(doi ? `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")}` : null) ?? httpUrl(paper.URL);
  const title = paper.title?.[0]?.trim();
  if (!url || !title) return null;
  const dateParts = paper.published?.["date-parts"]?.[0] ?? paper.issued?.["date-parts"]?.[0] ?? [];
  const year = dateParts[0] ?? 0;
  const abstract = cleanAbstract(paper.abstract) || missingAbstract;
  const authors = (paper.author ?? [])
    .map((author) => [author.given, author.family].filter(Boolean).join(" ").trim())
    .filter(Boolean)
    .slice(0, 4);
  return paperSchema.parse({
    id: doi || url, title, authors, year, abstract, url,
    source: "Crossref", citationCount: paper["is-referenced-by-count"] ?? 0,
    relevanceScore: 0, matchedKeywords: [],
  });
}

function distinctPapers(rows: unknown[], parse: (value: unknown) => Paper | null) {
  const unique = new Map<string, Paper>();
  for (const row of rows) {
    const paper = parse(row);
    if (!paper) continue;
    const key = paper.url.replace(/\/$/, "").toLowerCase();
    if (!unique.has(key)) unique.set(key, paper);
  }
  // Invalid upstream data is a service failure, not proof that no papers exist.
  if (rows.length && !unique.size) throw new Error("Invalid academic search records");
  return [...unique.values()].slice(0, 6);
}

export async function searchRemotePapers(keywords: string[], signal?: AbortSignal): Promise<Paper[]> {
  signal?.throwIfAborted();
  const query = academicQuery(keywords.filter((word) => word.trim()));
  if (!query) return [];

  const semanticUrl = configuredUrl(process.env.ACADEMIC_API_URL, "https://api.semanticscholar.org/graph/v1/paper/search");
  semanticUrl.searchParams.set("query", query);
  semanticUrl.searchParams.set("limit", "6");
  semanticUrl.searchParams.set("fields", "title,authors,year,abstract,url,citationCount,externalIds");
  const openAlexUrl = configuredUrl(undefined, "https://api.openalex.org/works");
  openAlexUrl.searchParams.set("search", query);
  openAlexUrl.searchParams.set("per-page", "6");
  openAlexUrl.searchParams.set("select", "id,doi,title,publication_year,authorships,abstract_inverted_index,cited_by_count,primary_location");
  const crossrefUrl = configuredUrl(process.env.CROSSREF_API_URL, "https://api.crossref.org/works");
  // Title-focused matching keeps a broad bibliographic fallback from returning
  // unrelated review records when the first two providers are rate-limited.
  crossrefUrl.searchParams.set("query.title", query);
  crossrefUrl.searchParams.set("rows", "6");
  crossrefUrl.searchParams.set("select", "DOI,title,author,published,issued,abstract,is-referenced-by-count,URL");
  const providers = [
    { url: semanticUrl, timeout: 5000, parse: (payload: unknown) => distinctPapers(semanticResponse.parse(payload).data, readSemanticPaper) },
    { url: openAlexUrl, timeout: 8000, parse: (payload: unknown) => distinctPapers(openAlexResponse.parse(payload).results, readOpenAlexPaper) },
    { url: crossrefUrl, timeout: 10000, parse: (payload: unknown) => distinctPapers(crossrefResponse.parse(payload).message.items, readCrossrefPaper) },
  ];
  let available = false;
  for (const provider of providers) {
    signal?.throwIfAborted();
    try {
      const timeout = AbortSignal.timeout(provider.timeout);
      const response = await fetch(provider.url, {
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Academic search HTTP ${response.status}`);
      const papers = provider.parse(await response.json());
      signal?.throwIfAborted();
      available = true;
      if (papers.length) return papers;
    } catch {
      signal?.throwIfAborted();
    }
  }
  if (!available) throw new AcademicSearchUnavailableError();
  return [];
}
