import { z } from "zod";
import { hasAdminCookie } from "@/lib/admin-auth";
import { commitImport, previewImport, readCatalog, registerTemplate, reviewRecord } from "@/modules/campus-catalog/server/repository";
import { extractPptStyle } from "@/modules/campus-catalog/server/ppt-extractor";
export async function GET(request: Request) {
  if (!hasAdminCookie(request)) return Response.json({ error: "请先登录管理后台。" }, { status: 401 });
  try { return Response.json({ data: await readCatalog() }); } catch { return Response.json({ error: "目录读取失败。" }, { status: 503 }); }
}
export async function POST(request: Request) {
  if (!hasAdminCookie(request)) return Response.json({ error: "请先登录管理后台。" }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 22 * 1024 * 1024) return Response.json({ error: "请求文件过大。" }, { status: 413 });
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData(); const file = form.get("file");
      if (!(file instanceof File)) throw new Error("请上传 PPTX 参考文件");
      const result = await extractPptStyle(file);
      if (form.get("action") === "extract") return Response.json({ data: result });
      const metadata = JSON.parse(String(form.get("metadata") || "{}"));
      // Extracted config is authoritative here. User can change rules later via a new registry entry.
      return Response.json({ data: await registerTemplate({ ...metadata, sourceFile: file.name, config: result.config }, result) });
    }
    const body = z.object({ action: z.enum(["preview", "import", "review", "template"]), content: z.string().max(2_000_000).optional(), format: z.enum(["json", "csv"]).optional(), token: z.string().optional(), kind: z.enum(["competition", "template"]).optional(), id: z.string().optional(), review: z.unknown().optional(), template: z.unknown().optional() }).parse(await request.json());
    if (body.action === "preview" || body.action === "import") {
      if (!body.content || !body.format) throw new Error("请选择目录 JSON/CSV 文件");
      return Response.json({ data: body.action === "preview" ? await previewImport(body.content, body.format) : await commitImport(body.content, body.format, body.token || "") });
    }
    if (body.action === "review") { if (!body.kind || !body.id) throw new Error("缺少核验记录标识"); return Response.json({ data: await reviewRecord(body.kind, body.id, body.review) }); }
    return Response.json({ data: await registerTemplate(body.template) });
  } catch (e) { return Response.json({ error: e instanceof z.ZodError ? e.issues.map((i) => i.path.join(".") + " " + i.message).join("；") : e instanceof Error ? e.message : "导入失败，请检查文件" }, { status: 400 }); }
}
