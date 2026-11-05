export type TaskStatus = "done" | "active" | "todo";
export type Task = { id: string; title: string; owner: string; due: string; status: TaskStatus; tag: string };

export const tasks: Task[] = [
  { id: "t1", title: "完成用户痛点与需求定义", owner: "林溪", due: "今天 18:00", status: "done", tag: "产品" },
  { id: "t2", title: "补充竞品调研证据链", owner: "陈默", due: "明天 12:00", status: "active", tag: "研究" },
  { id: "t3", title: "搭建 AI Agent 执行流程", owner: "林溪", due: "明天 18:00", status: "active", tag: "技术" },
  { id: "t4", title: "完成多模态方案检查", owner: "未分配", due: "11 月 2 日", status: "todo", tag: "设计" },
  { id: "t5", title: "整理答辩演示与交付物", owner: "全员", due: "11 月 3 日", status: "todo", tag: "交付" },
];

export const sources = [
  { id: "s1", title: "全国高校 AI Web 开发挑战赛评分细则", meta: "PDF · 第 2 页", type: "规则", color: "#4f46e5" },
  { id: "s2", title: "团队访谈记录 · 12 人", meta: "DOCX · 2026-10-28", type: "访谈", color: "#0f766e" },
  { id: "s3", title: "产品竞品与需求洞察", meta: "Notion · 16 条证据", type: "研究", color: "#ea580c" },
];

export const demoAnswer = {
  text: "根据已检索的 3 份资料，当前项目最容易失分的地方有两个：第一，AI 能力需要被证明为真实工作流，而不是单次问答；第二，创新点需要落在用户可感知的交互上。建议把“证据链”作为核心差异：每个 AI 结论都关联原文、任务和产物，评委可以一键追溯。",
  citations: [
    { label: "评分细则 · AI 技术深度", page: "第 2 页", quote: "Agent 应具备规划、工具调用、自主决策能力" },
    { label: "评分细则 · 交互模式创新", page: "第 3 页", quote: "人机交互方式是否有创新" },
  ],
};

export const agentSteps = [
  { label: "检索评分细则", detail: "3 个高相关片段", icon: "search" },
  { label: "生成失分风险", detail: "2 条可行动建议", icon: "sparkles" },
  { label: "写入项目任务", detail: "已创建 2 个任务", icon: "list" },
  { label: "证据一致性检查", detail: "通过 · 可信度 92%", icon: "shield" },
];
