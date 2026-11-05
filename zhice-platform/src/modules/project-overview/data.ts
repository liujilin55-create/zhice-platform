import type { OverviewMilestone, OverviewRisk } from "./types";

export const overviewRisks: OverviewRisk[] = [
  { id: "risk-agent", title: "Agent 任务缺少验收标准", detail: "竞品调研需要补充最少来源数、结论格式和截止时间。", tone: "high", source: "评分细则 · AI 技术深度", resolved: false },
  { id: "risk-ppt", title: "多模态交付物尚未检查", detail: "PPT 已生成，但还没有完成内容、引用和视觉一致性检查。", tone: "medium", source: "成果检查", resolved: false },
  { id: "risk-source", title: "两条结论缺少原文引用", detail: "项目价值和社会影响需要补充访谈或公开数据来源。", tone: "low", source: "证据中心", resolved: false },
];

export const overviewMilestones: OverviewMilestone[] = [
  { id: "m1", title: "锁定用户痛点与比赛切入点", date: "今天", detail: "已完成访谈摘要和目标用户画像", status: "done" },
  { id: "m2", title: "完成比赛要求拆解与论文检索", date: "今天 18:00", detail: "等待人工确认 4 个评分点映射", status: "active" },
  { id: "m3", title: "打磨 Agent 工作流和证据链", date: "明天 18:00", detail: "补齐工具调用、失败重试与引用", status: "upcoming" },
  { id: "m4", title: "答辩演示、成果检查和部署", date: "后天", detail: "固定演示数据并完成最终回归", status: "upcoming" },
];

export const overviewMetrics = [
  { label: "证据片段", value: "16", delta: "+4 今日新增", tone: "indigo" },
  { label: "任务完成", value: "2 / 5", delta: "40% 已完成", tone: "emerald" },
  { label: "风险待处理", value: "03", delta: "1 项高优先级", tone: "orange" },
  { label: "交付准备度", value: "68%", delta: "+12% 本周", tone: "violet" },
] as const;
