import type { OrchestrationTask } from "./types";

export const initialOrchestrationTasks: OrchestrationTask[] = [
  { id: "task-1", title: "完成用户痛点与需求定义", description: "整理访谈证据并确定首个可验证场景。", owner: "林溪", due: "今天 18:00", tag: "产品", priority: "high", status: "done", dependencies: [], checklist: ["访谈证据", "用户画像", "验收指标"] },
  { id: "task-2", title: "补充竞品调研证据链", description: "为竞品判断补充来源、页码和可复核原文。", owner: "陈默", due: "明天 12:00", tag: "研究", priority: "high", status: "active", dependencies: ["task-1"], checklist: ["3 个来源", "引用片段", "结论对比"] },
  { id: "task-3", title: "搭建 AI Agent 执行流程", description: "完成检索、创建任务、检查证据的工具调用闭环。", owner: "林溪", due: "明天 18:00", tag: "技术", priority: "high", status: "active", dependencies: ["task-2"], checklist: ["工具 schema", "最多 3 步", "失败兜底"] },
  { id: "task-4", title: "完成多模态方案检查", description: "验证图片、Word、PDF 进入统一分析流程。", owner: "未分配", due: "11 月 2 日", tag: "设计", priority: "medium", status: "blocked", dependencies: ["task-3"], checklist: ["文件类型", "OCR 结果", "错误提示"] },
  { id: "task-5", title: "整理答辩演示与交付物", description: "串联比赛要求、证据、任务和 PPT 的现场演示。", owner: "全员", due: "11 月 3 日", tag: "交付", priority: "medium", status: "todo", dependencies: ["task-3", "task-4"], checklist: ["3 分钟脚本", "PPT 检查", "部署地址"] },
  { id: "task-6", title: "补齐成果引用页", description: "把论文与比赛规则引用放入最终 PPT。", owner: "陈默", due: "明天 20:00", tag: "交付", priority: "low", status: "todo", dependencies: ["task-2"], checklist: ["论文链接", "页码", "格式统一"] },
];
