import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requirementSourceSchema, scoringClauseSchema, type RequirementSource } from "@/shared/contracts/competition-binding";
import { parseUpload } from "@/modules/competition-requirements/parser";
import { resolveCompetition } from "@/modules/campus-catalog/server/catalog";
import { getCompetitionDownload } from "../downloads";
import { readCatalog } from "@/modules/campus-catalog/server/repository";
import { knownValue } from "@/modules/campus-catalog/types";
import type { CompetitionSourceResponse } from "../source-types";

const entrySchema = z.object({ source: requirementSourceSchema, criteria: z.array(scoringClauseSchema) });
const cacheSchema = z.record(z.string(), entrySchema);
const cachePath = () => path.join(process.cwd(), "data", "competition-sources.json");
let queue: Promise<unknown> = Promise.resolve();
async function readCache() {
  try { return cacheSchema.parse(JSON.parse(await fs.readFile(cachePath(), "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw new Error("来源缓存无法读取，请检查后重试。"); }
}
async function writeEntry(key: string, entry: z.infer<typeof entrySchema>, expectedHash?: string) {
  const operation = queue.then(async () => {
    const cache = await readCache();
    if (expectedHash && cache[key]?.source.contentHash !== expectedHash) throw new Error("来源已更新，请重新加载后核验。");
    cache[key] = entrySchema.parse(entry);
    await fs.mkdir(path.dirname(cachePath()), { recursive: true });
    const temp = cachePath() + "." + crypto.randomUUID() + ".tmp";
    try { await fs.writeFile(temp, JSON.stringify(cache, null, 2), "utf8"); await fs.rename(temp, cachePath()); }
    finally { await fs.rm(temp, { force: true }); }
  }); queue = operation.catch(() => undefined); return operation;
}
const cacheKey = (competitionId: string, trackId: string) => competitionId + ":" + trackId;
export async function cachedCompetitionSource(competitionId: string, trackId: string, sourceId?: string | null) {
  const entry = (await readCache())[cacheKey(competitionId, trackId)];
  return entry && (!sourceId || entry.source.sourceId === sourceId) ? entry : null;
}
export async function competitionSourceStatuses() {
  const cache = await readCache();
  return Object.fromEntries(Object.entries(cache).map(([key, entry]) => [key, { verificationStatus: entry.source.verificationStatus, lastVerified: entry.source.lastVerified }]));
}
export async function loadCompetitionSource(competitionId: string, trackId: string, signal: AbortSignal): Promise<CompetitionSourceResponse> {
  const competition = (await resolveCompetition(competitionId));
  if (!competition?.tracks.some((track) => track.trackId === trackId)) throw new Error("比赛或赛道不存在");
  const cached = await cachedCompetitionSource(competitionId, trackId);
  const directory = (await readCatalog()).records.find((r) => r.id === competitionId);
  if (directory) {
    if (!directory.data.sourceText.trim()) return { source: null, criteria: [], warnings: ["目录已绑定当前比赛，但未提供通知原文。请通过所登记链接核对并上传原文，不会从目录名称推造评分标准。"], cached: false };
    if (cached) return { ...cached, cached: true, warnings: cached.source.warnings };
    const text = directory.data.sourceText; const contentHash = createHash("sha256").update(text).digest("hex");
    const source: RequirementSource = { sourceId: "directory-" + directory.id, competitionId, trackId, title: `${directory.data.sourceFile || directory.data.name} · ${directory.data.sourcePage ? "第 " + directory.data.sourcePage + " 页" : "页码待核验"} · ${directory.data.academicYear}`, kind: "campus", url: directory.data.campusUrl, text, contentHash, verificationStatus: "pending", lastVerified: null, fetchedAt: new Date().toISOString(), warnings: ["用户提供的校内通知原文；目录核验与评分原句核验独立进行。"] };
    const entry = { source, criteria: [] }; await writeEntry(cacheKey(competitionId, trackId), entry);
    return { ...entry, warnings: source.warnings, cached: false };
  }
  if (cached && Date.now() - Date.parse(cached.source.fetchedAt) < 12 * 3600000) return { ...cached, warnings: cached.source.warnings, cached: true };
  const download = getCompetitionDownload(competitionId);
  if (!download) return { source: null, criteria: [], warnings: ["没有可自动读取的官方资料，请打开官方链接核对或上传补充文件。"], cached: false };
  try {
    // URL comes only from the maintained catalog; browser-supplied URLs are never fetched.
    const response = await fetch(download.url, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]), redirect: "error" });
    if (!response.ok) throw new Error("官方来源暂时无法访问");
    if (/\.zip$/i.test(download.fileName)) throw new Error("官方资料为压缩包，请下载后上传其中的 PDF 或 Word 通知");
    const reader = response.body?.getReader(); if (!reader) throw new Error("官方来源内容为空");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 15 * 1024 * 1024) { await reader.cancel(); throw new Error("官方文件超过 15 MB，请手动精简后上传"); } chunks.push(value); }
    const bytes = Buffer.concat(chunks);
    let text: string;
    if (/\.html?$/i.test(download.fileName)) {
      text = bytes.toString("utf8").replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    } else text = (await parseUpload(new File([bytes], download.fileName, { type: "application/pdf" }), signal)).text;
    if (text.trim().length < 40) throw new Error("官方来源未提取到足够正文，请上传可读原文");
    text = text.slice(0, 60000);
    const contentHash = createHash("sha256").update(text).digest("hex");
    const source: RequirementSource = { sourceId: "official-" + competitionId + "-" + contentHash.slice(0, 16), competitionId, trackId, title: download.fileName, kind: "official", url: download.url, text, contentHash, verificationStatus: "pending", lastVerified: null, fetchedAt: new Date().toISOString(), warnings: [`已获取 ${download.year} 年来源；本届、赛道与条款适用性需人工核验。自动抓取不代表已核验。`] };
    const entry = cached?.source.contentHash === contentHash ? { ...cached, source: { ...cached.source, fetchedAt: source.fetchedAt } } : { source, criteria: [] };
    await writeEntry(cacheKey(competitionId, trackId), entry);
    return { ...entry, warnings: entry.source.warnings, cached: false };
  } catch (error) {
    signal.throwIfAborted();
    const warning = error instanceof Error && !/fetch|redirect/i.test(error.message) ? error.message : "官方资料读取失败，请核对官网或上传补充资料。";
    return cached ? { ...cached, warnings: [...cached.source.warnings, warning + " 当前展示缓存正文。"], cached: true } : { source: null, criteria: [], warnings: [warning], cached: false };
  }
}

