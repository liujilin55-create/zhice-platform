import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { catalogDatabaseSchema, knownValue, latestReview, reviewSchema, templateInputSchema, templateRecordSchema, type DirectoryInput, type DirectoryPreview, type DirectoryRecord } from "../types";
import { parseDirectory } from "../import";

const file = () => path.join(process.cwd(), "data", "campus-catalog.json");
const hash = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
export async function readCatalog() {
  try { return catalogDatabaseSchema.parse(JSON.parse(await fs.readFile(file(), "utf8"))); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return { revision: 0, records: [], templates: [] } as z.infer<typeof catalogDatabaseSchema>; throw new Error("目录数据读取失败，未回退为空目录，请检查文件。"); }
}
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(run: (db: z.infer<typeof catalogDatabaseSchema>) => T | Promise<T>): Promise<T> {
  const operation = queue.then(async () => {
    const db = await readCatalog(); const result = await run(db); db.revision++;
    await fs.mkdir(path.dirname(file()), { recursive: true }); const temp = file() + "." + randomUUID() + ".tmp";
    try { await fs.writeFile(temp, JSON.stringify(catalogDatabaseSchema.parse(db), null, 2)); await fs.rename(temp, file()); }
    finally { await fs.rm(temp, { force: true }); }
    return result;
  }); queue = operation.catch(() => undefined); return operation;
}
const family = (data: DirectoryInput) => data.name.replace(/[\s·（）()]/g, "").toLowerCase();
const edition = (data: DirectoryInput) => "fafu-" + hash([family(data), data.academicYear]).slice(0, 24);
const sourced = (d: DirectoryInput) => Boolean(d.campusUrl || knownValue(d.sourceFile) && d.sourcePage);
export function directoryPreview(rows: DirectoryInput[], db: z.infer<typeof catalogDatabaseSchema>): DirectoryPreview {
  const seen: DirectoryInput[] = []; const warnings: string[] = [];
  const preview = rows.map((data, index) => {
    const prior = db.records.filter((r) => r.editionId === edition(data));
    const same = seen.filter((r) => edition(r) === edition(data));
    const notes: string[] = [];
    const duplicate = prior.some((r) => hash(r.data) === hash(data)) || same.some((r) => hash(r) === hash(data));
    if (duplicate) notes.push("重复记录，跳过导入");
    else if (prior.length) notes.push("相同比赛与学年度，新增历史版本，不覆盖已使用记录");
    if ([...prior.map((r) => r.data), ...same].some((r) => r.campusRecognitionLevel !== data.campusRecognitionLevel)) notes.push("校内等级冲突：需核对来源后人工处理");
    if ([...db.records.map((r) => r.data), ...seen].some((r) => family(r) === family(data) && r.academicYear !== data.academicYear)) notes.push("存在其他学年度记录，各年度独立保留");
    if (!sourced(data)) notes.push("缺少校内通知或带页码的来源文件，不能核验校内认定");
    if (!data.officialUrl) notes.push("官方比赛链接待补充");
    if (!data.campusRecognitionLevel) notes.push("校内认定等级待核验，不自动补充等级");
    if (data.campusDeadline && Date.parse(data.campusDeadline) < Date.now()) notes.push("校内截止时间已过期");
    seen.push(data);
    return { row: index + 1, action: duplicate ? "skip" as const : prior.length || same.length ? "version" as const : "add" as const, data, warnings: notes };
  });
  warnings.push("导入仅登记用户提供的内容，所有核验结论需在后台逐项确认。项目资料和历史记录不会被修改。");
  return { token: hash([db.revision, rows]), revision: db.revision, rows: preview, warnings };
}
export async function previewImport(content: string, format: "json" | "csv") { return directoryPreview(parseDirectory(content, format), await readCatalog()); }
export async function commitImport(content: string, format: "json" | "csv", token: string) {
  const rows = parseDirectory(content, format);
  return mutate((db) => {
    const preview = directoryPreview(rows, db); if (token !== preview.token) throw new Error("目录或文件已变化，请重新预览后导入");
    const added: DirectoryRecord[] = [];
    for (const row of preview.rows) {
      if (row.action === "skip") continue;
      const prior = db.records.filter((r) => r.editionId === edition(row.data));
      const conflict = row.warnings.some((w) => w.includes("等级冲突"));
      const record: DirectoryRecord = { id: edition(row.data) + "-" + hash(row.data).slice(0, 12), editionId: edition(row.data), version: prior.length + 1, importedAt: new Date().toISOString(), data: row.data, verificationStatus: conflict ? "conflict" : "pending", lastVerified: null, reviews: [] };
      if (conflict) record.reviews.push({ target: "recognition", status: "conflict", note: "导入检测到与同年度历史记录等级不同，待核对原始来源。", at: record.importedAt });
      db.records.push(record); added.push(record);
    }
    return { added, skipped: preview.rows.length - added.length };
  });
}
export async function reviewRecord(kind: "competition" | "template", id: string, raw: unknown) {
  const input = reviewSchema.omit({ at: true }).parse(raw);
  return mutate((db) => {
    const record = kind === "competition" ? db.records.find((r) => r.id === id) : db.templates.find((t) => t.templateId === id);
    if (!record) throw new Error("记录不存在");
    if (kind === "competition") {
      const r = record as DirectoryRecord;
      if (!["competition", "recognition", "officialLink"].includes(input.target)) throw new Error("核验目标错误");
      if (input.status === "verified" && (!sourced(r.data) || input.target === "recognition" && !knownValue(r.data.campusRecognitionLevel) || input.target === "officialLink" && !r.data.officialUrl)) throw new Error("缺少对应来源或字段，不能标记已确认");
    } else {
      const t = record as z.infer<typeof catalogDatabaseSchema>["templates"][number];
      if (!["provenance", "rights"].includes(input.target)) throw new Error("核验目标错误");
      if (input.status === "verified" && input.target === "provenance" && !t.data.sourceUrl && !t.sourceHash) throw new Error("缺少获奖 PPT 可追溯来源");
      if (input.status === "verified" && input.target === "rights" && (!["owned", "derivation_allowed"].includes(t.data.usageRights) || !knownValue(t.data.authorizationSource) || !knownValue(t.data.authorizationNote))) throw new Error("授权范围或授权依据不明确，只能作为参考风格");
    }
    const now = new Date().toISOString(); record.reviews.push({ ...input, at: now });
    const required = kind === "competition" ? ["competition", "recognition", "officialLink"] as const : ["provenance", "rights"] as const;
    const statuses = required.map((target) => latestReview(record.reviews, target)?.status || "pending");
    record.verificationStatus = statuses.includes("conflict") ? "conflict" : statuses.includes("expired") ? "expired" : statuses.every((s) => s === "verified") ? "verified" : "pending";
    record.lastVerified = now;
    return record;
  });
}
export async function registerTemplate(raw: unknown, extraction: { sourceHash: string; slideCount: number; method: string } | null = null) {
  const data = templateInputSchema.parse(raw);
  return mutate((db) => {
    const template = templateRecordSchema.parse({ templateId: "tpl-" + randomUUID(), version: 1, importedAt: new Date().toISOString(), data, sourceHash: extraction?.sourceHash || null, extraction: extraction ? { slideCount: extraction.slideCount, method: extraction.method } : null, verificationStatus: "pending", lastVerified: null, reviews: [] });
    db.templates.push(template); return template;
  });
}
export const latestDirectory = (records: DirectoryRecord[]) => records.filter((r) => !records.some((other) => other.editionId === r.editionId && other.version > r.version));
