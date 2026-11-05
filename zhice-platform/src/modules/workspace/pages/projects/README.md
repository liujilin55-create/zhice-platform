# 学生画像 / 新建备赛项目

`projects.tsx` 提供 `WorkspaceProjects` 和顶部 `ProjectSwitcher`，由模块 barrel 导出。入口为 `/?view=projects`（首页）和 `/?view=profile`。

无当前项目时展示 `ProjectSetup`；三步分别填写学习与目标、能力与资源、投入及项目状态。提交时解析 `studentProfileSchema`，创建独立项目并进入 `/?view=competitions`。编辑模式更新当前项目画像，不新建或覆盖其他项目内容。新建模式以现有画像预填，可重新修改；不复制比赛、报告或任务。

页面数据来自 workspace Zustand store，赛事名称由现有比赛推荐数据解析。样式与表单共同放在本目录，用户可通过首页项目列表或顶部切换器恢复其他项目。

当前比赛区展示比赛、赛道与确认状态。重新选择比赛进入推荐页并提示对报告/计划书的影响。历史比赛材料区只读取归档范围，支持打开历史报告和下载历史计划书 Markdown，历史内容不参与当前生成。
