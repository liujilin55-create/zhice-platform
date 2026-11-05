# 知策台 · AI 项目执行系统

两天冲刺版的 AI Native Web 参赛作品。它把竞赛评分细则、团队资料、Agent 任务和最终交付物连接成可追溯的证据链。

## 技术栈

- Next.js 16 + TypeScript：页面、路由和服务端 API
- Tailwind CSS 4：设计系统与响应式布局
- Vercel AI SDK + `@ai-sdk/openai`：流式 LLM、Function Calling、Agent 步骤
- assistant-ui：可选的生产级对话 primitives 和 AI SDK 适配器
- Tremor：可选的仪表盘图表组件（当前因 React 18 peer 声明暂不挂主流程）
- Zod：工具输入和结构化结果校验
- React Flow：证据链与任务图谱
- Framer Motion：AI 思考状态和操作反馈
- Lucide React、Recharts、React Markdown：图标、数据和内容渲染基础

## 评分证据

- LLM：`src/app/api/assistant/route.ts` 使用模型路由、系统提示和流式输出。
- Agent/工具调用：同一接口暴露 `createTask` 和 `inspectEvidence` 两个 Function Calling 工具，并限制最多 3 个步骤。
- RAG：演示数据保留来源、页码和原文引用；真实接入时替换 `inspectEvidence` 的检索实现即可。
- 多模态入口：Copilot 提供资料/PPT 检查入口，下一步可接入图片内容块。
- 安全与可控：模型被要求基于资料回答；工具输入通过 Zod 校验；前端展示引用和用户确认状态。
- 前端工程：组件拆分、响应式布局、可交互任务状态和生产构建均已验证。

## 比赛推荐功能

侧边栏的“比赛推荐”进入 `src/modules/competition-recommendation/`，支持专业、年级、兴趣、级别和时间偏好输入。当前使用人工维护标签与关键词加权，返回匹配度、相关度和逐条推荐理由；没有专业/兴趣命中时会展示通用竞赛并提示补充信息。后续向量检索只需替换模块的召回实现。

## 比赛要求分析功能

侧边栏的“比赛要求分析”进入 `src/modules/competition-requirements/`，通过 `POST /api/competition-requirements` 接收 `multipart/form-data`：`file`（PDF/DOC/DOCX/PNG/JPG/WEBP）、`major` 和可选 `notes`。服务端会完成文件解析、OCR 接入、要求结构化、学术论文检索排序与参赛指导报告生成，页面支持复制和导出 Markdown。

所有外部端口均只在服务端环境变量配置，不暴露给浏览器：

- `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`：结构化要求与指导报告。
- `ACADEMIC_API_URL`：Semantic Scholar 兼容的论文搜索 API；未配置时使用公开接口并保留本地论文缓存。
- `OCR_API_URL`、`OCR_API_KEY`：图片 OCR 服务，响应支持 `{ text }`、`{ result }` 或 `{ data: { text } }`。
- `OFFICE_PARSE_API_URL`：旧版 `.doc` 转文本服务；`.docx` 由 Mammoth 直接解析。

未配置模型或 OCR 时，接口自动返回可演示的离线结果，并在页面标注“AI 建议，仅供参考”和配置提示。

## 一键生成 PPT

侧边栏的“一键生成 PPT”进入 `src/modules/ppt-generator/`，支持网页计划书直连和 `.docx` 兼容入口：服务端用 Mammoth 解析标题层级、段落和表格，用 JSZip 统计图片，再按 PPT Master 的 Strategist → Human gate → Executor 流程生成 8—15 页大纲。用户可编辑标题、要点、演讲备注、顺序和页数，确认后由 `pptxgenjs` 生成 16:9 原生文字/形状 PPTX，并写入 PowerPoint 演讲者备注。

每次导出还会按 `projectId` 归档一个 PPT Master 项目：包含 `sources/input.md`、`设计规范与内容大纲.md`、`svg_output/`、`svg_final/`、`notes/total.md` 和 `manifest.json`。SVG 采用平台自有安全版式生成，未复制外部获奖 PPT 的文字、图片、Logo 或坐标；历史记录提供设计规范、产物清单和总讲稿链接。导出接口仍保留 Human Gate、一致性检查、来源核验和项目隔离。

生成文件和最近 20 条历史记录保存在 `public/generated-ppts/`，下载接口为 `GET /api/ppt?file=<id>`。无 `OPENAI_API_KEY` 时使用稳定的本地大纲模板，仍可完成编辑、渲染、下载和历史记录演示；配置模型后将根据 DOCX 内容生成更精确的大纲。

## 四大工作区

侧边栏现在完整接入四个围绕比赛交付的工作区：

