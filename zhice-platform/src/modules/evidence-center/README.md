# 证据中心

入口：工作空间的「证据中心」，或 /?view=evidence。报告入口为 /reports/:reportId。

## 交互

- 学术论文、比赛规则、优秀案例/竞品三类卡片；展示来源、日期、标签、核验状态、缓存状态、相关度、引用数。
- 点击卡片打开 Drawer；论文展示作者、年份、DOI、摘要原文及精确原句高亮；比赛规则展示解析原文与评分相关条款。
- 高亮按原文精确子串定位，支持多个、重复及重叠片段；不渲染来源 HTML。
- 引用记录跳到报告的稳定 blockId；报告【证据】返回带 evidence ID 的工作空间 URL。URL 支持刷新、直接访问和浏览器导航，Zustand 负责当前选择、抽屉和搜索筛选。
- Drawer 使用 portal、背景 inert、焦点约束、Escape、遮罩关闭和关闭后的焦点恢复；支持减弱动画设置。
- 状态修改经服务端保存成功才更新界面；废弃证据保留历史引用并提示复核。

## 后端模型

契约及 Zod 边界解析位于 types.ts。当前为单机演示版本，持久化文件是被 Git 忽略的 data/evidence-hub.json。未创建文件时提供初始化数据，损坏时返回错误，避免静默覆盖。写入排队并通过临时文件重命名替换。

| 实体 | 关键字段 | 用途 |
| --- | --- | --- |
| Evidence | id, kind, sourceMode, sourceUrl, body, academic, ruleItems, highlightedQuotes, status, cachedAt | 来源与原文，sourceMode 区分真实上传、外部论文和示例 |
| Report | id, title, mode, createdAt, blocks[id, heading, text] | 保存指导内容及稳定段落锚点 |
| Citation | id, evidenceId, reportId, blockId, verification | 多对多关系；报告证据按钮和证据反向引用均从此表生成 |

核验状态和引用核验独立：确认一篇论文存在，不代表其能支持报告的全部推论。自动检索关联为 pending；示例规则与案例不冒充官方规则或真实获奖作品。确认状态是当前使用者的核验标记，本版本没有多人审核身份记录。

生产迁移可将三类实体分别放入 Evidence、Report/ReportBlock、Citation 表，为引用关系添加外键、唯一索引 (evidenceId, reportId, blockId)，并增加 projectId、审核人和版本字段；当前文件队列适用于单进程，不能代替多实例数据库事务。

## 接口

| 接口 | 行为 |
| --- | --- |
| GET /api/evidence?q=&kind=all | 返回 data 和 meta；校验类别、限制查询长度 |
| PATCH /api/evidence | JSON { id, status }，保存 confirmed / pending / deprecated |
| GET /api/evidence/reports/:reportId | 返回报告、关联证据与同一份 Citation 关系 |

网络入口位于 services/evidence-api.ts，通过 shared/api-client 统一请求和 Zod 解析。hooks 管理服务端数据与浏览器缓存，Zustand 不保存服务器实体或 API Key。

## 比赛要求分析联动

POST /api/competition-requirements 分析完成后调用 captureAnalysis：

1. 保存真正解析出的文本，截取评分关键词所在原句并标注「原页码待核对」；不将模型改写句或 DOC/OCR 占位文字当作原文。
2. 保存论文元数据与摘要，以及报告的选题、技术路线、评分建议、创新点、计划、风险和文献。
3. 建立待核验关联，返回 traceability.reportId 及按 blockId 分组的 links；原分析页面的每个建议区域与论文展示【证据】链接，无可用关联时显示「待补充证据」，并提供「打开可溯源报告」。
4. 保存失败时保留分析结果，返回明确警告。没有模型配置时报告标为 demo；真实文件原文与示例模型输出仍明确区分。

仅处理已有提取文本前 14000 字；目前不保证 PDF 原页码定位。新检索论文没有可确认引用句时不制造高亮句。已有报告没有被本次改动追溯性地补造引用。

## 搜索与离线边界

目前采用本地中英概念/同义词扩展 + 关键词与 Fuse 模糊召回，支持「如何提升技术实现得分」召回评分条款、RAG 和 Agent 论文。相关度为本地排序值，不能解释为事实可信度或向量相似度。未来可在同一契约下增加 Embedding 召回及 rerank。

API 暂不可用时展示浏览器缓存、时间与离线状态，保留卡片和详情，禁用状态写入；恢复网络后重试。证据列表只读取当前选择的报告关联，`zhice:evidence-cache:v3:` 按项目、比赛、赛道和选择版本隔离，更换比赛后离线不回显旧材料。报告按唯一报告 ID 单独缓存，带原始绑定与来源核验信息。尚未访问过的报告、没有缓存的证据及整个应用在断网后的冷启动需要网络，当前未实现 Service Worker。

## 验证

运行 pnpm lint、pnpm exec tsc --noEmit、pnpm build。核心检索/高亮/数据完整性验证：node --test tests/evidence.test.mjs。持久化、原文保存、双向关联与并发写入验证：node --test tests/evidence-repository.test.mjs（使用临时目录，不读取或修改用户 API 配置）。
