import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaultVisualConfig, type VisualConfig } from "@/modules/campus-catalog/types";
import { pptMasterPlanSchema, type PptMasterPlan, type PptOutline, type PptSlide } from "../types";

const paletteByTemplate: Record<string, string[]> = {
  "zhice-dark": ["#18213A", "#243152", "#818CF8", "#F8FAFC", "#CBD5E1"],
  contest: ["#0F172A", "#1E293B", "#F97316", "#FFF7ED", "#FED7AA"],
  "tech-blue": ["#0C4A6E", "#075985", "#38BDF8", "#F0F9FF", "#BAE6FD"],
  minimal: ["#F8FAFC", "#FFFFFF", "#334155", "#0F172A", "#64748B"],
};

const safeText = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[char] || char));
const safeName = (value: string) => value.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 80) || "ppt-master";
const wrap = (value: string, width: number) => {
  const chars = [...value.trim()]; const lines: string[] = [];
  for (let index = 0; index < chars.length; index += width) lines.push(chars.slice(index, index + width).join(""));
  return lines.length ? lines : [""];
};

function visualConfigFor(template: string, config?: VisualConfig) {
  if (config) return config;
  const colors = paletteByTemplate[template] || paletteByTemplate["zhice-dark"];
  return { ...defaultVisualConfig, colors: { background: colors[0].slice(1), surface: colors[1].slice(1), accent: colors[2].slice(1), text: colors[3].slice(1), muted: colors[4].slice(1) } };
}

export function buildPptMasterPlan(outline: PptOutline, input: { sourceKind: "plan" | "docx"; sourceName: string; template?: string; style?: "story" | "technical" | "evidence"; artifactId?: string; designConfig?: VisualConfig }): PptMasterPlan {
  const config = visualConfigFor(input.template || "zhice-dark", input.designConfig);
  const style = input.style === "story" ? "通用灵活" : input.style === "technical" ? "顶级咨询" : "一般咨询";
  return pptMasterPlanSchema.parse({
    workflow: "ppt-master",
    canvas: { format: "ppt169", width: 1280, height: 720 },
    strategist: "材料 → 设计规范与页级大纲",
    executor: "页级 SVG 产物 + 原生文字形状 → 可编辑 PPTX",
    style,
    sourceKind: input.sourceKind,
    sourceName: input.sourceName,
    ...(input.artifactId ? { artifactId: input.artifactId } : {}),
    design: {
      palette: [config.colors.background, config.colors.surface, config.colors.accent, config.colors.text, config.colors.muted].map((value) => "#" + value.toUpperCase()),
      headingFont: config.fonts.heading,
      bodyFont: config.fonts.body,
      bodySizePx: Math.round(config.layouts.find((rule) => rule.kind === "problem")?.bodySize || 17),
      iconPolicy: "平台自绘基础图形",
      imagePolicy: "无图片时保留占位策略",
      notesStyle: "按页讲稿，统一写入演讲者备注",
    },
  });
}

function designSpec(plan: PptMasterPlan, outline: PptOutline) {
  return `# 设计规范与内容大纲\n\n## PPT Master 适配\n\n- 工作流：Strategist → Human Gate → Executor\n- 画布：${plan.canvas.width}×${plan.canvas.height}（16:9）\n- 风格：${plan.style}\n- 源材料：${plan.sourceKind === "plan" ? "网页计划书" : "外部 DOCX"} · ${plan.sourceName}\n- 页数：${outline.slides.length}\n- 事实门：未确认、待补充、待核验内容保留标记，不升级为确定事实。\n\n## 配色与排版\n\n- 配色：${plan.design.palette.join(" / ")}\n- 标题字体：${plan.design.headingFont}\n- 正文字体：${plan.design.bodyFont}\n- 正文字号基准：${plan.design.bodySizePx}px\n- 图标：${plan.design.iconPolicy}\n- 图片：${plan.design.imagePolicy}\n\n## 页面大纲\n\n${outline.slides.map((slide, index) => `### ${String(index + 1).padStart(2, "0")} · ${slide.title}\n- 布局：${slide.layout || "content"}\n- 要点：${slide.bullets.map((bullet) => `\n  - ${bullet}`).join("")}\n- 章节：${slide.chapterIds?.join("、") || "待关联"}\n- 证据：${slide.evidenceIds?.join("、") || "待关联"}`).join("\n\n")}\n\n## 版权与可编辑性\n\n本项目只保存平台自有设计规则和用户当前材料的归一化内容，不复制外部获奖 PPT 的文本、图片、Logo、原始坐标或整页。最终交付由平台生成可编辑文字、形状和图表；SVG 产物用于质量检查和可追溯归档。\n`;
}

