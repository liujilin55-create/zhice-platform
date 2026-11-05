import { VerificationText } from "@/modules/verification";
import Link from "next/link";
import { ArrowRight, Focus, RotateCcw, Sparkles } from "lucide-react";
import { useBriefing } from "../../../hooks/use-briefing";
import type { OverviewSnapshot } from "../../../dashboard-types";
import type { OrchestrationTask } from "@/modules/task-orchestration";
import { preparationStepView, useWorkspaceStore } from "@/modules/workspace";
import { dashboardStyles as s } from "../dashboard.styles";

type Props = { snapshot: OverviewSnapshot | null; name: string; tasks: OrchestrationTask[]; empty: boolean; onRestart: () => void; error: string | null };
export function AiBriefing({ snapshot, name, tasks, empty, onRestart, error }: Props) {
  const project = useWorkspaceStore((state) => state.project);
  const briefing = useBriefing(snapshot, name, tasks, empty);
  const nextTask = tasks.find((task) => task.status === "active") ?? tasks.find((task) => task.status !== "done");
  const focus = nextTask?.title || (snapshot?.reportId ? "核验评分点的证据" : "导入第一份比赛要求");
  const href = project ? `/?view=${preparationStepView(project)}` : nextTask ? "/?view=tasks&task=" + encodeURIComponent(nextTask.id) + "#task-" + nextTask.id : snapshot?.reportId ? snapshot.coverage.find((row) => row.state !== "covered")?.href || "/reports/" + encodeURIComponent(snapshot.reportId) : "/?view=requirements";
  return <section className={s.hero} aria-label="AI 项目简报">
    <div className={s.glow} /><div className={s.heroGrid}><div>
      <div className={s.heroLabel}><span className={s.aiIcon}><Sparkles size={18} /></span><span>AI 项目简报</span><span className={s.mode}>{briefing.status === "streaming" ? "正在生成" : briefing.mode === "ai" && briefing.text ? "AI 分析 · 仅供参考" : "本地项目摘要"}</span></div>
      <h3 className={s.projectTitle}>正在准备「{name}」</h3>
      <div className={s.briefing}>{briefing.text ? <VerificationText text={briefing.text} /> : (error ? "暂时无法读取项目资料，请重试。你仍可上传比赛要求或进入任务工作区。" : <><div className={s.skeleton} /><div className={s.skeletonShort} /></>)}{briefing.status === "streaming" && <span className={s.cursor} aria-hidden="true" />}</div>
      <span className="sr-only" role="status">{briefing.status === "streaming" ? "项目简报生成中" : briefing.status === "done" ? "项目简报已完成" : "等待项目资料"}</span>
      {briefing.error && <p role="alert" className={s.error}>{briefing.error}</p>}
      <div className={s.buttons}><Link href={href} className={s.primary}>继续当前任务<ArrowRight size={14} /></Link><button type="button" onClick={onRestart} className={s.secondary}><RotateCcw size={13} />重新开始</button><button type="button" onClick={briefing.refresh} disabled={!snapshot || briefing.status === "streaming"} className={s.textButton}>更新简报</button></div>
    </div><aside className={s.focus}><div><p className={s.focusLabel}>YOUR NEXT MOVE / 当前焦点</p></div><div><Focus size={26} className={s.focusIcon} /><p className={s.focusTitle}>{focus}</p><p className={s.focusHint}>{nextTask ? "继续推进当前执行任务，让方案落到可验收的结果。" : snapshot?.reportId ? "把建议和原文逐项对齐，补齐尚未确认的依据。" : "让评分标准、参考研究和备赛路线从这里连接。"}</p></div><p className={s.focusLabel}>从一个明确的动作开始 →</p></aside></div>
  </section>;
}
