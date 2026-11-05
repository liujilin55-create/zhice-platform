import "server-only";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { defaultVisualConfig, type VisualConfig } from "../types";

/** Inspect only design metadata in memory. No slide text, image bytes, logos or source slides are persisted or returned. */
export async function extractPptStyle(file: File) {
  if (!/\.pptx$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw new Error("仅支持 20 MB 以内的 .pptx 参考文件");
  const bytes = Buffer.from(await file.arrayBuffer()); const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files);
  const total = entries.reduce((n, f) => n + ((f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0), 0);
  if (entries.length > 5000 || total > 100 * 1024 * 1024) throw new Error("PPTX 解压体积超出限制");
  const slides = entries.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name));
  if (!slides.length || slides.length > 200) throw new Error("PPTX 页面数量无效或超过 200 页");
  slides.sort((a, b) => Number(a.name.match(/slide(\d+)/)![1]) - Number(b.name.match(/slide(\d+)/)![1]));
  const colors = new Map<string, number>(); const fonts = new Map<string, number>(); const sizes: number[] = [];
  const presentation = await zip.file("ppt/presentation.xml")?.async("string");
  const pageWidth = Number(presentation?.match(/<p:sldSz\b[^>]*\bcx="(\d+)"/)?.[1]) || 12192000;
  let columnPages = 0; let coverCenter = false; let closingCenter = false;
  for (const entry of entries.filter((f) => /^ppt\/(theme\/theme\d+|slides\/slide\d+)\.xml$/.test(f.name))) {
    const xml = await entry.async("string"); if (xml.length > 3_000_000) throw new Error("PPTX 样式内容过大");
    for (const match of xml.matchAll(/<a:srgbClr\b[^>]*\bval="([\dA-Fa-f]{6})"/g)) { const c = match[1].toUpperCase(); colors.set(c, (colors.get(c) || 0) + 1); }
    for (const match of xml.matchAll(/<a:(?:latin|ea)\b[^>]*\btypeface="([^"<&]{1,80})"/g)) { const f = match[1]; if (!f.startsWith("+")) fonts.set(f, (fonts.get(f) || 0) + 1); }
    for (const match of xml.matchAll(/<a:(?:rPr|defRPr)\b[^>]*\bsz="(\d+)"/g)) { const size = Number(match[1]) / 100; if (size >= 12 && size <= 40) sizes.push(size); }
    if (slides.some((s) => s.name === entry.name)) {
      const positions = [...xml.matchAll(/<a:off\b[^>]*\bx="(\d+)"/g)].map((m) => Number(m[1]) / pageWidth);
      if (positions.some((x) => x < .35) && positions.some((x) => x > .5)) columnPages++;
      const centered = /<a:pPr\b[^>]*\balgn="ctr"/.test(xml);
      if (entry.name === slides[0].name) coverCenter = centered;
      if (entry.name === slides.at(-1)!.name) closingCenter = centered;
    }
  }
  const ranked = [...colors].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const accent = ranked.find((c) => { const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); return Math.max(...rgb) - Math.min(...rgb) > 55; }) || defaultVisualConfig.colors.accent;
  const font = [...fonts].sort((a, b) => b[1] - a[1])[0]?.[0] || "Aptos";
  sizes.sort((a, b) => a - b);
  const config: VisualConfig = structuredClone(defaultVisualConfig);
  config.colors.accent = accent; config.fonts = { heading: font, body: font };
  config.coverLayout = coverCenter ? "center" : "left"; config.closingLayout = closingCenter ? "center" : "left";
  // Normalize into our own layout system; original coordinates and pages are not copied.
  config.layouts = config.layouts.map((rule) => ({ ...rule, titleSize: Math.max(24, Math.min(36, sizes[Math.floor(sizes.length * .8)] || 28)), bodySize: Math.max(14, Math.min(20, sizes[Math.floor(sizes.length * .3)] || 17)) }));
  if (columnPages > slides.length / 2) config.layouts = config.layouts.map((rule) => ["problem", "solution"].includes(rule.kind) ? { ...rule, arrangement: "columns" } : rule);
  const chartFiles = entries.filter((f) => /^ppt\/charts\/chart\d+\.xml$/.test(f.name));
  let lineCharts = 0;
  for (const chart of chartFiles) { const xml = await chart.async("string"); if (xml.length > 3_000_000) throw new Error("图表样式内容过大"); if (/<c:lineChart\b/.test(xml)) lineCharts++; }
  if (lineCharts > chartFiles.length / 2) config.chartStyle = "line";
  return { sourceHash: createHash("sha256").update(bytes).digest("hex"), slideCount: slides.length, method: "内存统计配色、字体、字号、分栏倾向、首尾对齐与图表类型；归一化到平台原创 11 类布局；不保存原文、图片、Logo、数据与原始坐标", config };
}
