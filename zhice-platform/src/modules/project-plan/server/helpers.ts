import { PLAN_CHAPTERS, PLAN_SLOTS, planReportSchema, type PlanReport, type PlanSlotId, type SurveySession } from "../types";
import type { Preparation } from "@/shared/contracts/preparation";
import { selectedTopic } from "@/modules/preparation/domain";
import { preparationChapters } from "../types";

export function parseJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型未返回 JSON 对象");
  return JSON.parse(fenced.slice(start, end + 1)) as unknown;
}

export function currentSlot(session: SurveySession): PlanSlotId | null {
  return PLAN_SLOTS.find((slot) => !session.slots[slot.id].value || session.slots[slot.id].status === "needsVerification")?.id || null;
}

function clean(value: string) { return value.replace(/\s+/g, " ").trim().slice(0, 1200); }
function markCaptured(slots: SurveySession["slots"], id: PlanSlotId, value: string) {
  const normalized = clean(value);
  if (!normalized || slots[id].value) return;
  slots[id] = { ...slots[id], value: normalized, status: normalized.length < 6 ? "needsVerification" : "captured" };
}

function inferMentionedSlots(slots: SurveySession["slots"], message: string) {
  const text = clean(message);
  const target = text.match(/(?:目标用户|面向|服务于|帮助)(?:是|为|：|:)?\s*([^。；;]{4,100})(?:痛点|问题|困难|场景)/)?.[1];
  const pain = text.match(/(?:解决|缓解|针对|改善)([^。；;]{4,100}(?:痛点|问题|困难))/)?.[1];
  const route = text.match(/(?:技术路线|技术栈|使用|采用|基于)([^。；;]{4,120}(?:React|Next|Python|模型|算法|API|数据库|SSE|前端|后端)[^。；;]*)/i)?.[1];
  const team = text.match(/(?:团队|成员|分工)(?:是|有|包括|：|:)\s*([^。；;]{4,100})/)?.[1];
  const progress = text.match(/(?:目前|当前|已经|已有|进展|完成)([^。；;]{4,100}(?:原型|数据|代码|测试|上线|完成|阶段)[^。；;]*)/)?.[1];
  const goal = text.match(/(?:目标|希望|计划)(?:是|：|:)\s*([^。；;]{4,100})/)?.[1];
  if (target) markCaptured(slots, "targetPain", target + (pain ? "；" + pain : "")); else if (pain) markCaptured(slots, "targetPain", pain);
  if (route) markCaptured(slots, "technicalRoute", route);
  if (team) markCaptured(slots, "team", team);
  if (progress) markCaptured(slots, "progress", progress);
  if (goal) markCaptured(slots, "goal", goal);
  if (/(差异化|创新点|相比|独特)/.test(text)) markCaptured(slots, "differentiation", text.match(/(?:差异化|创新点|独特)(?:是|在于|：|:)?\s*([^。；;]{4,100})/)?.[1] || text);
}

export function localSurvey(session: SurveySession, message: string) {
  const slot = session.currentSlot || currentSlot(session);
  const value = clean(message);
  const slots = { ...session.slots };
  let captured: { slot: PlanSlotId; value: string } | null = null;
  let followUp: string | null = null;
  if (slot && value) {
    const differentiationHasMetric = /准确率|响应时间|成本|完成率|百分比|百分之|指标|基线|目标值|提升|降低|时延|覆盖率|转化率/.test(value);
    const vagueDifferentiation = slot === "differentiation" && (!differentiationHasMetric || /更好|不错|领先|更强/.test(value)) && value.length < 80;
    const ideaStage = slot === "progress" && /想法阶段|还没开始|尚未开始|构思阶段|初步想法|规划阶段|没有原型|未开发/.test(value) && !/资源|数据|原型|积累|用户|访谈|代码|接口|模型/.test(value);
    const normalized = vagueDifferentiation ? value + "（差异化维度待量化）" : ideaStage ? value + "（请补充可用资源或前期积累）" : value;
    slots[slot] = { ...slots[slot], value: normalized, status: normalized.includes("待量化") || normalized.length < 6 ? "needsVerification" : "captured" };
    if (ideaStage) slots[slot] = { ...slots[slot], status: "needsVerification" };
    if (vagueDifferentiation) followUp = `“${value}”还不足以形成可核验的差异化。请具体说明是准确率、响应时间、成本还是交互完成率更好，并给出基线、目标值或验证方式。`;
    if (ideaStage) followUp = "既然还在想法阶段，手头有哪些可用资源或前期积累？例如数据、原型、用户访谈、已有代码或合作渠道。";
    captured = { slot, value: normalized };
  }
  if (session.messages.length === 0) inferMentionedSlots(slots, value);
  const next = PLAN_SLOTS.find((item) => !slots[item.id].value || slots[item.id].status === "needsVerification")?.id || null;
  const complete = !next;
  const questions: Record<PlanSlotId, string> = {
    oneLineDescription: "先用一句话说清楚：你们准备做什么产品，解决谁的什么问题？",
    targetPain: "目标用户是谁？他们现在遇到的最具体、最高频的痛点是什么？请尽量给出场景或证据。",
    differentiation: "你们和已有方案相比，具体在哪个可测量的维度上更好？例如准确率、响应时间、成本或交互完成率。",
    technicalRoute: "准备怎样实现？请说说数据、模型、核心流程和可演示的技术路线。",
    team: "团队有几位成员？每个人分别负责产品、前端、后端、算法、材料或答辩中的哪些部分？",
    progress: "目前做到哪一步？如果还在想法阶段，手头有哪些可用资源、数据、原型或前期积累？",
    goal: "这次参赛最希望验证或拿到什么结果？例如奖项、用户验证、技术指标或可持续迭代。",
  };
  return { reply_to_user: complete ? "信息槽位已基本完成。接下来我会把你的回答对照赛事评分标准，生成预期结果报告。" : followUp || questions[next!], current_slot: next, captured, survey_complete: complete, slots };
}

