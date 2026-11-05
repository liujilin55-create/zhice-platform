# 开源能力备忘

本文件记录本项目安装的三个开源项目，以及它们适合在「知策台」中承担的能力。它是项目内的工作记忆，后续迭代按这里的边界选用，不把第三方仓库代码整段复制进作品。

## assistant-ui

- 仓库：[assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui)
- npm：`@assistant-ui/react`、`@assistant-ui/ai-sdk`
- 许可证：MIT
- 主要能力：可组合的 Thread、Message、Composer、附件、Markdown、自动滚动、重试、语音输入、工具调用卡片、用户审批卡片和生成式 UI。
- 适合本项目：将当前 Copilot 对话升级成“流式回答 + 工具调用状态 + 引用卡片 + 用户确认”的生产级对话面板。
- 两天内的使用边界：先保持现有自定义聊天面板稳定；如果需要快速补齐附件、工具审批或语音输入，再用 assistant-ui 的 primitives 替换局部组件。

## Tremor

- 仓库：[tremorlabs/tremor-npm](https://github.com/tremorlabs/tremor-npm)
- npm：`@tremor/react`
- 许可证：Apache-2.0
- 主要能力：Card、Metric、AreaChart、BarChart、ProgressBar、Tabs 等 20+ 个 Tailwind 仪表盘组件。
- 适合本项目：项目脉搏、证据覆盖率、任务趋势和风险统计图表。
- 兼容性结论：当前 `@tremor/react@3.18.7` 的 peer dependency 声明为 React 18，而项目是 Next 16 + React 19。包已安装用于能力保留，但主页面暂不直接引入，以免比赛现场出现渲染兼容问题。当前图表用原生 SVG/CSS 实现，稳定性优先。

## Vercel AI SDK

- 仓库：[vercel/ai](https://github.com/vercel/ai)
- npm：`ai`、`@ai-sdk/openai`
- 许可证：npm 包为 Apache-2.0
- 主要能力：统一模型提供商接口、流式文本、结构化输出、ToolLoopAgent、Function Calling、AI SDK UI、模型路由和多模态消息。
- 已实际使用：`src/app/api/assistant/route.ts` 已使用 `streamText`、OpenAI 兼容 provider、Zod 工具 schema、`createTask` 和 `inspectEvidence` 两个工具，以及最多三步的 Agent 工作流。
- 适合本项目：继续承载 RAG 检索、任务规划、图片/PPT 内容块和工具执行审批。

## ppt-master-skill

- 仓库：[macrochen/ppt-master-skill](https://github.com/macrochen/ppt-master-skill)
- 本机 Skill：`C:\Users\qwasz\.codex\skills\ppt-master-skill`
- 主要能力：Strategist / Executor 工作流、16:9 设计规范、页级大纲、SVG/PPTX 导出、演讲备注和可编辑性说明。
- 已落地到本项目：`src/modules/ppt-generator/` 采用同样的“解析 → Strategist 大纲 → Human Gate → Executor 渲染”阶段门；前端支持页级编辑、增删、排序，服务端用 `pptxgenjs` 生成原生文字与形状并写入演讲者备注。导出时同步建立项目隔离的 PPT Master 产物目录，生成设计规范、页级 SVG、总讲稿和清单，作为可审计的中间产物；网页端通过 `/api/ppt?projectId=...&master=...&asset=...` 读取这些产物。
- 许可证边界：GitHub 仓库当前未声明开源许可证，因此项目没有复制其仓库代码或资源，只吸收公开工作流思路，并保留本项目自己的实现。

## 选择原则

1. 优先使用 npm 包提供的公开 API，不复制未知来源的仓库代码。
2. 主流程优先稳定演示；只有在组件能直接提升评分证据时才替换现有实现。
3. 对 React 版本、许可证和构建结果做记录；安装成功不等于运行时兼容。
