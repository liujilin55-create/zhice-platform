import JSZip from "jszip";
import { z } from "zod";
import { parsedDocxSchema, type ParsedDocx } from "./types";

export const MAX_DOCX_BYTES = 15 * 1024 * 1024;

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
const tagMatches = (html: string, tag: string) => Array.from(html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))).map((match) => stripHtml(match[1])).filter(Boolean);

export function validateDocx(file: File) {
  if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("仅支持上传 .docx 文件，暂不接受 PDF、DOC 或其他格式。");
  if (file.size > MAX_DOCX_BYTES) throw new Error("DOCX 文件大小不能超过 15 MB，请压缩图片后重试。");
}

export async function parseDocx(file: File): Promise<ParsedDocx> {
  validateDocx(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const mammoth = await import("mammoth");
  const [rawResult, htmlResult, zip] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
    JSZip.loadAsync(buffer),
  ]);
  const html = htmlResult.value;
  const headings = Array.from(html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)).map((match) => ({ level: Number(match[1]), text: stripHtml(match[2]) })).filter((item) => item.text);
  const paragraphs = tagMatches(html, "p");
  const tables = Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)).map((tableMatch) => {
    const rows = Array.from(tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((rowMatch) => tagMatches(rowMatch[1], "t[dh]"));
    return { headers: rows[0] ?? [], rows: rows.slice(1) };
  }).filter((table) => table.headers.length || table.rows.length);
  const imageCount = Object.keys(zip.files).filter((name) => /^word\/media\//i.test(name) && !zip.files[name].dir).length;
  const title = headings[0]?.text || paragraphs[0] || file.name.replace(/\.docx$/i, "");
  const text = rawResult.value.replace(/\s+/g, " ").trim();
  return parsedDocxSchema.parse({ fileName: file.name, size: file.size, title, headings, paragraphs: paragraphs.slice(0, 120), tables: tables.slice(0, 12), imageCount, textPreview: text.slice(0, 5000) });
}

export const outlineInputSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  slides: z.array(z.object({ id: z.string(), title: z.string(), bullets: z.array(z.string()), speakerNotes: z.string(), layout: z.enum(["cover", "agenda", "content", "section", "closing"]) })),
});
