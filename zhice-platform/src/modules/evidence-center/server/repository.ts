import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { seedEvidenceDatabase } from "../data";
import { evidenceDatabaseSchema, type EvidenceDatabase, type EvidenceRecord, type EvidenceStatus } from "../types";

const databasePath = path.join(process.cwd(), "data", "evidence-hub.json");
let writeQueue: Promise<unknown> = Promise.resolve();

export async function readEvidenceDatabase(): Promise<EvidenceDatabase> {
  try {
    return evidenceDatabaseSchema.parse(JSON.parse(await fs.readFile(databasePath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(seedEvidenceDatabase);
    // Do not silently overwrite corrupt/user-owned data with demo records.
    throw new Error("证据库读取失败，请检查数据文件或从备份恢复。");
  }
}

export function mutateEvidenceDatabase<T>(update: (database: EvidenceDatabase) => T | Promise<T>): Promise<T> {
  const operation = writeQueue.then(async () => {
    const database = await readEvidenceDatabase();
    const result = await update(database);
    const validated = evidenceDatabaseSchema.parse(database);
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    const temporary = databasePath + "." + crypto.randomUUID() + ".tmp";
    try {
      await fs.writeFile(temporary, JSON.stringify(validated, null, 2), "utf8");
      await fs.rename(temporary, databasePath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

export function materializeEvidence(database: EvidenceDatabase): EvidenceRecord[] {
  return database.records.map((record) => ({
    ...record,
    citations: database.citations.filter((link) => link.evidenceId === record.id).flatMap((link) => {
      const report = database.reports.find((item) => item.id === link.reportId);
      const block = report?.blocks.find((item) => item.id === link.blockId);
      if (!report || !block) return [];
      return [{
        id: link.id, targetType: "guidanceReport" as const,
        targetTitle: report.title, section: block.heading, excerpt: block.text,
        href: "/reports/" + encodeURIComponent(report.id) + "#" + encodeURIComponent(block.id),
        verification: link.verification,
      }];
    }),
  }));
}

export async function setEvidenceStatus(id: string, status: EvidenceStatus) {
  return mutateEvidenceDatabase((database) => {
    const record = database.records.find((item) => item.id === id);
    if (!record) return null;
    record.status = status;
    return materializeEvidence(database).find((item) => item.id === id)!;
  });
}

export async function getEvidenceReport(id: string) {
  const database = await readEvidenceDatabase();
  const data = database.reports.find((report) => report.id === id);
  if (!data) return null;
  const citations = database.citations.filter((link) => link.reportId === id);
  const evidence = materializeEvidence(database).filter((item) => citations.some((link) => link.evidenceId === item.id));
  return { data, evidence, citations };
}
