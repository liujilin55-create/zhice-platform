"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ActivityFeed, useWorkspaceStore } from "@/modules/workspace";
import { useTaskStore } from "@/modules/task-orchestration";
import { useOverviewSnapshot } from "../../hooks/use-overview-snapshot";
import { AiBriefing } from "./components/ai-briefing";
import { CoverageMatrix } from "./components/coverage-matrix";
import { QuickActions } from "./components/quick-actions";
import { dashboardStyles as s } from "./dashboard.styles";

export function Dashboard() {
  const router = useRouter();
  const project = useWorkspaceStore((state) => state.project);
  const ready = useWorkspaceStore((state) => state.ready);
  const allTasks = useTaskStore((state) => state.tasks);
  const tasks = useMemo(() => allTasks.filter((task) => !task.sample && (project ? task.projectId === project.projectId : !task.projectId)), [allTasks, project]);
  const empty = !project?.reportId;
  const snapshot = useOverviewSnapshot(project?.reportId ?? null, empty, ready);
  const name = project?.name || snapshot.data?.projectName || "传智杯 · AI Web 赛道";
  return <div className={s.page}>
    <div className={s.intro}><div><p className={s.eyebrow}>COMPETITION WORKSPACE</p><h2 className={s.heading}>让下一步，清晰可见。</h2></div><p className={s.introHint}>从赛题到交付，每一步都有依据。</p></div>
    {snapshot.error && <div className={s.error} role="alert">{snapshot.error} <button type="button" onClick={snapshot.refresh} className={s.link}>重新读取</button></div>}
    <AiBriefing snapshot={snapshot.data} name={name} tasks={tasks} empty={empty} onRestart={() => router.push("/?view=projects")} error={snapshot.error} />
    <div className={s.grid}><CoverageMatrix snapshot={snapshot.data} loading={snapshot.loading} /><QuickActions /></div>
    <ActivityFeed />
    <footer className={s.footer}><span>知策台 / 竞赛准备，从有据可依开始。</span><span>AI 建议仅供参考 · 请以比赛官方通知为准</span></footer>
  </div>;
}
