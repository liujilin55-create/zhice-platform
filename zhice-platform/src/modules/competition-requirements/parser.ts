import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getAiConfig } from "@/lib/ai-config";
import { createAiModel } from "@/lib/ai-model";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const acceptedExtensions = new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg", "webp"]);
let pdfWorkerConfigured = false;

export type ParsedUpload = {
  text: string;
  parser: string;
  isImage: boolean;
  warnings: string[];
};

function extensionOf(fileName: string) {
  return fileName.toLowerCase().split(".").pop() || "";
}

/**
 * pdfjs disables real workers in Node and falls back to importing the worker
 * from `GlobalWorkerOptions.workerSrc`. When this module is bundled by
 * Next/Turbopack, its default relative path points at a non-existent
 * `.next/.../chunks/pdf.worker.mjs`. Point it at the worker shipped with the
 * installed pdf-parse package instead.
 */
function configurePdfWorker() {
  if (pdfWorkerConfigured) return;

  const workerPath = path.resolve(process.cwd(), "node_modules/pdf-parse/dist/worker/pdf.worker.mjs");
  if (!existsSync(workerPath)) {
    throw new Error("PDF 解析组件缺少 Node worker 文件，请重新安装 pdf-parse 依赖。");
  }

  // PDFParse.setWorker accepts a URL string and pdfjs imports it directly in
  // its Node fake-worker bridge. A file URL works on Windows and POSIX paths.
  return pathToFileURL(workerPath).href;
}

export function validateUpload(file: File) {
  const extension = extensionOf(file.name);
  if (!acceptedExtensions.has(extension)) throw new Error("仅支持 PDF、Word（DOC/DOCX）或 PNG/JPG/WEBP 图片。");
  if (file.size > MAX_FILE_BYTES) throw new Error("文件大小不能超过 15 MB，请压缩后重试。");
  return extension;
}

export async function parseUpload(file: File, signal?: AbortSignal): Promise<ParsedUpload> {
  signal?.throwIfAborted();
  const extension = validateUpload(file);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value.trim(), parser: "Mammoth DOCX 文本解析", isImage: false, warnings: result.messages.map((message) => message.message) };
  }

  if (extension === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    if (!pdfWorkerConfigured) {
      PDFParse.setWorker(configurePdfWorker());
      pdfWorkerConfigured = true;
    }
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { text: result.text.trim(), parser: "pdf-parse 文本解析", isImage: false, warnings: [] };
    } finally {
      await parser.destroy();
    }
  }

  if (extension === "doc") {
    const officeEndpoint = process.env.OFFICE_PARSE_API_URL;
    if (officeEndpoint) {
      const body = new FormData();
      body.append("file", new Blob([buffer]), file.name);
      const response = await fetch(officeEndpoint, { method: "POST", body, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(9000)]) : AbortSignal.timeout(9000) });
      if (response.ok) {
        const payload = await response.json() as { text?: string; result?: string; data?: { text?: string } };
        const text = payload.text || payload.result || payload.data?.text || "";
        if (text) return { text, parser: "Office 转换服务", isImage: false, warnings: [] };
      }
    }
    return { text: "旧版 DOC 文件已接收。请在后台配置 OFFICE_PARSE_API_URL，或另存为 DOCX 以获得完整文本。", parser: "DOC 兼容占位解析", isImage: false, warnings: ["旧版 DOC 的版式解析依赖后台 Office 转换服务。"] };
  }

  return { text: `图片文件 ${file.name} 已接收，等待视觉模型进行 OCR。`, parser: "视觉模型 OCR", isImage: true, warnings: [] };
}

export async function extractImageText(file: File, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const apiUrl = process.env.OCR_API_URL;
  const aiConfig = await getAiConfig("competitionRequirements");
  const apiKey = process.env.OCR_API_KEY || aiConfig.apiKey;
  if (!apiUrl && aiConfig.enabled && aiConfig.apiKey && aiConfig.baseUrl && aiConfig.model) {
    const { generateText } = await import("ai");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await generateText({
      model: createAiModel(aiConfig),
      messages: [{ role: "user", content: [{ type: "text", text: "请只提取这张比赛通知图片中的文字，保留标题、评分标准、提交物和时间节点。不要总结，不要添加原图没有的信息。" }, { type: "file", mediaType: "image", data: buffer }] }],
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxTokens,
      abortSignal: signal,
    });
    return result.text.trim();
  }
  if (!apiUrl || !apiKey) return "";
  const buffer = Buffer.from(await file.arrayBuffer());
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": file.type || "image/jpeg" },
    body: buffer,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(9000)]) : AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`OCR 服务返回 ${response.status}`);
  const payload = await response.json() as { text?: string; result?: string; data?: { text?: string } };
  return payload.text || payload.result || payload.data?.text || "";
}