export function localReport(session: SurveySession, criteria: Array<{ title: string; text: string }>): PlanReport {
  const complete = (id: PlanSlotId) => Boolean(session.slots[id].value && session.slots[id].status === "captured");
  const unverified = (value: string | null | undefined) => /演示假设|待验证|拟议|尚需|尚未|未提供.*实测/.test(value || "");
  const completeness = PLAN_SLOTS.map((slot) => ({ dimension: slot.label, status: complete(slot.id) && !unverified(session.slots[slot.id].value) ? "sufficient" as const : session.slots[slot.id].value ? "partial" as const : "missing" as const, detail: session.slots[slot.id].value || "尚未收集到可引用的项目事实。", nextAction: complete(slot.id) ? "可用于章节初稿" : "继续问卷或补充可核验材料" }));
  const alignment = criteria.length ? criteria.map((criterion) => {
    const text = criterion.text.toLowerCase();
    const route = session.slots.technicalRoute.value || "";
    const diff = session.slots.differentiation.value || "";
    const key = text + criterion.title.toLowerCase();
    const relevant = key.includes("技术") || key.includes("原型") || key.includes("用户反馈") ? [route, session.slots.progress.value] : key.includes("合作") || key.includes("资源") || key.includes("协同") ? [session.slots.team.value, session.slots.progress.value] : key.includes("用户") || key.includes("痛点") || key.includes("市场") ? [session.slots.targetPain.value] : key.includes("创新") || key.includes("差异") ? [diff] : [session.slots.oneLineDescription.value];
    const hasValue = relevant.some(Boolean);
    const verified = relevant.some((value) => value && value.length >= 12 && !unverified(value));
    return { criterion: criterion.title, coverage: verified ? "covered" as const : hasValue ? "partial" as const : "missing" as const, detail: verified ? "已有较完整的项目事实，但仍需将数据与原文条款逐项核验。" : hasValue ? "已有相关项目描述，但仍缺少可复核指标或证据。" : "当前槽位没有足够材料支撑这一评分维度。", missing: verified ? "证据链接与演示记录" : hasValue ? "可测量指标与证据来源" : "项目事实、指标和示例证据", action: verified ? "补充证据中心链接并准备展示" : hasValue ? "补充一个可复核指标与演示方式" : "回到问卷补充相关项目事实" };
  }) : [{ criterion: "赛事评分标准", coverage: "missing" as const, detail: "尚未导入赛事要求解析结果。", missing: "官方评分条款", action: "先上传比赛要求文件" }];
  const risks = [
    { question: "你的差异化是否有可测量指标？", suggestion: "准备一个基线、目标值和验证方法，避免只说“更好”。" },
    { question: "技术路线是否能在比赛周期内完成可演示闭环？", suggestion: "拆出最小可行流程，并提前准备降级路径。" },
    { question: "目标用户和痛点有何真实依据？", suggestion: "补充访谈、问卷、使用日志或公开数据来源。" },
    { question: "团队分工如何覆盖产品、技术和答辩？", suggestion: "为每个交付物指定负责人和可验收结果。" },
  ];
  const chapters = PLAN_CHAPTERS.map((chapter) => {
    const needed: PlanSlotId[] = chapter.id === "technical-route" ? ["technicalRoute"] : chapter.id === "team" ? ["team"] : chapter.id === "market-analysis" ? ["targetPain"] : chapter.id === "finance" ? ["goal", "targetPain"] : ["oneLineDescription", "targetPain"];
    const ready = needed.every(complete);
    const partial = needed.some((id) => Boolean(session.slots[id].value));
    return { id: chapter.id, title: chapter.title, status: ready ? "ready" as const : partial ? "partial" as const : "blocked" as const, reason: ready ? "关键素材已具备，可生成章节初稿" : partial ? "有素材，但至少一项需要补充或核验" : "缺少该章节依赖的问卷槽位" };
  });
  return planReportSchema.parse({ completeness, alignment, risks, chapters, summary: "问卷已将项目想法转成可检查的素材，但仍有若干指标、证据和赛事条款需要补齐。生成章节时会保留缺口标记。", mode: "local", createdAt: new Date().toISOString() });
}

