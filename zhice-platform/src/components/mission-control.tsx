"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FilePenLine, FolderOpen, Gauge, Leaf, ListChecks, Menu, Presentation, ShieldCheck, Trophy, Users, X, type LucideIcon } from "lucide-react";
import { loadCampusCatalog } from "@/modules/campus-catalog";
import { CompetitionRecommendation } from "@/modules/competition-recommendation";
import { CompetitionRequirements, useAnalysisResultsStore } from "@/modules/competition-requirements";
import { PptGenerator, usePptWorkspaceStore } from "@/modules/ppt-generator";
import { ProjectOverview } from "@/modules/project-overview";
import { EvidenceCenter } from "@/modules/evidence-center";
import { TaskOrchestration, useTaskStore } from "@/modules/task-orchestration";
import { DeliverableCheck } from "@/modules/deliverable-check";
import { ProjectPlan, useProjectPlanStore } from "@/modules/project-plan";
import { ProjectSwitcher, WorkspaceProjects, useWorkspaceStore, projectScopeKey } from "@/modules/workspace";
import { PreparationHome, PreparationSteps, PreparationEntry, TopicStudio } from "@/modules/preparation";
import { VerificationCenter } from "@/modules/verification";

const mainItems = [
  { view: "competitions", label: "画像与选赛", icon: Trophy },
  { view: "topics", label: "定题与找依据", icon: Leaf },
  { view: "plan", label: "计划书与 Word", icon: FilePenLine },
  { view: "ppt", label: "PPT 与材料自查", icon: Presentation },
];
const projectItems = [
  { view: "overview", label: "项目首页", icon: Gauge },
  { view: "projects", label: "备赛项目", icon: FolderOpen },
  { view: "profile", label: "参赛画像", icon: Users },
];
const supportItems = [
  { view: "verification", label: "核验工作台", icon: ShieldCheck },
  { view: "tasks", label: "材料待补清单", icon: ListChecks },
  { view: "check", label: "材料一致性检查", icon: ShieldCheck },
];
const hiddenStepTools = [
  { view: "journey", label: "资源访谈" },
  { view: "requirements", label: "比赛要求分析" },
  { view: "evidence", label: "案例与证据库" },
];
const routeItems = [...mainItems, ...projectItems, ...supportItems, ...hiddenStepTools];
let workspaceInitialization: Promise<void> | null = null;
export function MissionControl() {
  const project = useWorkspaceStore((state) => state.project);
  const ready = useWorkspaceStore((state) => state.ready);
  const params = useSearchParams();
  const requested = params.get("view") || (project ? "overview" : "journey");
  const view = routeItems.some((item) => item.view === requested) ? requested : project ? "overview" : "journey";
  const title = routeItems.find((item) => item.view === view)!.label;
  const dark = ["profile", "projects", "overview", "plan"].includes(view);
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => {
    workspaceInitialization ??= (async () => {
      await loadCampusCatalog().catch(() => undefined);
      await useWorkspaceStore.persist.rehydrate();
      await Promise.all([useTaskStore.persist.rehydrate(), useProjectPlanStore.persist.rehydrate(), useAnalysisResultsStore.persist.rehydrate(), usePptWorkspaceStore.persist.rehydrate()]);
      useProjectPlanStore.getState().setHydrated();
      useWorkspaceStore.getState().setReady();
    })();
    void workspaceInitialization;
  }, []);
  const links = (items: ReadonlyArray<{ view: string; label: string; icon: LucideIcon }>) => items.map(({ view: target, label, icon: Icon }) => <Link key={target} href={`/?view=${target}`} onClick={() => setMobileNav(false)} aria-current={view === target ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${view === target ? "bg-emerald-400/15 font-semibold text-emerald-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon size={17} /><span>{label}</span></Link>);
  return <div data-surface={dark ? "dark" : "light"} className={dark ? "min-h-screen bg-[#0c111c] text-slate-100" : "min-h-screen bg-[#f5f7f6] text-slate-900"}>
    {mobileNav && <button type="button" aria-label="关闭导航遮罩" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden" />}
    <aside aria-label="主导航" className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col overflow-y-auto bg-[#111c20] px-4 py-5 text-slate-300 transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-7 flex items-center justify-between px-2"><Link href="/?view=overview" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><Leaf size={22} /></span><span><span className="block font-bold text-white">知策台</span><span className="mt-1 block text-xs text-slate-400">大学生创新创业备赛助手</span></span></Link><button type="button" aria-label="关闭导航" className="rounded-lg p-2 hover:bg-white/10 lg:hidden" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <p className="mb-2 px-3 text-xs text-slate-500">本轮材料准备</p><nav className="space-y-1">{links(mainItems)}</nav>
      <details className="mt-6" open><summary className="cursor-pointer px-3 text-xs text-slate-500">项目管理</summary><nav className="mt-2 space-y-1">{links(projectItems)}</nav></details>
      <details className="mt-4" open><summary className="cursor-pointer px-3 text-xs text-slate-500">辅助工具</summary><nav className="mt-2 space-y-1">{links(supportItems)}</nav></details>
      <div className="mt-7 border-t border-white/10 px-3 py-4 text-xs leading-7 text-slate-400"><p>{project?.studentProfile.school || "福建农林大学试点"}</p><p>{project?.studentProfile.major || "从专业与真实资源出发"}</p>{project?.reportId && <Link href={`/reports/${encodeURIComponent(project.reportId)}`} className="text-emerald-300">查看当前指导报告 →</Link>}</div>
    </aside>
    <main className="min-h-screen lg:pl-[250px]">
      <header className={`sticky top-0 z-20 flex min-h-[72px] flex-wrap items-center justify-between gap-3 border-b px-5 py-3 backdrop-blur-xl sm:px-8 ${dark ? "border-white/10 bg-[#0c111c]/95" : "border-slate-200 bg-[#f5f7f6]/95"}`}><div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="打开导航" className="rounded-lg border border-slate-400/30 p-2 lg:hidden" onClick={() => setMobileNav(true)}><Menu size={19} /></button><div><p className="max-w-[45vw] truncate text-xs text-slate-500">{project?.name || "从专业与产业资源出发"}</p><h1 className="mt-1 text-lg font-bold">{title}</h1></div></div><div className="flex items-center gap-3"><ProjectSwitcher /><Link href="/admin" className="hidden rounded-lg border border-slate-400/30 px-3 py-2 text-xs sm:block">资料与模型管理</Link></div></header>
      <div key={projectScopeKey(project) || "onboarding"} className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-7">
        {ready && <PreparationSteps />}
        {!ready ? <p role="status" className="p-8 text-sm text-slate-500">正在恢复备赛项目…</p>
          : view === "verification" ? <VerificationCenter />
          : !project ? <><PreparationEntry /><WorkspaceProjects /></>
          : view === "journey" ? <PreparationHome />
          : view === "profile" || view === "projects" ? <><PreparationEntry /><WorkspaceProjects profileView={view === "profile"} /></>
          : view === "competitions" ? <CompetitionRecommendation />
          : view === "topics" ? <TopicStudio />
          : view === "requirements" ? <CompetitionRequirements />
          : view === "plan" ? <ProjectPlan />
          : view === "ppt" ? <PptGenerator />
          : view === "evidence" ? <EvidenceCenter />
          : view === "overview" ? <ProjectOverview />
          : view === "tasks" ? <TaskOrchestration />
          : <DeliverableCheck />}
      </div>
    </main>
  </div>;
}
