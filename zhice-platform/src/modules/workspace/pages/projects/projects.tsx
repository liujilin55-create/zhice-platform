"use client";
import { VerificationText } from "@/modules/verification";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, FolderOpen, GraduationCap, Plus, Settings2, Trophy } from "lucide-react";
import { archivedPlanMarkdown } from "@/modules/project-plan";
import { getAllCompetitions } from "@/modules/competition-recommendation";
import { useWorkspaceStore } from "../../workspace.store";
import { assetStatusLabels, preparationStepView, projectStageLabels } from "../../types";
import { ActivityFeed } from "../../activity-feed";
import { ProjectSetup } from "./project-setup";
import { workspaceStyles as s } from "./projects.styles";

export function ProjectSwitcher() {
  const router = useRouter();
  const projects = useWorkspaceStore((state) => state.projects);
  const currentId = useWorkspaceStore((state) => state.currentProjectId);
  if (!projects.length) return null;
  return <label className="min-w-0"><span className="sr-only">切换备赛项目</span><select aria-label="切换备赛项目" value={currentId || ""} onChange={(event) => { const next = projects.find((item) => item.projectId === event.target.value); useWorkspaceStore.getState().switchProject(event.target.value); router.push(`/?view=${next ? preparationStepView(next) : "overview"}`); }} className="min-h-10 w-full max-w-[112px] rounded-xl border border-indigo-300/25 bg-[#18213a] px-3 text-xs text-slate-100 sm:max-w-[240px]">{projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.name}</option>)}</select></label>;
}