function slideSvg(slide: PptSlide, index: number, plan: PptMasterPlan) {
  const [background, surface, accent, text, muted] = plan.design.palette;
  const titleLines = wrap(slide.title, slide.layout === "cover" || slide.layout === "closing" ? 22 : 30);
  const bodyLines = slide.bullets.flatMap((bullet) => wrap(bullet, 34));
  const titleY = slide.layout === "cover" || slide.layout === "closing" ? 250 : 110;
  const titleSize = slide.layout === "cover" || slide.layout === "closing" ? 54 : 38;
  const bodyStart = slide.layout === "cover" || slide.layout === "closing" ? 390 : 205;
  const bodySize = plan.design.bodySizePx;
  const title = titleLines.map((line, lineIndex) => `<text x="80" y="${titleY + lineIndex * (titleSize + 10)}" fill="${text}" font-family="${safeText(plan.design.headingFont)}" font-size="${titleSize}" font-weight="700">${safeText(line)}</text>`).join("");
  const body = bodyLines.slice(0, 15).map((line, lineIndex) => `<text x="110" y="${bodyStart + lineIndex * (bodySize + 18)}" fill="${line.startsWith("【") ? muted : text}" font-family="${safeText(plan.design.bodyFont)}" font-size="${bodySize}"><tspan fill="${accent}">•</tspan> ${safeText(line)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="${background}"/><rect x="0" y="0" width="1280" height="12" fill="${accent}"/><rect x="70" y="${slide.layout === "cover" || slide.layout === "closing" ? 170 : 155}" width="1140" height="${slide.layout === "cover" || slide.layout === "closing" ? 410 : 500}" rx="18" fill="${surface}" fill-opacity="0.82"/>${title}${body}<text x="80" y="680" fill="${muted}" font-family="${safeText(plan.design.bodyFont)}" font-size="14">知策台 · PPT Master · ${String(index + 1).padStart(2, "0")}</text></svg>`;
}

export function masterArtifactUrls(projectId: string, artifactId: string) {
  const query = `projectId=${encodeURIComponent(projectId)}&master=${encodeURIComponent(artifactId)}`;
  return { manifest: `/api/ppt?${query}&asset=manifest`, designSpec: `/api/ppt?${query}&asset=design-spec`, notes: `/api/ppt?${query}&asset=notes` };
}

export async function writePptMasterProject(input: { projectId: string; artifactId?: string; outline: PptOutline; sourceName: string; sourceMarkdown: string; sourceKind: "plan" | "docx"; template?: string; style?: "story" | "technical" | "evidence"; designConfig?: VisualConfig }) {
  const artifactId = input.artifactId || `master-${randomUUID()}`;
  const plan = buildPptMasterPlan(input.outline, { ...input, artifactId });
  const root = path.join(process.cwd(), "public", "generated-ppts", "projects", input.projectId, "ppt-master", artifactId);
  const dirs = ["sources", "notes", "svg_output", "svg_final", "templates", "images"];
  await Promise.all(dirs.map((dir) => fs.mkdir(path.join(root, dir), { recursive: true })));
  const spec = designSpec(plan, input.outline);
  const notes = input.outline.slides.map((slide, index) => `# ${String(index + 1).padStart(2, "0")} · ${slide.title}\n\n${slide.speakerNotes || "【建议补充】请补充本页讲稿。"}`).join("\n\n");
  const slides = input.outline.slides.map((slide, index) => ({ id: slide.id, fileName: `${String(index + 1).padStart(2, "0")}_${safeName(slide.title)}.svg`, title: slide.title, layout: slide.layout || "content", chapterIds: slide.chapterIds || [], evidenceIds: slide.evidenceIds || [], sourceIds: slide.sourceIds || [] }));
  const manifest = { ...plan, artifactUrls: masterArtifactUrls(input.projectId, artifactId), generatedAt: new Date().toISOString(), projectId: input.projectId, source: { fileName: safeName(input.sourceName), markdown: "sources/input.md" }, slides, postProcess: "platform-safe baseline; no external images or icon references" };
  await Promise.all([
    fs.writeFile(path.join(root, "README.md"), `# PPT Master 项目\n\n- 仅用于 ${input.projectId} 的本次生成\n- 工作流：${plan.strategist} → Human Gate → ${plan.executor}\n- 源材料、设计规范、页级 SVG 和演讲备注均按项目隔离。\n- ${plan.design.imagePolicy}\n`, "utf8"),
    fs.writeFile(path.join(root, "sources", "input.md"), input.sourceMarkdown, "utf8"),
    fs.writeFile(path.join(root, "设计规范与内容大纲.md"), spec, "utf8"),
    fs.writeFile(path.join(root, "notes", "total.md"), notes + "\n", "utf8"),
    fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8"),
  ]);
  await Promise.all(input.outline.slides.map((slide, index) => {
    const fileName = slides[index].fileName;
    const svg = slideSvg(slide, index, plan);
    return Promise.all([fs.writeFile(path.join(root, "svg_output", fileName), svg, "utf8"), fs.writeFile(path.join(root, "svg_final", fileName), svg, "utf8")]);
  }));
  return { artifactId, plan, manifest, root };
}

export async function readMasterAsset(projectId: string, artifactId: string, asset: "manifest" | "design-spec" | "notes") {
  if (!/^master-[a-f0-9-]{36}$/.test(artifactId)) throw new Error("无效的 PPT Master 产物标识。");
  const fileName = asset === "manifest" ? "manifest.json" : asset === "design-spec" ? "设计规范与内容大纲.md" : path.join("notes", "total.md");
  return fs.readFile(path.join(process.cwd(), "public", "generated-ppts", "projects", projectId, "ppt-master", artifactId, fileName));
}
