import { z } from "zod";
import { analysisResponseSchema, competitionRequirementsSchema, guidanceReportSchema, paperSchema } from "./types";

export const ANALYSIS_STEPS = [
  { id: "uploading", label: "接收文件", detail: "上传并检查文件格式" },
  { id: "extracting", label: "提取原文", detail: "解析正文或识别图片文字" },
  { id: "keywords", label: "提炼关键词", detail: "识别专业与技术方向" },
  { id: "papers", label: "检索论文", detail: "查找并排序相关研究" },
  { id: "requirements", label: "解读比赛", detail: "主题、评分要求与时间节点" },
  { id: "topics", label: "推荐选题", detail: "结合专业提出选题方向" },
  { id: "route", label: "设计路线", detail: "组织技术步骤与实现方案" },
  { id: "scoring", label: "对齐评分", detail: "评分建议与创新点" },
  { id: "plan", label: "安排备赛", detail: "计划、风险与参考文献" },
  { id: "review", label: "校验结果", detail: "检查报告字段与来源" },
  { id: "saving", label: "建立溯源", detail: "保存报告和证据关联" },
] as const;
export const analysisStepSchema = z.enum(ANALYSIS_STEPS.map((step) => step.id));
export type AnalysisStep = z.infer<typeof analysisStepSchema>;
export const analysisEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("step"), step: analysisStepSchema, status: z.enum(["running", "done", "warning"]), message: z.string() }),
  z.object({ type: z.literal("file"), file: analysisResponseSchema.shape.file, textPreview: z.string(), characterCount: z.number() }),
  z.object({ type: z.literal("keywords"), keywords: z.array(z.string()) }),
  z.object({ type: z.literal("papers"), papers: z.array(paperSchema), cached: z.boolean() }),
  z.object({ type: z.literal("draft"), requirements: competitionRequirementsSchema.optional(), report: guidanceReportSchema.optional(), mode: z.enum(["ai", "demo"]), reset: z.boolean().optional() }),
  z.object({ type: z.literal("warning"), message: z.string() }),
  z.object({ type: z.literal("heartbeat") }),
  z.object({ type: z.literal("complete"), result: analysisResponseSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type AnalysisEvent = z.infer<typeof analysisEventSchema>;
export type StepStatus = "waiting" | "running" | "done" | "warning" | "error";
export type StepState = { status: StepStatus; message: string };
export type AnalysisPreview = {
  file?: z.infer<typeof analysisResponseSchema.shape.file>;
  textPreview: string;
  characterCount: number;
  keywords: string[];
  papers?: z.infer<typeof paperSchema>[];
  papersCached: boolean;
  requirements?: z.infer<typeof competitionRequirementsSchema>;
  report?: z.infer<typeof guidanceReportSchema>;
  mode?: "ai" | "demo";
};