export function WorkspaceProjects({ profileView = false }: { profileView?: boolean }) {
  const router = useRouter();
  const project = useWorkspaceStore((state) => state.project);
  const projects = useWorkspaceStore((state) => state.projects);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!project || creating || editing) return <ProjectSetup editing={editing} onCancel={project ? () => { setCreating(false); setEditing(false); } : undefined} onDone={() => { setCreating(false); setEditing(false); router.push(editing ? "/?view=overview" : "/?view=competitions"); }} />;
  const profile = project.studentProfile;
  const selected = getAllCompetitions().find((competition) => competition.id === project.selectedCompetitionId);
  return <div className={s.page}>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className={s.eyebrow}>PROFILE → PROJECT → COMPETITION</p><h2 className={s.heading}>{profileView ? "我的参赛画像" : "从你的优势，找到备赛的方向。"}</h2><p className={s.hint}>每个备赛项目分别保存画像、比赛选择、报告、计划书和任务。</p></div><button type="button" onClick={() => setCreating(true)} className={s.primary}><Plus size={16} />新建备赛项目</button></header>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className={s.panel} aria-label="我的参赛画像"><div className="flex items-center justify-between gap-3"><h3 className={s.title}><GraduationCap size={20} className="text-indigo-300" />我的参赛画像</h3><button type="button" className={s.secondary} onClick={() => setEditing(true)}><Settings2 size={14} />编辑画像</button></div><p className="mt-5 text-xl font-semibold">{profile.school}</p><p className={s.hint}>{profile.college} · {profile.major} · {profile.grade}</p><div className={s.list}>{[
        ["参赛目标", profile.competitionGoal], ["技能", profile.skills.join("、") || "待补充"],
        ["团队", (profile.hasTeam ? "已有团队" : "暂未组队") + (profile.teamCapabilities ? " · " + profile.teamCapabilities : "")],
        ["投入", `每周 ${profile.weeklyHours} 小时 · 预算 ${profile.budget} 元`], ["可用导师", profile.mentors || "暂未填写"],
        ["可用资源", Object.entries(profile.resources).filter(([, value]) => value).map(([key, value]) => ({ equipment: "设备", labs: "实验室", bases: "基地", enterprises: "企业", ruralResearch: "乡村调研" }[key] + "：" + value)).join("；") || "暂未填写"],
      ].map(([label, value]) => <div key={label} className={s.pair}><p className="text-xs text-slate-500">{label}</p><p className={s.value}>{value}</p></div>)}</div></section>
      <section className={s.panel} aria-label="当前备赛项目"><div className="flex items-center justify-between gap-3"><h3 className={s.title}><FolderOpen size={19} className="text-indigo-300" />当前备赛项目</h3><span className={s.badge}>{projectStageLabels[project.projectStage]}</span></div><h3 className="mt-5 text-xl font-semibold">{project.name}</h3><p className="mt-2 break-all font-mono text-[10px] text-slate-500">项目 ID：{project.projectId}</p><div className={s.list}>{[["赛事要求", project.reportId ? "已关联分析报告" : "尚未上传"], ["计划书", assetStatusLabels[project.documentStatus]], ["PPT", assetStatusLabels[project.pptStatus]], ["最近更新", new Date(project.updatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })]].map(([label, value]) => <div key={label} className={s.pair}><p className="text-xs text-slate-500">{label}</p><p className={s.value}>{value}</p></div>)}</div>
        <div className="mt-5 rounded-2xl border border-indigo-300/20 bg-indigo-400/5 p-4"><p className="flex items-center gap-2 text-xs text-indigo-200"><Trophy size={15} />{selected ? "已选择比赛" : "下一步 · 选择比赛"}</p><p className="mt-2 font-semibold">{selected?.name || (project.selectedCompetitionId ? "已保存比赛选择" : "为这个项目找到合适的赛事")}</p><p className={s.hint}><VerificationText text={selected ? `${selected.externalLevel} · ${selected.competitionTime || "本届时间待核验"}` : "根据专业、资源与目录信息，先明确备赛方向。"} source={selected?.officialSourceUrl || undefined} href={selected?.officialSourceUrl || "/?view=requirements"} /></p><Link className={s.primary + " mt-4"} href="/?view=competitions">{selected ? "查看比赛推荐" : "去选择比赛"}<ArrowRight size={14} /></Link></div>
      </section>
    </div>
    {projects.length > 1 && <section className={s.panel}><h3 className={s.title}>我的备赛项目</h3><div className={s.list}>{projects.map((item) => <button type="button" key={item.projectId} onClick={() => useWorkspaceStore.getState().switchProject(item.projectId)} aria-pressed={item.projectId === project.projectId} className={s.pair + " text-left transition hover:border-indigo-300/50"}><p className="font-semibold">{item.name}{item.projectId === project.projectId && <span className="ml-2 text-xs text-indigo-300">当前</span>}</p><p className={s.hint}>{projectStageLabels[item.projectStage]} · {item.studentProfile.major}</p></button>)}</div></section>}
    <section className={s.panel}><h3 className={s.title}>后续备赛阶段</h3><p className={s.hint}>选择比赛后，可以沿用现有工具继续准备。</p><div className="mt-4 flex flex-wrap gap-3">{[["requirements", "比赛要求分析"], ["plan", "项目计划书"], ["ppt", "一键生成 PPT"], ["overview", "项目总览"], ["tasks", "任务编排"]].map(([view, label]) => <Link key={view} href={"/?view=" + view} className={s.secondary}>{label}<ArrowRight size={13} /></Link>)}</div></section>
    {project.competitionHistory.some((entry) => entry.competitionId || entry.reportId) && <section className={s.panel}><h3 className={s.title}>历史比赛材料</h3><p className={s.hint}>旧比赛的材料保留在这里，不参与当前报告和计划书生成。</p><div className={s.list}>{project.competitionHistory.filter((entry) => entry.competitionId || entry.reportId).map((entry) => <div key={entry.scopeKey} className={s.pair}><p className={s.value}>{getAllCompetitions().find((item) => item.competitionId === entry.competitionId)?.name || "历史项目材料"}</p><div className="flex flex-wrap gap-3">{entry.reportId && <Link href={"/reports/" + encodeURIComponent(entry.reportId)} className={s.secondary}>查看历史报告</Link>}{archivedPlanMarkdown(entry.scopeKey) && <button type="button" className={s.secondary} onClick={() => { const content = archivedPlanMarkdown(entry.scopeKey); if (!content) return; const url = URL.createObjectURL(new Blob([content], { type: "text/markdown;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "历史比赛计划书.md"; link.click(); URL.revokeObjectURL(url); }}>下载历史计划书</button>}</div></div>)}</div></section>}
    <ActivityFeed />
  </div>;
}
