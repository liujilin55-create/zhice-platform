import type { Preparation } from "@/shared/contracts/preparation";
import type { StudentProfile } from "@/modules/workspace/types";
import type { PlanDocument } from "@/shared/contracts/plan-document";
import { bindingKey } from "@/shared/contracts/competition-binding";

export const questions = [
  { id: "industry", label: "科技小院目前能对接什么产业或合作方？", reason: "先确定可以接触的真实场景，再比较赛事和选题。", example: "【演示假设】有机会联系政和县竹加工企业，具体企业尚需老师对接。" },
  { id: "materials", label: "能获得什么原料、数据，或者观察哪些生产环节？", reason: "原料与数据可得性会影响项目可完成程度。", example: "【演示假设】拟申请获得竹屑、边角料，并安排一次生产现场调研。" },
  { id: "equipment", label: "可用的指导老师、加工和测试条件是什么？", reason: "实验条件决定技术路线；不确定时可以直接填写需要协调的事项。", example: "【演示假设】设备和导师尚需协调；拟咨询成型、压缩和吸湿性能测试条件，目前没有实验结果。" },
  { id: "demand", label: "合作方遇到什么具体问题？有没有访谈或记录？", reason: "把真实需求和待验证假设分开，避免先有方案再寻找问题。", example: "【演示假设】希望探索竹加工剩余物用于农产品运输防护的可能性；包装对象、现有成本和需求尚需访谈。" },
  { id: "team", label: "团队准备如何分工，计划投入多长时间？", reason: "帮助控制本轮材料准备和验证方案的范围。", example: "【演示假设】拟按材料方案、需求调研、资料写作与答辩分工，成员和周期需进一步确认。" },
] as const;

export const topics = [
  { id: "bamboo-packaging", title: "竹加工剩余物缓冲包装材料的设计与应用验证", user: "拟调研的农产品经营主体与包装使用方", problem: "核实运输防护、成本和包装使用中的具体问题", resource: "竹木材料专业知识、科技小院合作渠道，以及拟申请的原料与实验条件", route: "原料表征 → 配方与成型方案 → 压缩 / 缓冲 / 吸湿测试设计 → 单一运输场景适配", output: "需求访谈提纲、材料与结构方案、样品计划、对照试验方案及应用分析", risk: "包装对象、原料供应和测试条件需落实；缓冲、成本与环境表现均需实测", keywords: ["竹纤维", "模塑缓冲包装", "压缩性能", "吸湿性能"], differentiation: "拟与现有包装比较防护表现、材料用量、加工与使用成本；优劣以对照验证为依据。" },
  { id: "bamboo-nursery", title: "竹纤维育苗容器的结构与湿态性能研究", user: "拟联系的苗圃或育苗经营主体", problem: "核实育苗容器在湿态使用、搬运与后续处置中的问题", resource: "纤维材料基础、拟对接的育苗场景与成型测试条件", route: "育苗需求访谈 → 纤维容器方案 → 湿态强度测试设计 → 使用周期验证", output: "场景调研、容器设计、测试计划和育苗验证方案", risk: "需找到育苗合作方并确认验证周期；降解表现需要独立验证", keywords: ["竹纤维", "育苗容器", "湿态强度"], differentiation: "拟比较容器湿态强度、使用寿命与单位成本，验证方案需要合作方确认。" },
  { id: "bamboo-board", title: "竹木剩余物功能板材的设计与性能验证", user: "拟调研的板材生产或应用方", problem: "核实剩余物利用与具体板材应用的性能需求", resource: "木材科学与工程知识、拟协调的板材加工和性能测试条件", route: "原料调查 → 应用需求 → 配方与成型方案 → 目标性能对照试验", output: "材料方案、工艺设计、样品与测试计划", risk: "加工设备和适用性能要求尚需明确，涉及专项用途时须核对对应要求", keywords: ["竹木剩余物", "复合板材", "力学性能"], differentiation: "围绕明确用途比较性能、用料与成本；功能性结论由实测支持。" },
] as const;
export type Topic = typeof topics[number];
export function selectedTopic(preparation: Preparation) { return topics.find((topic) => topic.id === preparation.topicId); }
export function nextQuestion(preparation: Preparation) { return questions.find((question) => !preparation.answers[question.id]?.trim()); }
export function preparationKeywords(preparation: Preparation) { return selectedTopic(preparation)?.keywords.join(" ") || "竹木加工剩余物 材料利用 农产品包装"; }
export function demoProfile(): StudentProfile {
  return { school: "福建农林大学", college: "材料工程学院", major: "木材科学与工程", grade: "其他", competitionGoal: "争取省赛、国赛成果，完成有依据的参赛材料", skills: ["木材科学与工程专业背景"], hasTeam: false, teamSize: null, teamCapabilities: "", mentors: "", resources: { equipment: "", labs: "", bases: "与南平市政和县有科技小院合作（用户提供）", enterprises: "", ruralResearch: "" }, weeklyHours: 8, budget: 0, currentProjectStatus: "no-project" };
}
export function topicValues(preparation: Preparation, profile: StudentProfile) {
  const topic = selectedTopic(preparation);
  if (!topic) return null;
  return {
    oneLineDescription: preparation.topicTitle || topic.title,
    targetPain: `【待验证假设】${topic.user}；${preparation.answers.demand || topic.problem}`,
    differentiation: `【拟议验证】${topic.differentiation}`,
    technicalRoute: `【拟议方案】${topic.route}。设备和方法需由指导老师确认。`,
    team: preparation.answers.team || "【待补充】团队成员、人数与具体分工尚未确定。",
    progress: `已知背景：${profile.school}、${profile.college}、${profile.major}；${profile.resources.bases}。资源访谈（学生提供，含演示假设）：${Object.values(preparation.answers).join("；")}。当前未提供实测数据。`,
    goal: profile.competitionGoal,
  };
}

