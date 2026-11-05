import type { ParsedDocx, PptOutline, PptPageRange, PptTemplate } from "./types";

export const templateOptions: Array<{ id: PptTemplate; name: string; description: string; colors: string[] }> = [
  { id: "zhice-dark", name: "知策深靛", description: "深色科技感，适合 AI 产品答辩", colors: ["#18213a", "#6366f1", "#e0e7ff"] },
  { id: "contest", name: "竞赛答辩", description: "高对比信息卡，突出评分证据", colors: ["#0f172a", "#f97316", "#fff7ed"] },
  { id: "tech-blue", name: "科技蓝", description: "清爽蓝色，适合技术方案汇报", colors: ["#0c4a6e", "#0ea5e9", "#e0f2fe"] },
  { id: "minimal", name: "极简留白", description: "轻量留白，适合研究型展示", colors: ["#f8fafc", "#334155", "#e2e8f0"] },
];

export const pageRangeOptions: Array<{ value: PptPageRange; label: string; hint: string }> = [
  { value: "8-10", label: "8—10 页", hint: "快速答辩" },
  { value: "11-13", label: "11—13 页", hint: "完整方案" },
  { value: "14-15", label: "14—15 页", hint: "内容较丰富" },
];

export const targetPagesFor = (range: PptPageRange) => range === "8-10" ? 9 : range === "11-13" ? 12 : 15;

const fallbackSections = [
  ["问题与背景", "说明为什么现在需要解决这个问题", "补充用户、场景和现有方案的痛点", "用一句话明确本次汇报要回答的问题"],
  ["目标用户与需求", "定义核心用户和高频使用场景", "列出用户最需要的三个结果", "明确验证需求的证据或指标"],
  ["核心方案", "用一张图解释产品如何从输入走到输出", "把关键流程拆成可理解的步骤", "突出最有差异化的能力"],
  ["技术架构", "展示前端、服务端、模型和数据层的关系", "说明关键技术选择及其理由", "标注可扩展和可替换的接口"],
  ["AI 工作流", "展示模型、检索、工具调用或多模态链路", "说明每一步输入、输出和校验方式", "用可追溯证据证明 AI 不是单次问答"],
  ["产品体验", "展示用户从第一次进入到完成任务的路径", "强调交互反馈、异常状态和可编辑能力", "给出一处具体的体验创新"],
  ["评分点映射", "逐项对应比赛评分标准", "说明每个评分点的产品证据", "列出答辩时的演示动作"],
  ["落地与价值", "说明目标用户、使用频率和推广场景", "评估社会价值或商业潜力", "给出下一阶段可验证的指标"],
  ["计划与风险", "按阶段拆解研发和交付计划", "列出资源、依赖和主要风险", "说明失败时的兜底方案"],
  ["总结与下一步", "回顾问题、方案和可验证成果", "再次强调核心创新点", "给出下一步行动和联系方式"],
];

export function createDemoOutline(document: ParsedDocx, targetPages: number): PptOutline {
  const title = document.title || document.fileName.replace(/\.docx$/i, "") || "项目汇报";
  const sourceHeadings = document.headings.map((heading) => heading.text).filter(Boolean);
  const slides = Array.from({ length: targetPages }, (_, index) => {
    const section = fallbackSections[index % fallbackSections.length];
    const heading = sourceHeadings[index - 1];
    const slideTitle = index === 0 ? title : heading || section[0];
    return {
      id: `slide-${index + 1}`,
      title: slideTitle,
      bullets: index === 0 ? ["从材料中提炼可执行的核心结论", "围绕用户、方案、技术和价值展开", "支持现场演示与答辩追问"] : section.slice(1),
      speakerNotes: index === 0 ? `开场介绍：本次汇报将围绕“${title}”展开，先说明问题，再展示方案、技术和验证结果。` : `本页讲解重点是“${slideTitle}”。请结合原始文档中的相关段落，先给出结论，再补充证据和下一步。`,
      layout: index === 0 ? "cover" as const : index === targetPages - 1 ? "closing" as const : "content" as const,
    };
  });
  return { title, subtitle: "AI 生成的项目汇报 · 知策台 PPT Master 工作流", slides };
}