export function localChapter(session: SurveySession, chapterId: string, report: PlanReport | null, preparation?: Preparation) {
  const title = preparationChapters(preparation).find((chapter) => chapter.id === chapterId)?.title || chapterId;
  const value = (id: PlanSlotId) => session.slots[id].value || "____";
  const basis = report?.alignment.find((item) => item.criterion.includes("技术"))?.detail || "赛事评分条款尚未导入";
  const topic = preparation && selectedTopic(preparation);
  const sections: Record<string, string> = topic ? {
    "executive-summary": `【已生成】本项目围绕“${preparation!.topicTitle}”开展方案准备。\n【AI推断，请核验】拟服务${topic.user}，具体需求为${topic.problem}。\n【已生成】当前成果范围为${topic.output}，尚未提供实测性能或成本结论。`,
    "project-intro": `【已生成】专业与合作背景来自学生提供的信息；科技小院是合作渠道，具体企业与条件仍需落实。\n【AI推断，请核验】${value("progress")}`,
    "market-analysis": `【AI推断，请核验】${value("targetPain")}\n【已生成】调研计划：确认一种具体使用对象，记录现有做法、实际问题、使用条件与可接受成本。\n【建议补充】访谈对象、时间、原话与授权材料：____。`,
    "product-design": `【已生成】拟议成果：${topic.output}。\n【AI推断，请核验】材料与结构设计需结合${topic.user}的实际需求确定。\n【建议补充】原料规格、配方候选、样品尺寸与设计依据：____。`,
    "technical-route": `【已生成】拟议技术路线：${topic.route}。\n【已生成】验证计划应列明对照材料、试样条件、测试方法、重复次数与记录方式，由指导老师确认可行性。\n【建议补充】可用设备、适用测试方法、工艺参数与实测结果：____。`,
    team: `【AI推断，请核验】团队与资源访谈：${value("team")}\n【已生成】拟按需求调研、材料与工艺、性能验证、资料写作与答辩划分职责。\n【建议补充】成员、指导老师、设备使用许可与企业联系人：____。`,
    "business-model": `【AI推断，请核验】${topic.differentiation}\n【已生成】拟先验证一个具体应用场景，再比较试制、交付和使用环节的可行性。\n【建议补充】合作意向、应用反馈与采用条件：____。`,
    finance: "【已生成】预算按原料、辅料、加工、测试、调研和样品运输分别列支；成本测算注明报价日期、批量与计算口径。\n【建议补充】真实报价、用量、加工与测试费用：____。\n【已生成】当前未提供销售、利润或成本降低的实测数据。",
    "risk-response": `【已生成】待落实事项：${topic.risk}。\n【已生成】先确认需求与实验条件，再安排试样与测试；材料中区分已知事实、拟议方案和待完成验证。\n【建议补充】负责人、完成节点及替代方案：____。`,
    conclusion: `【已生成】参赛目标：${value("goal")}。\n【已生成】本轮准备交付需求与来源记录、项目方案、验证计划、可编辑计划书及答辩演示稿。\n【建议补充】本届赛道、提交清单、校内截止时间与已完成验证：____。`,
  } : {};
  const content = topic ? `# ${title}\n\n${sections[chapterId] || "【建议补充】补充当前章节内容：____。"}\n\n【赛事对齐】${basis}。` : `# ${title}\n\n【已生成】项目名称：${value("oneLineDescription")}。\n\n【已生成】目标用户与问题：${value("targetPain")}。\n\n【建议补充】请补充本章节的关键数据、案例或验证结果：____。\n\n【AI推断，请核验】结合当前素材，项目可以围绕“${value("differentiation")}”形成参赛叙事，但该判断需要用户确认。\n\n【赛事对齐】${basis}。`;
  return { id: chapterId, title, status: "draft" as const, content, mode: "local" as const, updatedAt: new Date().toISOString(), evidenceIds: [] };
}
