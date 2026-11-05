import pptxgen from "pptxgenjs";
import type { PptOutline, PptSlide, PptTemplate } from "./types";
import { defaultVisualConfig, pageKinds, type VisualConfig } from "@/modules/campus-catalog/types";

type Theme = { background: string; surface: string; accent: string; text: string; muted: string };
const themes: Record<string, Theme> = {
  "zhice-dark": { background: "18213A", surface: "243152", accent: "818CF8", text: "F8FAFC", muted: "CBD5E1" },
  contest: { background: "0F172A", surface: "1E293B", accent: "F97316", text: "FFF7ED", muted: "FED7AA" },
  "tech-blue": { background: "0C4A6E", surface: "075985", accent: "38BDF8", text: "F0F9FF", muted: "BAE6FD" },
  minimal: { background: "F8FAFC", surface: "FFFFFF", accent: "334155", text: "0F172A", muted: "64748B" },
};
export function slidePageKind(item: PptSlide): typeof pageKinds[number] {
  if ((pageKinds as readonly string[]).includes(item.layout)) return item.layout as typeof pageKinds[number];
  const topic = item.topicIds?.[0];
  const topics: Record<string, typeof pageKinds[number]> = { problem: "problem", users: "problem", solution: "solution", innovation: "solution", technology: "architecture", validation: "data", resources: "business", team: "team", schedule: "plan", risk: "problem", summary: "closing" };
  return topics[topic || ""] || (/数据|结果|验证/.test(item.title) ? "data" : /流程/.test(item.title) ? "process" : /架构|技术/.test(item.title) ? "architecture" : /商业|财务/.test(item.title) ? "business" : /团队/.test(item.title) ? "team" : /计划/.test(item.title) ? "plan" : "solution");
}
/** Only exact confirmed plan facts with one numeric value and a common explicit unit become chart data. */
export function confirmedChartData(item: PptSlide) {
  const rows: Array<{ label: string; value: number; unit: string }> = [];
  for (const bullet of item.bullets) {
    if (!item.claims?.some((c) => c.text === bullet && c.confirmed && c.origin !== "pending") || /待核验|建议补充|推断|预计|预测|目标|计划/.test(bullet)) continue;
    const matches = [...bullet.matchAll(/-?\d+(?:\.\d+)?/g)];
    if (matches.length !== 1) continue;
    const number = matches[0]; const unit = bullet.slice(number.index! + number[0].length).match(/^\s*(%|％|万元|元|小时|分钟|秒|人|次|个|件|台)/)?.[1];
    if (!unit || !Number.isFinite(Number(number[0]))) continue;
    rows.push({ label: bullet, value: Number(number[0]), unit: unit === "％" ? "%" : unit });
  }
  return rows.length >= 2 && rows.every((r) => r.unit === rows[0].unit) ? rows : [];
}
export async function renderPptx(outline: PptOutline, template: PptTemplate, registeredConfig?: VisualConfig) {
  if (!themes[template] && !registeredConfig) throw new Error("模板未加载或未授权");
  const config = registeredConfig || { ...defaultVisualConfig, colors: themes[template] };
  const theme = config.colors; const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; pptx.author = "知策台"; pptx.company = "知策台 AI Project OS";
  pptx.subject = "Platform-owned editable layout; templateId=" + template; pptx.title = outline.title;
  pptx.theme = { headFontFace: config.fonts.heading, bodyFontFace: config.fonts.body };
  outline.slides.forEach((item, index) => {
    const slide = pptx.addSlide(); slide.background = { color: theme.background };
    const kind = slidePageKind(item); const rule = config.layouts.find((r) => r.kind === kind)!;
    const body = { fontFace: config.fonts.body, fontSize: rule.bodySize, color: theme.text, margin: 0, fit: "shrink" as const, breakLine: false };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .12, line: { transparency: 100 }, fill: { color: theme.accent } });
    if (kind === "cover" || kind === "closing") {
      const center = (kind === "cover" ? config.coverLayout : config.closingLayout) === "center";
      slide.addShape(pptx.ShapeType.ellipse, { x: 9.2, y: -.6, w: 4.6, h: 4.6, line: { transparency: 100 }, fill: { color: theme.accent, transparency: 85 } });
      slide.addText(outline.subtitle, { ...body, x: .85, y: 1.0, w: 11.6, h: .6, color: theme.accent, fontSize: 14, align: center ? "center" : "left" });
      slide.addText(item.title, { ...body, fontFace: config.fonts.heading, x: .85, y: 2.0, w: 11.6, h: 1.5, fontSize: rule.titleSize + 4, bold: true, align: center ? "center" : "left" });
      slide.addText(item.bullets.join("\n"), { ...body, x: 1, y: 4.0, w: 11.3, h: 1.9, color: theme.muted, align: center ? "center" : "left" });
    } else {
      slide.addText(String(index + 1).padStart(2, "0"), { ...body, x: .7, y: .62, w: .55, h: .4, color: theme.accent, fontSize: 14, bold: true });
      slide.addText(item.title, { ...body, fontFace: config.fonts.heading, x: 1.4, y: .54, w: 11, h: .65, fontSize: rule.titleSize, bold: true });
      slide.addShape(pptx.ShapeType.line, { x: .85, y: 1.36, w: 11.6, h: 0, line: { color: theme.accent, width: 1.2 } });
      const chart = rule.arrangement === "chart" ? confirmedChartData(item) : [];
      if (chart.length) {
        slide.addChart(config.chartStyle === "line" ? pptx.ChartType.line : pptx.ChartType.bar, [{ name: "已确认数值（" + chart[0].unit + "）", labels: chart.map((r) => r.label), values: chart.map((r) => r.value) }], { x: 1, y: 1.8, w: 11.3, h: 4.3, showLegend: false, showValue: true, showTitle: false, chartColors: [theme.accent], catAxisLabelColor: theme.text, valAxisLabelColor: theme.muted, dataLabelColor: theme.text });
      } else if (rule.arrangement === "columns") {
        const count = Math.min(3, item.bullets.length); const width = 11.4 / count;
        for (let column = 0; column < count; column++) {
          const bullets = item.bullets.filter((_, i) => i % count === column);
          slide.addShape(pptx.ShapeType.roundRect, { x: .9 + column * width, y: 1.85, w: width - .2, h: 3.9, rectRadius: .12, line: { transparency: 100 }, fill: { color: theme.surface } });
          slide.addText(String(column + 1).padStart(2, "0"), { ...body, x: 1.1 + column * width, y: 2.1, w: width - .7, h: .5, color: theme.accent, bold: true, fontSize: 24 });
          slide.addText(bullets.join("\n\n"), { ...body, x: 1.1 + column * width, y: 2.9, w: width - .65, h: 2.3 });
        }
      } else if (rule.arrangement === "steps") {
        item.bullets.forEach((bullet, i) => {
          const y = 1.75 + i * .82;
          slide.addShape(pptx.ShapeType.roundRect, { x: 1, y, w: .48, h: .48, rectRadius: .05, line: { transparency: 100 }, fill: { color: theme.accent } });
          slide.addText(String(i + 1), { ...body, x: 1, y: y + .05, w: .48, h: .3, fontSize: 14, align: "center", color: theme.background });
          if (i < item.bullets.length - 1) slide.addShape(pptx.ShapeType.line, { x: 1.24, y: y + .52, w: 0, h: .25, line: { color: theme.accent, width: 1.5 } });
          slide.addText(bullet, { ...body, x: 1.8, y, w: 10.3, h: .6 });
        });
      } else {
        item.bullets.forEach((bullet, i) => { const y = 1.8 + i * .8; slide.addShape(pptx.ShapeType.ellipse, { x: 1.05, y: y + .13, w: .16, h: .16, line: { transparency: 100 }, fill: { color: theme.accent } }); slide.addText(bullet, { ...body, x: 1.5, y, w: 10.5, h: .62 }); });
      }
    }
    slide.addText(`知策台 · 自有版式 / ${kind} · ${index + 1}`, { ...body, x: 1, y: 6.85, w: 4, h: .2, fontSize: 8, color: theme.muted });
    slide.addText(item.chapterIds?.length ? "计划书来源：" + item.chapterIds.join(" · ") : "来源待补充 · 请核对备注", { ...body, x: 5, y: 6.85, w: 7.2, h: .2, fontSize: 8, color: theme.muted });
    slide.addNotes(item.speakerNotes + `\n\n模板：${template} · 平台自有规则渲染，未复用原获奖页面\n` + (outline.planSource ? `计划书版本：${outline.planSource.version}\n项目：${outline.planSource.binding.projectId}\n比赛：${outline.planSource.binding.competitionId}\n章节：${(item.chapterIds || []).join("、") || "待补充"}\n证据：${(item.evidenceIds || []).join("、") || "尚未关联"}\n来源：${(item.sourceIds || []).join("、") || "待核验"}\n` + (item.claims || []).map((claim) => `${claim.origin === "user" ? "用户修改" : claim.origin === "ai" ? "AI 生成（已由用户确认）" : "待核验"}：${claim.text}\n内容块：${claim.blockIds.join("、") || "无"}`).join("\n") + "\n\n核验提示：\n" + (outline.reviewWarnings || []).join("\n") : ""));
  });
  return Buffer.from(await pptx.write({ outputType: "nodebuffer", compression: true }) as Buffer);
}
