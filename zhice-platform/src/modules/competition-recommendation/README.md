# 比赛推荐模块

入口 `/?view=competitions`。根据当前学生画像先做资格筛选，再从维护的比赛库中生成可解释推荐。结果分为高匹配、提升型、挑战型。

- 当前数据：`types.ts` 定义稳定的 `competitionId`、主办方、外部级别、校内认定/年份/链接、赛道、报名对象、年级/专业限制、团队人数、报名窗口、比赛时间、提交物、评分维度、来源链接和核验状态。`data.ts` 现有目录明确为演示；未知日期、校内等级和年份为空，通用准备赛道为待核验。
- 当前匹配：`matcher.ts` 对已核验维护信息执行年级、专业、团队上下限、报名状态和截止时间硬筛选；未知条件作为有警告的候选，不声称资格通过。排序考虑专业、兴趣、技能、团队、导师、资源、时间、预算、目标和校内认定；福建农林大学认定加分需要匹配学校和已核验校内来源。
- 当前页面：`competition-recommendation.tsx` 提供分组、匹配度、理由、赛道选择和更换确认。选择写入当前项目，确认不等于核验资料。更换比赛/赛道会归档旧材料、重置当前上下文。
- 赛事要求下载：`downloads.ts` 维护官方资料白名单；`/api/competition-recommendation/[id]/download` 由服务端代理并以附件方式返回，卡片按钮提供下载中、失败和重试反馈。
- 后续扩展：向量检索可以替换 `matcher.ts` 的召回部分，保留 `CompetitionRecommendation` 结果契约不变。

## 来源与核验

`GET /api/competitions/[competitionId]/source?trackId=...` 只读取维护目录中的白名单官方资料，缓存于 `data/competition-sources.json`。自动获取不代表核验；抓取失败时明确显示缓存或上传提示。来源正文以 SHA-256 识别版本，正文变化使旧核验失效。评分核验要求用户确认并提交逐字存在于当前原文中的引文；冲突可单独报告，会阻止正式生成。原句核验独立于赛事资格、赛道和校内认定，不提升这些字段的状态。

`GET /api/competitions/source-statuses` 仅汇总缓存状态，供推荐卡片显示。AI 排序解释标注为非官方建议，不修改赛事事实。测试见 `tests/competition-binding.test.mjs` 和 `docs/competition-binding-verification.md`。
