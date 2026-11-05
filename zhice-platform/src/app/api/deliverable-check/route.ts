import { generateObject } from "ai";
import { createAiModel } from "@/lib/ai-model";
import { z } from "zod";
import { getAiConfig } from "@/lib/ai-config";
import { initialCheckItems } from "@/modules/deliverable-check/data";
import type { CheckItem, CheckStatus } from "@/modules/deliverable-check/types";

export const maxDuration = 60;
const maxFileBytes = 50 * 1024 * 1024;
const accepted = new Set(["pptx", "pdf", "docx", "zip", "png", "jpg", "jpeg", "webp"]);
const statusSchema = z.enum(["pass", "warning", "fail"]);
const aiResultSchema = z.object({ items: z.array(z.object({ id: z.string(), status: statusSchema, score: z.number().min(0).max(100), evidence: z.string(), suggestion: z.string() })).min(1) });

function errorResponse(message: string, status = 400) {
  return Response.json({ ok: false, error: message }, { status });
}

function extensionOf(name: string) {
  return name.toLowerCase().split(".").pop() || "";
}

function clampScore(value: number, maxScore: number) {
  return Math.max(0, Math.min(maxScore, Math.round(value)));
}

async function inspectFile(file: File) {
  const extension = extensionOf(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const facts: string[] = [`文件名：${file.name}`, `文件类型：${extension.toUpperCase()}`, `文件大小：${Math.round(file.size / 1024)} KB`];
  if (extension === "pptx") {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      const slideCount = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length;
      facts.push(`PPT 页面数：${slideCount || "未识别"}`, `PPTX 资源文件数：${Object.keys(zip.files).length}`);
    } catch {
      facts.push("PPTX 结构读取失败，需人工打开验证。");
    }
  } else if (extension === "docx") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      facts.push(`DOCX 正文字符数：${result.value.trim().length}`, `DOCX 解析预览：${result.value.trim().slice(0, 3000)}`);
    } catch {
      facts.push("DOCX 文本读取失败，需人工打开验证。");
    }
  } else if (extension === "pdf") {
    facts.push("PDF 已接收；页数与文字层需要在服务端 PDF 解析器中进一步核验。");
  } else if (extension === "zip") {
    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(buffer);
      facts.push(`ZIP 文件数：${Object.keys(zip.files).length}`);
    } catch {
      facts.push("ZIP 结构读取失败，需人工解压验证。");
    }
  } else {
    facts.push("图片交付物需要结合 OCR 或人工视觉复核文字和版式。");
  }
  return facts.join("\n");
}

function demoItems(fileName: string, fileFacts: string): CheckItem[] {
  return initialCheckItems.map((item) => ({
    ...item,
    evidence: item.id === "openable" ? `${fileName} 已完成基础结构读取。${fileFacts.split("\n").slice(-1)[0] || ""}` : item.evidence,
  }));
}

function totalScore(items: CheckItem[]) {
  return Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(1, items.reduce((sum, item) => sum + item.maxScore, 0)) * 100);
}

export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) return errorResponse("请使用 multipart/form-data 上传成果文件。");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return errorResponse("请先上传成果文件。");
    const extension = extensionOf(file.name);
    if (!accepted.has(extension)) return errorResponse("仅支持 PPTX、PDF、DOCX、ZIP 或 PNG/JPG/WebP。", 400);
    if (file.size > maxFileBytes) return errorResponse("文件大小不能超过 50 MB。", 400);

    const fileFacts = await inspectFile(file);
    const fallbackItems = demoItems(file.name, fileFacts);
    const warnings: string[] = [];
    const aiConfig = await getAiConfig("deliverableCheck");
    let items = fallbackItems;
    let mode: "ai" | "demo" = "demo";

    if (aiConfig.enabled && aiConfig.apiKey && aiConfig.baseUrl && aiConfig.model) {
      try {
        const result = await generateObject({
          model: createAiModel(aiConfig),
          schema: aiResultSchema,
          temperature: aiConfig.temperature,
          maxOutputTokens: aiConfig.maxTokens,
          prompt: `${aiConfig.systemPrompt}\n\n请检查下面的交付物事实，并严格返回 8 项检查结果。id 必须从以下列表选择：${fallbackItems.map((item) => item.id).join(",")}。每项给出 pass、warning 或 fail，score 不得超过该项 maxScore。\n\n评分项：${fallbackItems.map((item) => `${item.id}（${item.title}，满分 ${item.maxScore}）`).join("；")}\n\n文件事实：\n${fileFacts.slice(0, 12000)}`,
        });
        const byId = new Map(result.object.items.map((item) => [item.id, item]));
        items = fallbackItems.map((item) => {
          const generated = byId.get(item.id);
          if (!generated) return item;
          return { ...item, status: generated.status as CheckStatus, score: clampScore(generated.score, item.maxScore), evidence: generated.evidence.trim() || item.evidence, suggestion: generated.suggestion.trim() };
        });
        mode = "ai";
      } catch {
        warnings.push("模型检查暂时不可用，已切换到本地规则检查；请稍后重试。" );
      }
    } else {
      warnings.push("当前使用离线演示检查。请在管理后台为“成果检查”配置国内模型 API 后启用智能评分。" );
    }

    return Response.json({ ok: true, mode, file: { name: file.name, type: file.type, size: file.size }, items, score: totalScore(items), warnings });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "成果文件检查失败，请重试。", 500);
  }
}