- **项目总览**：汇总项目健康度、任务完成度、证据覆盖率、交付准备度和 AI 风险雷达，并提供证据链、里程碑、Copilot 与下一步执行队列。
- **证据中心**：管理规则、访谈、研究和产物资料，支持 Fuse.js 关键词检索、证据片段详情、原文引用复制、核验状态和关联任务。
- **任务编排**：使用四列看板管理待开始、进行中、阻塞/待确认和已完成任务，支持负责人、截止时间、优先级、标签、依赖关系、验收清单和新建任务。
- **成果检查**：上传 PPTX/PDF/DOCX/ZIP/图片，运行提交前检查，查看评分维度、证据和修复建议，导出 Markdown 报告，并保存最近检查历史。

四个工作区目前先使用可替换的本地数据和交互状态完成比赛演示。后续接入 API 时保留页面与交互，只替换模块服务层和数据读取函数；成果检查预留 `POST /api/deliverable-check`，项目 Copilot 使用 `/api/assistant`，比赛要求分析使用 `/api/competition-requirements`，PPT 生成使用 `/api/ppt`。

## 管理后台与国内模型配置

访问 `http://localhost:3000/admin` 进入后台，默认账号和密码都是 `admin`。后台会按功能区独立保存模型供应商、API Key、Base URL、模型名、Temperature、最大输出 Token 和系统提示词，支持 DeepSeek、豆包/火山方舟、阿里百炼/通义千问、Kimi/Moonshot 以及自定义 OpenAI 兼容接口。

“API 模型 ID”需要填写平台接口标识。例如 Kimi K3.1 Pro 对应 `kimi-k3.1-pro`，Base URL 为 `https://api.moonshot.cn/v1`，不能用产品展示名代替接口 ID。可以先填写密钥和地址，再点击“获取可用模型”，从平台返回的 ID 中选择并测试连接；尚未保存的密钥也能查询，查询不会写入配置。不提供 `/models` 接口的平台仍可手动填写模型 ID 或 Endpoint ID。Moonshot 的字段与接口已核对[官方模型文档](https://platform.moonshot.cn/docs/api/models)和[模型列表接口](https://platform.moonshot.cn/docs/api/list-models)（2026-10-30）。

API Key 只在服务端 `data/ai-config.json` 保存，接口返回时只展示脱敏状态；`data/` 已加入 `.gitignore`。如果未配置某个功能区，页面继续使用离线演示结果。部署到公网前请通过环境变量修改 `ADMIN_PASSWORD` 和 `ADMIN_SESSION_SECRET`，并将后台放在 HTTPS 与访问控制之后。

功能区的真实模型调用已经接入独立配置：项目总览、比赛推荐、证据中心和任务编排通过 `/api/assistant` 传入各自的 `featureId`；比赛要求分析使用 `competitionRequirements`，PPT 生成使用 `pptGenerator`，成果检查使用 `/api/deliverable-check` 的 `deliverableCheck`。每个功能区都可以单独更换模型与提示词。

所有模型调用统一通过 `src/lib/ai-model.ts` 使用 Chat Completions 兼容接口。如果模型明确返回“temperature 只允许 1”等固定温度限制，服务端会按接口要求调整温度并重试一次，后台连接测试会显示调整提示。鉴权、额度等其他错误保持原样返回。兼容性回归测试可用 `node --test tests/ai-model.test.mjs` 运行（需支持 TypeScript 类型剥离的 Node.js）。

模型列表解析和异常处理的回归测试：`node --test tests/ai-models.test.mjs`。

## 开源来源

项目选用的开源组件都通过 npm 引入，未复制未知来源代码。主要参考与依赖：

- [shadcn/ui](https://github.com/shadcn-ui/ui) · MIT · 126k+ stars：组件设计与可访问性参考
- [xyflow/xyflow](https://github.com/xyflow/xyflow) · MIT · 38k+ stars：证据/任务图
- [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) · MIT · 12k+ stars：AI 对话交互参考
- [tremorlabs/tremor-npm](https://github.com/tremorlabs/tremor-npm) · Apache-2.0 · 16k+ stars：仪表盘数据表达参考
- [vercel/ai](https://github.com/vercel/ai) · AI SDK：流式模型与工具调用

三个仓库的能力边界和兼容性记录见 [`docs/opensource-capabilities.md`](docs/opensource-capabilities.md)。

最终提交前应在项目材料中保留这些依赖的许可证说明，并只提交本项目自己的代码和配置。

## 本地运行

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:3000`。复制 `.env.example` 为 `.env.local` 并填入兼容 OpenAI 的密钥后，Copilot 会调用真实模型；不填也能完整演示。

验证命令：

```bash
pnpm lint
pnpm build
```
