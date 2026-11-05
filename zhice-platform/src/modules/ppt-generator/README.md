# 一键生成 PPT

入口 `/?view=ppt`，提供网页计划书直连与外部 DOCX 两种来源，将 Strategist / Human Gate / Executor 工作流适配到网页：

1. Strategist：网页计划书按版本引用已确认内容块；模型只选择主题对应的内容块 ID，正文由服务端摘取原句，不允许模型创造数字或关键事实。缺失素材以【建议补充】显示。兼容 DOCX 解析标题层级、段落、表格和图片。
2. Human gate：用户可以编辑标题、要点、备注，增删和调整顺序。
3. Executor：按 16:9 设计规范和内置模板渲染原生文字形状，写入演讲者备注并生成可下载 PPTX。
4. PPT Master 归档：导出同时生成按 `projectId` 隔离的 `ppt-master/<artifactId>/`，包含 `sources/input.md`、`设计规范与内容大纲.md`、`svg_output/`、`svg_final/`、`notes/total.md` 和 `manifest.json`。这些中间产物用于版式审计与追溯，最终 PPTX 仍由平台生成，避免复制外部作品内容。
4. History：服务器将生成文件保存到 `public/generated-ppts/projects/<projectId>/`，历史 JSON 附比赛绑定和计划书版本，页面按当前比赛选择范围读取，刷新恢复当前大纲与来源。

生产环境如果使用无状态部署，需要将生成文件和历史 JSON 替换为对象存储或数据库；本地比赛演示可以直接使用当前 Node 文件存储。

## 计划书链路

`POST /api/ppt` JSON action：

- `analyzePlan`：传 projectId、精确 document reference 和 options（时长、页数、重点）。服务器按绑定/版本/哈希加载已保存文档，拒绝其他项目、旧版本或无确认正文。大纲覆盖问题、用户、方案、创新、技术、验证、资源落地、团队、计划、风险和总结；较短页数合并主题。
- `check`：重建来源关联并返回一致性检查。检查项目名、数字及所属结论、标题/备注结论、空白页、文字容量、评分覆盖和待核验来源。支持原句摘取；自由改写须回计划书确认，或加【待核验】标记。
- `render`：必须 humanConfirmed=true。存在阻断问题时拒绝；来源缺失/待核验、无证据或评分缺口以警告保留。渲染前和落盘前复核版本，拒绝过期大纲。客户端提供的证据关联会被服务端原文重建。

每页保留 chapterIds、blockIds、evidenceIds、sourceIds 和内容来源标记，支持跳回当前范围的计划书/Word 对应章节。原生 PPTX 中正文为可编辑文本形状；备注记录讲稿、项目/比赛、文档版本、章节、证据和核验提示，不把待核验内容伪装为确定事实。

`multipart/form-data` 的 DOCX 上传保留，大小与后缀校验不变。外部文件没有网页确认链路，页面明确提醒人工核对，同样必须经过 Human Gate。新导出的文件记录比赛绑定；既有无绑定历史仍保留在服务器上，通过原项目历史接口可访问，不自动混入当前比赛。

导出历史中的“设计规范”“产物清单”“总讲稿”链接分别读取 `/api/ppt?projectId=...&master=...&asset=design-spec|manifest|notes`，服务端会校验项目标识和 `master-*` 产物标识，不能跨项目读取。

测试：`tests/plan-ppt.test.mjs`、`tests/ppt-project-isolation.test.mjs`。浏览器与验证边界见 `docs/plan-ppt-verification.md`。
