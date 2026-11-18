export type PptMasterTemplateId = "general" | "consultant" | "consultant_top" | "academic_defense";

type TemplateColors = {
  background: string;
  surface: string;
  accent: string;
  text: string;
  muted: string;
};

export type TemplatePreset = {
  id: PptMasterTemplateId;
  name: string;
  description: string;
  colors: TemplateColors;
  cover: TemplateColors;
  fonts: { heading: string; body: string };
  chartStyle: "bar" | "line";
  coverLayout: "left" | "center";
  closingLayout: "left" | "center";
};

export const pptMasterTemplateIds: readonly PptMasterTemplateId[] = ["general", "consultant", "consultant_top", "academic_defense"];

const legacyTemplateAliases: Record<string, PptMasterTemplateId> = {
  "zhice-dark": "general",
  contest: "consultant",
  "tech-blue": "consultant_top",
  minimal: "academic_defense",
};

export const templatePresets: Record<PptMasterTemplateId, TemplatePreset> = {
  general: {
    id: "general",
    name: "General · 通用灵活",
    description: "现代简洁，适合工作汇报、项目介绍和产品展示。",
    colors: { background: "F8FAFC", surface: "FFFFFF", accent: "1E3A5F", text: "333333", muted: "64748B" },
    cover: { background: "1E3A5F", surface: "0F1C2E", accent: "6366F1", text: "FFFFFF", muted: "CBD5E1" },
    fonts: { heading: "Microsoft YaHei", body: "Microsoft YaHei" },
    chartStyle: "bar",
    coverLayout: "left",
    closingLayout: "center",
  },
  consultant: {
    id: "consultant",
    name: "Consultant · 咨询顾问",
    description: "专业严谨，适合商业咨询、战略分析和项目汇报。",
    colors: { background: "FFFFFF", surface: "F1F5F9", accent: "0066CC", text: "0A1628", muted: "64748B" },
    cover: { background: "0A1628", surface: "0A1628", accent: "D4AF37", text: "FFFFFF", muted: "94A3B8" },
    fonts: { heading: "Arial", body: "Arial" },
    chartStyle: "bar",
    coverLayout: "left",
    closingLayout: "center",
  },
  consultant_top: {
    id: "consultant_top",
    name: "Consultant Top · 顶级咨询",
    description: "高端克制，适合董事会、高管战略和投资分析汇报。",
    colors: { background: "FFFFFF", surface: "F8FAFC", accent: "6366F1", text: "111827", muted: "6B7280" },
    cover: { background: "0D1117", surface: "1F2937", accent: "D4AF37", text: "FFFFFF", muted: "9CA3AF" },
    fonts: { heading: "Arial", body: "Arial" },
    chartStyle: "line",
    coverLayout: "left",
    closingLayout: "left",
  },
  academic_defense: {
    id: "academic_defense",
    name: "Academic Defense · 学术答辩",
    description: "规范清晰，适合毕业答辩、科研汇报和课题申请。",
    colors: { background: "FFFFFF", surface: "F5F7FA", accent: "003366", text: "333333", muted: "666666" },
    cover: { background: "003366", surface: "003366", accent: "CC0000", text: "FFFFFF", muted: "E8F4FC" },
    fonts: { heading: "Microsoft YaHei", body: "Microsoft YaHei" },
    chartStyle: "bar",
    coverLayout: "left",
    closingLayout: "center",
  },
};

export function canonicalTemplateId(template: string): string {
  return legacyTemplateAliases[template] || template;
}

export function getTemplatePreset(template: string): TemplatePreset {
  return templatePresets[canonicalTemplateId(template) as PptMasterTemplateId] || templatePresets.general;
}

export function isPptMasterTemplate(template: string): template is PptMasterTemplateId {
  return pptMasterTemplateIds.includes(template as PptMasterTemplateId);
}
