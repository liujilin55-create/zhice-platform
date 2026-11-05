import type { CompetitionRequirements, GuidanceReport, Paper } from "./types";

export const demoRequirements: CompetitionRequirements = {
  title: "大学生 AI Web 创新挑战赛",
  summary: "围绕真实用户问题设计一个可用的 AI Web 产品，要求体现模型能力、工程实现和可验证的应用价值。",
  theme: "AI 驱动的 Web 产品创新与落地",
  taskGoals: ["发现真实场景中的高频问题", "设计可交互的 AI Web 原型", "展示模型调用、数据处理与完整业务闭环"],
  deliverables: ["可访问的 Web 产品或演示地址", "项目说明与技术架构文档", "3 分钟功能演示视频或答辩演示", "源代码与部署说明"],
  scoringCriteria: ["AI 技术深度与调用质量", "产品创新性与用户价值", "前端工程质量和交互体验", "方案可落地性与社会价值"],
  keywords: ["AI Agent", "RAG", "多模态", "Web 应用", "用户体验", "可解释性", "创新创业"],
  technologyDirections: ["大模型 API 与结构化输出", "检索增强生成（RAG）", "Agent 工具调用", "多模态文件解析", "React / Next.js 全栈开发"],
  timeline: [
    { milestone: "报名与选题", date: "第 1—2 天", description: "确定用户问题、目标人群和可验证的产品假设" },
    { milestone: "原型与数据", date: "第 3—5 天", description: "完成核心页面、数据样例和模型调用链路" },
    { milestone: "联调与验收", date: "第 6—8 天", description: "补齐异常、引用、权限和关键用户流程" },
    { milestone: "演示与提交", date: "第 9—10 天", description: "录制演示、整理答辩材料并完成最终部署" },
  ],
};

export const demoPapers: Paper[] = [
  { id: "paper-rag", title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", authors: ["Patrick Lewis", "Ethan Perez", "Aleksandra Piktus"], year: 2020, abstract: "提出将参数化生成模型与非参数化检索记忆结合的方法，为需要外部知识的生成任务提供可追溯的证据。", url: "https://arxiv.org/abs/2005.11401", source: "arXiv", citationCount: 8200, relevanceScore: 96, matchedKeywords: ["RAG", "检索增强", "可解释性"] },
  { id: "paper-react-agent", title: "ReAct: Synergizing Reasoning and Acting in Language Models", authors: ["Shunyu Yao", "Jeffrey Zhao", "Dian Yu"], year: 2023, abstract: "通过交替执行推理与行动，让语言模型能够调用外部工具并根据观察结果继续规划，适合构建可控 Agent。", url: "https://arxiv.org/abs/2210.03629", source: "arXiv", citationCount: 4300, relevanceScore: 93, matchedKeywords: ["AI Agent", "工具调用", "自主规划"] },
  { id: "paper-multimodal", title: "Multimodal Foundation Models: From Specialists to General-Purpose Assistants", authors: ["Yinfei Yang", "Hao Zhang", "Junnan Li"], year: 2024, abstract: "总结视觉与语言联合建模的发展，讨论图片、文档等多模态输入在通用助手和实际产品中的应用。", url: "https://arxiv.org/abs/2307.14393", source: "arXiv", citationCount: 860, relevanceScore: 88, matchedKeywords: ["多模态", "图片解析", "文档理解"] },
  { id: "paper-ux-ai", title: "Designing Human-Centered AI Systems with Explanations", authors: ["H. Ehsan", "M. O. Riedl"], year: 2022, abstract: "研究如何通过解释、反馈与用户控制机制建立人机信任，为 AI 产品设计可理解、可校验的交互。", url: "https://dl.acm.org/doi/10.1145/3491102.3501826", source: "ACM Digital Library", citationCount: 540, relevanceScore: 84, matchedKeywords: ["用户体验", "可解释性", "人机协作"] },
];

export const demoReport: GuidanceReport = {
  overview: "建议把作品定位为“从赛题资料到可执行方案”的 AI 项目执行系统，用真实文件驱动结构化分析，再用检索论文和证据链支撑每个结论。这样能同时覆盖 AI 深度、产品创新和工程体验评分。",
  topicDirections: [
    { title: "比赛要求智能拆解与证据链", reason: "用户上传的规则文件是天然入口，结构化结果能直接连接任务和交付物。", expectedOutput: "要求卡片、评分点到任务的映射图、可追溯引用" },
    { title: "专业化论文与技术路线助手", reason: "将用户专业和赛题关键词用于论文检索，能让推荐结果更具针对性。", expectedOutput: "相关论文列表、摘要证据、路线选择理由" },
    { title: "可验证的 Agent 项目教练", reason: "让 Agent 通过检索、拆解和检查三个工具完成闭环，现场演示更容易证明 AI 不是单次问答。", expectedOutput: "工具调用记录、风险雷达、备赛计划" },
  ],
  technicalRoute: ["Next.js + React 构建上传与报告工作台", "PDF / DOCX 文本解析，图片交给视觉模型 OCR", "大模型结构化输出比赛要求与指导报告", "关键词 + 摘要相似度 + 年份 + 引用数排序论文", "通过来源 URL、原文预览和 AI 标识建立可追溯链路"],
  scoringSuggestions: [
    { criterion: "AI 技术深度", action: "答辩时展示文件解析、结构化抽取、论文检索和报告生成四段真实链路，并展开一次工具调用结果。" },
    { criterion: "创新性", action: "强调“要求—论文—路线—任务—成果”的连续证据链，展示它如何减少参赛者从阅读到执行的断层。" },
    { criterion: "前端与体验", action: "保持单页工作台，使用阶段进度、相关度、复制/导出和失败兜底，减少评委理解成本。" },
    { criterion: "实用与社会价值", action: "面向没有科研导师或小团队的学生，提供低门槛、可解释、可复用的备赛支持。" },
  ],
  innovationPoints: ["按评分点生成建议，而不是只生成一篇泛化文案", "论文结果显示命中关键词、年份、引用数和来源，推荐理由可审计", "支持 10 天冲刺与 4 周稳态两种计划，适配不同比赛节奏", "模型输出明确标注 AI 建议，仅供参考，并保留人工确认入口"],
  plan: [
    { phase: "定义问题与证据", days: "第 1—2 天", tasks: ["确认用户和核心场景", "整理评分点与验收指标", "确定 3 篇关键论文并记录来源"] },
    { phase: "完成最小闭环", days: "第 3—5 天", tasks: ["完成上传、解析、结构化要求", "接通论文检索与排序", "做出可演示的报告页面"] },
    { phase: "增强 AI 深度", days: "第 6—8 天", tasks: ["增加 Agent 工具调用和证据引用", "补充失败重试、无结果和敏感输入提示", "邀请同学完成一次端到端试用"] },
    { phase: "打磨提交物", days: "第 9—10 天 / 第 4 周", tasks: ["固定演示数据和录屏脚本", "准备架构图、评分证据和答辩 PPT", "完成部署、回归和最终导出"] },
  ],
  risks: ["学术 API 可能限流，演示时保留本地缓存结果", "OCR 对低清图片或复杂表格识别可能不完整，需提供原文预览供人工核对", "AI 生成的选题与技术方案需要人工确认，不能替代比赛官方规则"],
  references: demoPapers.map((paper) => `${paper.title}（${paper.year}，${paper.authors[0]} 等）`),
};