// Planning fit is a platform suggestion. It never supplies official eligibility, dates or scores.
export function competitionPreparationFit(name: string, profile?: StudentProfile) {
  if (!profile || !/木材|材料|农林|林学|农学|园艺/.test(profile.major + profile.college)) return { score: 0, reason: "" };
  const cooperation = /科技小院|乡村|企业|合作社/.test(Object.values(profile.resources).join(" "));
  if (/互联网\+|国际大学生创新/.test(name)) return { score: 32 + (cooperation ? 10 : 0), reason: "可围绕材料方案、真实产业需求与应用价值组织创新创业项目；赛道与资格另行核对" };
  if (/挑战杯/.test(name) && /创业|计划/.test(name)) return { score: 28 + (cooperation ? 8 : 0), reason: "适合比较客户需求、应用路径和成本；需要补充访谈与验证材料" };
  if (/林业|林草|木材/.test(name) && /创新|创业/.test(name)) return { score: 30 + (cooperation ? 8 : 0), reason: "与竹木剩余物利用及林业产业应用相关，可突出材料与工艺方案；须核对本届赛制与成果要求" };
  if (/挑战杯|林业|林草|木材|材料|乡村/.test(name)) return { score: 24 + (cooperation ? 6 : 0), reason: "专业或产业场景相关，需进一步比较实验成果、提交要求和团队条件" };
  return { score: 0, reason: "" };
}

export function competitionDisplayName(name: string) {
  if (!/互联网\+/.test(name)) return name;
  return /福建|省/.test(name) ? "福建省大学生创新大赛（目录旧称：互联网+省赛）" : "中国国际大学生创新大赛（目录旧称：互联网+）";
}
export function competitionFamily(name: string) {
  if (/互联网\+|国际大学生创新/.test(name)) return "student-innovation";
  if (/挑战杯/.test(name)) return /创业|计划/.test(name) ? "challenge-entrepreneurship" : "challenge-academic";
  if (/林业创新创业大赛/.test(name)) return "forestry-entrepreneurship";
  return name;
}
export function diverseShortlist<T extends { name: string }>(ranked: T[], count = 3): T[] {
  const families = new Set<string>();
  return ranked.filter((item) => { const family = competitionFamily(item.name); if (families.has(family)) return false; families.add(family); return true; }).slice(0, count);
}

/** Stable provenance: changing answers, topic, references or profile requires a fresh material review. */
export function preparationContextKey(preparation: Preparation, profile: StudentProfile): string | null {
  if (!preparation.topicId) return null;
  return JSON.stringify({ topicId: preparation.topicId, title: preparation.topicTitle, binding: preparation.topicBinding, entry: preparation.entry, answers: Object.entries(preparation.answers).sort(([a], [b]) => a.localeCompare(b)), research: [...preparation.research].sort((a, b) => a.url.localeCompare(b.url)), profile });
}
export function preparationNeedsReview(document: PlanDocument, preparation: Preparation, profile: StudentProfile) {
  const key = preparationContextKey(preparation, profile);
  return (document.preparationKey ?? null) !== key || Boolean(key && (!preparation.topicConfirmedAt || preparation.topicBinding !== bindingKey(document.binding)));
}
