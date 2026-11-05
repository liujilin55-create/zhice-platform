import { z } from "zod";
import { preparationSchema } from "@/shared/contracts/preparation";
import { bindingKey, type CompetitionBinding } from "@/shared/contracts/competition-binding";

export const activitySchema = z.object({
  id: z.string(), kind: z.enum(["analysis", "search", "ppt", "briefing", "task", "project"]),
  title: z.string(), detail: z.string(), status: z.enum(["running", "success", "warning", "error"]),
  createdAt: z.string(), updatedAt: z.string(), durationMs: z.number().optional(), href: z.string(),
  projectId: z.string().optional(), scopeKey: z.string().optional(), competitionId: z.string().nullable().optional(),
});
export type WorkspaceActivity = z.infer<typeof activitySchema>;
export const projectStageSchema = z.enum(["no-project", "idea", "project", "artifact"]);
export type ProjectStage = z.infer<typeof projectStageSchema>;
export const projectStageLabels: Record<ProjectStage, string> = { "no-project": "没有项目", idea: "只有想法", project: "已有项目", artifact: "已有作品" };
export const studentProfileSchema = z.object({
  school: z.string().trim().min(1).max(120), college: z.string().trim().min(1).max(120),
  major: z.string().trim().min(1).max(120), grade: z.enum(["大一", "大二", "大三", "大四", "研究生", "其他"]),
  competitionGoal: z.string().trim().min(1).max(600), skills: z.array(z.string().max(100)).max(30),
  hasTeam: z.boolean(), teamSize: z.number().int().min(1).max(100).nullable().default(null), teamCapabilities: z.string().max(1200), mentors: z.string().max(600),
  resources: z.object({ equipment: z.string().max(600), labs: z.string().max(600), bases: z.string().max(600), enterprises: z.string().max(600), ruralResearch: z.string().max(600) }),
  weeklyHours: z.number().min(1).max(168), budget: z.number().min(0).max(10000000), currentProjectStatus: projectStageSchema,
});
export type StudentProfile = z.infer<typeof studentProfileSchema>;
export function emptyStudentProfile(): StudentProfile {
  return { school: "福建农林大学", college: "", major: "", grade: "大二", competitionGoal: "", skills: [], hasTeam: false, teamSize: null, teamCapabilities: "", mentors: "", resources: { equipment: "", labs: "", bases: "", enterprises: "", ruralResearch: "" }, weeklyHours: 8, budget: 0, currentProjectStatus: "no-project" };
}
export const assetStatusSchema = z.enum(["not_started", "draft", "confirmed", "exported"]);
export type AssetStatus = z.infer<typeof assetStatusSchema>;
export const assetStatusLabels: Record<AssetStatus, string> = { not_started: "未开始", draft: "草稿", confirmed: "已确认", exported: "已导出" };
export const workspaceProjectSchema = z.object({
  preparation: preparationSchema.default(() => preparationSchema.parse({})),
  projectId: z.string().min(1), name: z.string().trim().min(1).max(120), studentProfile: studentProfileSchema,
  selectedCompetitionId: z.string().nullable(), selectedTrackId: z.string().nullable(), projectStage: projectStageSchema,
  reportId: z.string().nullable(), reportIds: z.array(z.string()).default([]),
  documentStatus: assetStatusSchema, pptStatus: assetStatusSchema, createdAt: z.string(), updatedAt: z.string(),
  selectionRevision: z.string().default("legacy"), competitionConfirmedAt: z.string().nullable().default(null),
  competitionHistory: z.array(z.object({ scopeKey: z.string(), competitionId: z.string().nullable(), trackId: z.string().nullable(), reportId: z.string().nullable(), reportIds: z.array(z.string()), archivedAt: z.string() })).default([]),
});
export type WorkspaceProject = z.infer<typeof workspaceProjectSchema>;
export function projectBinding(project: WorkspaceProject | null): CompetitionBinding | null {
  return project?.selectedCompetitionId && project.selectedTrackId ? { projectId: project.projectId, competitionId: project.selectedCompetitionId, trackId: project.selectedTrackId, revision: project.selectionRevision } : null;
}
export function projectScopeKey(project: WorkspaceProject | null) { const binding = projectBinding(project); return binding ? bindingKey(binding) : project?.projectId ?? null; }

export type PreparationStepView = "competitions" | "topics" | "plan" | "ppt";

/** Returns the four-step destination that currently needs the user's attention. */
export function preparationStepView(project: WorkspaceProject | null): PreparationStepView {
  if (!project?.competitionConfirmedAt || !project.selectedCompetitionId || !project.selectedTrackId) return "competitions";
  if (!project.preparation.topicId || !project.preparation.topicConfirmedAt || project.preparation.topicBinding !== projectScopeKey(project)) return "topics";
  if (project.documentStatus === "not_started" || project.documentStatus === "draft") return "plan";
  return "ppt";
}
