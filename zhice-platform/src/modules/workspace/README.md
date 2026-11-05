# 学生画像与备赛工作空间

首页 `/?view=projects` 展示“我的参赛画像”和“当前备赛项目”；`/?view=profile` 进入画像入口。新用户先填写三步表单，再创建项目并进入比赛推荐。学校默认“福建农林大学”，可以修改。画像涵盖学校、学院、专业、年级、目标、技能、团队能力、导师、设备/实验室/基地/企业/乡村调研资源、每周时间、预算和项目阶段。

`WorkspaceProject` 用 `projectId` 标识，保存名称、画像快照、选中的比赛及赛道、项目阶段、报告关联、计划书/PPT 状态和创建/更新时间。新建项目可沿用画像作为表单初值，但比赛、报告、计划书和任务从空状态开始。比赛或赛道变更会生成新的 `selectionRevision`，归档旧关联、清空当前材料状态和选择确认；项目名称、画像保留。用户须在提示后确认选择。编辑画像只影响当前项目。顶部切换器与项目列表均可切换项目。

## 持久化与隔离

Zustand 的 `zhice:workspace:v1` 保存项目列表、当前项目 ID、画像和最近 1000 条活动。活动带 `projectId` 和 `scopeKey`，页面按当前比赛选择范围过滤。一次性文件交接仅在内存，切项目或比赛时清空，不写 localStorage。刷新恢复时，上次未完成的活动标为待核对。

`MissionControl` 统一依次恢复工作空间及各模块，再激活当前项目。`shared/store/project-scope.ts` 同步通知计划书和任务 store 切换；页面容器以 `projectId + competitionId + trackId + revision` 的组合范围为 key，清除旧组件局部状态。异步请求保存原始绑定，切换后的回调不得修改新选择。

- 计划书 `zhice:project-plan:v1`：`byProject` 以组合范围为 key 保存问卷、预期报告、章节及编辑阶段。
- 任务 `zhice:tasks:v1`：`byProject` 以组合范围为 key 保存独立任务及状态。
- 分析 `zhice:analysis-results:v1`：按组合范围缓存比赛要求分析结果；服务端报告经当前选择的 `reportId/reportIds` 显式关联，不自动读取最新报告。
- PPT `zhice:ppt-workspace:v1`：按组合范围保存文档引用、大纲、选项和草稿；服务端文件仍以 `projectId` 存储，新历史条目附比赛绑定，当前页面按组合范围过滤。
- 网页统一计划书和最近 20 个版本快照保存在计划书 store；显式保存/PPT 直连时写入服务端按绑定哈希隔离的不可变文档版本。PPT 读取精确版本引用，不读取任意最新计划书。
- 证据列表按当前选择的报告关联过滤，浏览器缓存 `zhice:evidence-cache:v3:` 带组合范围；换赛后离线也不读取旧缓存。
- `competitionHistory` 保留旧范围、比赛/赛道和报告 ID；项目页支持查看历史报告与下载历史计划书，不向当前生成注入历史材料。

旧单项目工作空间保留原 ID，全局旧计划书与任务只迁移给该项目。无法确认归属的旧计划书尝试备份到 `zhice:project-plan:legacy-backup:v1`，不会自动分配给新项目。原先无项目归属的 PPT 历史仍保留在磁盘，不显示在新项目内。

这是当前浏览器的项目隔离，不提供跨设备同步或服务端账户权限。清除浏览器存储会移除本机画像与关联。比赛选择仍沿用演示目录，资格、认定和赛道缺少正式来源时明确待核验。

## 验证

`tests/workspace-projects.test.mjs` 覆盖画像校验、项目间隔离、刷新恢复、旧数据迁移和报告上下文边界；`tests/ppt-project-isolation.test.mjs` 覆盖 PPT 历史/下载归属和非法路径。浏览器流程见 `docs/workspace-projects-verification.md`。