export const verifySourceInputSchema = z.object({ sourceId: z.string(), contentHash: z.string(), criteria: z.array(z.object({ title: z.string().trim().min(1).max(160), quote: z.string().trim().min(10).max(3000) })).min(1).max(20), confirm: z.literal(true) });
export async function verifyCompetitionSource(competitionId: string, trackId: string, raw: unknown) {
  const input = verifySourceInputSchema.parse(raw); const entry = await cachedCompetitionSource(competitionId, trackId, input.sourceId);
  const directory = entry?.source.kind === "campus" ? (await readCatalog()).records.find((r) => r.id === competitionId) : null;
  const fileSource = directory && knownValue(directory.data.sourceFile) && directory.data.sourcePage && directory.data.sourceText === entry?.source.text;
  if (!entry || !["official", "campus"].includes(entry.source.kind) || !(entry.source.url || fileSource) || entry.source.contentHash !== input.contentHash) throw new Error("请先加载当前官方或校内通知原文；缓存已变化时需要重新核对。");
  if (input.criteria.some((item) => !entry.source.text.includes(item.quote))) throw new Error("评分原句必须逐字出现在当前官方原文中，不能使用 AI 建议或概括替代。");
  const source = { ...entry.source, verificationStatus: "verified" as const, lastVerified: new Date().toISOString(), warnings: ["评分原句已经用户人工核对；赛事资格、年份和校内认定仍需分别核验。"] };
  const criteria = input.criteria.map((item, index) => ({ id: source.sourceId + "-score-" + index, title: item.title, text: item.quote, sourceId: source.sourceId, sourceUrl: source.url, verificationStatus: "verified" as const, origin: source.kind === "campus" ? "campus" as const : "official" as const }));
  const next = { source, criteria }; await writeEntry(cacheKey(competitionId, trackId), next, input.contentHash);
  return { ...next, warnings: source.warnings, cached: true };
}

export async function flagCompetitionSourceConflict(competitionId: string, trackId: string, raw: unknown) {
  const input = z.object({ sourceId: z.string(), contentHash: z.string(), reason: z.string().trim().min(5).max(1000), confirm: z.literal(true) }).parse(raw);
  const entry = await cachedCompetitionSource(competitionId, trackId, input.sourceId);
  if (!entry || entry.source.contentHash !== input.contentHash) throw new Error("来源已变化，请重新加载。");
  const source = { ...entry.source, verificationStatus: "conflict" as const, lastVerified: null, warnings: ["用户报告来源冲突：" + input.reason] };
  const next = { source, criteria: entry.criteria.map((item) => ({ ...item, verificationStatus: "conflict" as const })) };
  await writeEntry(cacheKey(competitionId, trackId), next, input.contentHash);
  return { ...next, warnings: source.warnings, cached: true };
}
