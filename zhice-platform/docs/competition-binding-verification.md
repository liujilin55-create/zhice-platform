# 比赛选择、要求分析与计划书绑定验证

验证日期：2026-10-31（Asia/Shanghai）。状态：已实现并本地验证，未发布，待用户验收。本阶段在学生画像/备赛项目基础上绑定赛事流程，未接入完整实时赛事库。

## 实现边界

统一绑定为 `{ projectId, competitionId, trackId, revision }`。报告附 `sourceId/reportId`，计划书报告附自身 `reportId` 与 `requirementsReportId`。服务端逐次检查报告/问卷绑定，客户端组合范围隔离问卷、计划书、分析结果、任务、活动、证据缓存与 PPT 草稿。比赛或赛道变更提示影响并归档旧材料，清空当前上下文，保留项目资料；相同选择不会重置。

资格筛选仅使用已核验维护资料；待核验条件以警告展示，不冒充资格通过。排序覆盖专业、技能、团队、导师、资源、时间、预算、学生目标和适用学校的认定。现有演示目录不编造本届日期、校内等级、认定年份或正式赛道。

官方来源由维护白名单获取，自动下载不代表核验。用户须对照原文核验逐字引句，缓存正文版本变化使旧核验失效；上传资料保留独立身份，支持补充/覆盖。无评分原文或赛道待核验时允许草稿；正式生成要求用户确认比赛/赛道、赛道资料已核验、官方评分原句已核验且无来源冲突。AI 生成评分名称被服务端过滤，不作为官方条款。

## 自动化结果

在 `zhice-platform` 执行：

| 检查 | 结果 |
| --- | --- |
| `pnpm exec tsc --noEmit` | 通过 |
| `pnpm lint` | 通过，无错误或警告 |
| `node --test tests/*.test.mjs` | 52 项通过，0 失败 |
| `pnpm build` | 通过，Next.js 16.4.3 生产构建 |
| `node tmp/verify-competition-binding.mjs` | 通过 |

`tests/competition-binding.test.mjs` 的 12 项场景验证硬筛选、多维排序、换赛归档/刷新、迟到结果拒绝、原句与内容哈希核验、跨项目报告排除、上传覆盖、正式生成门槛、比赛画像动态追问、虚构评分剔除和来源冲突。冲突还覆盖已保存报告快照与新分析结果的状态传播。其他回归覆盖分析流、证据双向引用、首页显式报告选择、PPT 项目归属和旧数据迁移。

模型与来源测试使用模拟上游、内存数据或临时目录，不读取真实密钥、不调用收费模型、不写用户报告。现有 Node 模块类型提示与 AI SDK 弃用提示不影响测试结果。

## 浏览器交互

使用独立无头 Microsoft Edge 上下文，未修改用户当前浏览器状态。浏览器测试替换官方来源、分析与计划书接口为明确标记的模拟响应；前端表单、导航、存储和切换使用实际应用。

已验证：未选择比赛的状态门；选择比赛/赛道的影响确认；刷新恢复；无上传文件时自动使用所选比赛正文；分析与计划书请求/结果归属；待核验草稿门；换赛后不再显示旧报告/章节；旧证据缓存存在且接口不可用时不回显旧证据；A/B 项目切换；历史计划书下载入口；390px 无横向溢出；没有浏览器 `pageerror`。

截图 `tmp/competition-recommendations.png` 与 `tmp/competition-plan-binding.png` 已目视检查。浏览器中的模拟来源不证明真实官网可用性或模型输出质量。最后的来源冲突传播修复另由真实路由单元集成测试覆盖，未额外调用在线模型。

## 最终源码指纹（SHA-256）

| 文件 | SHA-256 |
| --- | --- |
| `src/shared/contracts/competition-binding.ts` | `14F9BAE9CA0CBFF0B50329BA504E2FFEE3AC5FEA70FC5C73AFC035564DA17506` |
| `src/modules/workspace/workspace.store.ts` | `AF74DD489440A08EB18E1A84FAD9D2BCB82CAB7F54D636110B85CB57BE881CE1` |
| `src/modules/project-plan/server/context.ts` | `F46EC5CD98C04096F07E1C7A79F810355D13AB64AB313FE34146F2C7BA2B8900` |
| `src/modules/competition-requirements/analysis-pipeline.ts` | `57911CECA55954FEEF86C9EAEA84B62FDFFE543B32A5CC48B83AA0217B98D7F9` |

当前浏览器项目 ID 是归属标识，不是账户授权。尚未实现跨设备同步和服务端账户权限。服务端 PPT 历史仍按项目归档，浏览器 PPT 草稿按比赛选择隔离。正式赛事资格、校内认定、赛道和本届条款仍需真实资料维护；本轮未验证真实官方内容或国内付费模型生成质量。
