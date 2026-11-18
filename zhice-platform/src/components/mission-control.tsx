"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, FilePenLine, FolderOpen, Gauge, Leaf, ListChecks, Presentation, ShieldCheck, Trophy, Users } from "lucide-react";
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
import { WorkspaceLanding } from "@/components/design-world-hero";

const mainItems = [
  { view: "competitions", label: "画像与选赛", icon: Trophy },
  { view: "topics", label: "定题与找依据", icon: Leaf },
  { view: "plan", label: "计划书与文档", icon: FilePenLine },
  { view: "ppt", label: "演示文稿与材料自查", icon: Presentation },
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
  const dark = ["profile", "projects", "overview"].includes(view);
  const parentStep = ["journey", "profile", "requirements"].includes(view) ? "competitions" : view === "evidence" ? "topics" : ["verification", "tasks", "check"].includes(view) ? "ppt" : null;
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
  if (!params.get("view")) return <WorkspaceLanding />;
  return <div data-surface={dark ? "dark" : "light"} className={dark ? "min-h-screen bg-[#0c111c] text-slate-100" : "min-h-screen bg-[#f5f7f6] text-slate-900"}>
    <main className="min-h-screen">
      <header className={`sticky top-0 z-20 border-b backdrop-blur-xl ${dark ? "border-white/10 bg-[#0c111c]/95" : "border-slate-200 bg-white/95"}`}><div className="mx-auto flex min-h-[76px] max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-7"><div className="flex min-w-0 items-center gap-3"><Link href="/?view=overview" aria-label="知策台首页" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white"><Leaf size={22} /></Link><div><p className="max-w-[45vw] truncate text-xs text-slate-500">知策台 · {project?.name || "从专业与真实资源出发"}</p><h1 className="mt-1 text-lg font-bold">{title}</h1></div></div><div className="flex items-center gap-3"><ProjectSwitcher /><details className="relative"><summary className="cursor-pointer rounded-xl border border-slate-400/30 px-3 py-3 text-sm">项目管理</summary><div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-700 shadow-lg"><Link href="/?view=projects" className="block rounded-lg p-3 hover:bg-slate-50">切换或新建项目</Link><Link href="/admin" className="block rounded-lg p-3 hover:bg-slate-50">资料与模型设置</Link></div></details></div></div></header>
      <div key={projectScopeKey(project) || "onboarding"} className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-7">
        {ready && view !== "overview" && <PreparationSteps />}
        {parentStep && <Link href={`/?view=${parentStep}${parentStep === "ppt" ? "&panel=check" : ""}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-emerald-700"><ArrowLeft size={15} />返回{mainItems.find((item) => item.view === parentStep)?.label}</Link>}
        {!ready ? <p role="status" className="p-8 text-sm text-slate-500">正在恢复备赛项目…</p>
          : view === "verification" ? <VerificationCenter />
          : !project ? <><PreparationEntry /><WorkspaceProjects /></>
          : view === "journey" ? <PreparationHome />
          : view === "profile" || view === "projects" ? <WorkspaceProjects profileView={view === "profile"} />
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
