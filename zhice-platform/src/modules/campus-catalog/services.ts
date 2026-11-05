import { z } from "zod";
import { apiRequest } from "@/shared/api-client";
import { competitionSchema } from "@/modules/competition-recommendation/types";
import { installCampusCatalog } from "@/modules/competition-recommendation/data";
import { catalogDatabaseSchema, directoryPreviewSchema, templateRecordSchema } from "./types";
export const publicCatalogSchema = z.object({ revision: z.number(), competitions: z.array(competitionSchema), templates: z.array(templateRecordSchema) });
const json = (body: unknown) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export async function loadCampusCatalog(signal?: AbortSignal) {
  const { data } = await apiRequest("/api/catalog", z.object({ data: publicCatalogSchema }), { signal });
  installCampusCatalog(data.competitions); return data;
}
export const loadAdminCatalog = () => apiRequest("/api/admin/catalog", z.object({ data: catalogDatabaseSchema })).then((r) => r.data);
export const previewDirectory = (content: string, format: "json" | "csv") => apiRequest("/api/admin/catalog", z.object({ data: directoryPreviewSchema }), json({ action: "preview", content, format })).then((r) => r.data);
export const commitDirectory = (content: string, format: "json" | "csv", token: string) => apiRequest("/api/admin/catalog", z.object({ data: z.object({ added: z.array(z.unknown()), skipped: z.number() }) }), json({ action: "import", content, format, token }));
export const catalogAction = (body: unknown) => apiRequest("/api/admin/catalog", z.object({ data: z.unknown() }), json(body));
export const uploadTemplate = (form: FormData) => apiRequest("/api/admin/catalog", z.object({ data: templateRecordSchema }), { method: "POST", body: form });
