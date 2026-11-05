import "server-only";
import { findCompetition } from "@/modules/competition-recommendation/data";
import { directoryToCompetition } from "../adapter";
import { readCatalog } from "./repository";
export async function resolveCompetition(id: string | null | undefined) {
  if (!id) return null;
  const record = (await readCatalog()).records.find((r) => r.id === id);
  return record ? directoryToCompetition(record) : findCompetition(id);
}
