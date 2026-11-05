import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { planDocumentSchema, documentReferenceSchema, documentText, type DocumentReference } from "@/shared/contracts/plan-document";
import { bindingKey, sameBinding, type CompetitionBinding } from "@/shared/contracts/competition-binding";
import { z } from "zod";

const savedSchema = z.object({ data: planDocumentSchema, reference: documentReferenceSchema });
export class PlanDocumentError extends Error { public status: number; constructor(message: string, status = 409) { super(message); this.status = status; } }
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const directory = (binding: CompetitionBinding) => path.join(process.cwd(), "data", "plan-documents", digest(bindingKey(binding)));
let queue: Promise<unknown> = Promise.resolve();
export async function readPlanDocument(binding: CompetitionBinding, reference?: DocumentReference) {
  let saved;
  try { saved = savedSchema.parse(JSON.parse(await fs.readFile(path.join(directory(binding), "current.json"), "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new PlanDocumentError("当前比赛还没有保存网页计划书，请先确认章节。", 404); throw error; }
  if (!sameBinding(saved.data.binding, binding) || reference && (!sameBinding(reference.binding, binding) || reference.documentId !== saved.reference.documentId || reference.version !== saved.reference.version || reference.contentHash !== saved.reference.contentHash)) throw new PlanDocumentError("计划书已修改或归属不匹配，请重新生成 PPT 大纲。");
  return saved;
}
export async function savePlanDocument(raw: unknown) {
  const document = planDocumentSchema.parse(raw);
  if (new Set(document.chapters.map((chapter) => chapter.id)).size !== document.chapters.length) throw new PlanDocumentError("章节标识重复。", 400);
  for (const chapter of document.chapters) {
    if (chapter.blocks.some((block) => !documentText(chapter).includes(block.text) || block.confirmed && (!chapter.confirmed || block.marker === "supplement"))) throw new PlanDocumentError("内容块或确认状态与章节正文不一致。", 400);
  }
  document.confirmed = document.chapters.length > 0 && document.chapters.every((chapter) => chapter.confirmed);
  const reference: DocumentReference = { documentId: document.documentId, version: document.version, binding: document.binding, contentHash: digest(JSON.stringify(document)) };
  const saved = { data: document, reference };
  const operation = queue.then(async () => {
    const existing = await readPlanDocument(document.binding).catch((error) => { if (error instanceof PlanDocumentError && error.status === 404) return null; throw error; });
    if (existing && existing.reference.contentHash === reference.contentHash) return existing;
    if (existing && document.version <= existing.data.version) throw new PlanDocumentError("服务端已有更新版本，请保留本地内容并重新保存新版本。");
    const root = directory(document.binding); await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, `v${document.version}-${reference.contentHash}.json`), JSON.stringify(saved), "utf8");
    const temp = path.join(root, crypto.randomUUID() + ".tmp");
    try { await fs.writeFile(temp, JSON.stringify(saved), "utf8"); await fs.rename(temp, path.join(root, "current.json")); }
    finally { await fs.rm(temp, { force: true }); }
    return saved;
  }); queue = operation.catch(() => undefined); return operation;
}
