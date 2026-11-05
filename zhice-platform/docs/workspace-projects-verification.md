# 学生画像与备赛项目阶段验证

验证日期：2026-10-31（Asia/Shanghai）。状态：已实现、已本地验证，未发布；用户正式验收待进行。

## 本阶段范围

建立学生画像、创建/切换备赛项目、关联现有比赛、刷新恢复，以及计划书、报告关联、任务、活动、PPT 的项目隔离。沿用演示赛事，不接入完整赛事数据，不调整管理员配置或调用收费模型。

## 自动化检查

在 `zhice-platform` 执行：

| 检查 | 结果 |
| --- | --- |
| `pnpm exec tsc --noEmit` | 通过 |
| `pnpm lint` | 通过，无 lint 错误或警告 |
| `node --test tests/*.test.mjs` | 40 项通过，0 失败 |
| `pnpm build` | 通过，Next.js 16.4.3 生产构建完成 |
| 首页 HTTP 请求 | `http://localhost:3000/?view=projects` 返回 200 |

本轮新增的 `workspace-projects.test.mjs` 覆盖画像校验、A/B 项目独立状态、选择比赛不覆盖资料、刷新恢复、延迟请求的原项目归属、旧单项目迁移和计划书上下文不自动读取其他项目报告。`ppt-project-isolation.test.mjs` 验证 PPT 历史/下载要求项目归属、非法路径无法越过项目目录。

测试日志有现有 Node 模块类型提示与 AI SDK `generateObject` 弃用提示，不影响测试结果。模型相关测试使用替身，不证明真实国内模型的生成质量。

## 浏览器交互

使用独立的无头 Microsoft Edge 浏览器上下文，在本地开发服务执行 `tmp/verify-workspace.mjs` 所记录的流程。没有修改用户已有浏览器数据。计划书接口由测试 SSE 数据替代，其余表单、页面、存储和切换动作使用实际应用。

已验证：

1. 新用户填写画像，确认默认学校可编辑，创建项目 A。
2. 在现有推荐卡片选择比赛，刷新后保持已选择。
3. 在 A 完成测试问卷与报告、生成章节、编辑确认；创建独立任务。
4. 创建项目 B，比赛关联、计划书和任务均为空。
5. 推荐、比赛要求分析、计划书、PPT、证据页面可以打开。
6. 切回 A，恢复其计划书，刷新后仍保留。
7. 390px 手机视口无横向溢出，流程无浏览器 pageerror。

截图：`tmp/workspace-project-a.png` 和 `tmp/workspace-mobile.png`。浏览器脚本最初以 `.cjs` 执行成功，随后仅转换为 ESM 导入并改为 `.mjs`，以通过 lint；转换后语法检查通过，未重复执行整套浏览器流程。

## 源码指纹与边界

本轮检查时的 SHA-256：

| 文件 | SHA-256 |
| --- | --- |
| `src/modules/workspace/types.ts` | `EC9CF39EFA29A104A769988DEB2250AB6D165D317EEA7BA7A37F1757B10DD6BE` |
| `src/modules/workspace/workspace.store.ts` | `B69E8931DFBAAF1DF20CBA0E6CE3CECCBF7B0E9BB0990C2796F765607DCF12C7` |
| `src/modules/project-plan/plan.store.ts` | `95BB4044C1820BD23AFF2676F80030540BC2E3800BF6E9295CA573D82E3ED00A` |
| `src/components/mission-control.tsx` | `CE1CE28EDDCD2BD5B1FE7EB7B1D1EEDF29703B70881827E16149020B8BE01C47` |

持久化属于当前浏览器，未实现账户级访问控制或跨设备同步。报告/证据保留在原服务端存储，通过当前项目关联读取；PPT 新文件进入项目目录。原来无项目归属的 PPT 文件未删除，也未自动归属新项目。真实模型输出质量与完整赛事数据接入不在本轮验证范围。
