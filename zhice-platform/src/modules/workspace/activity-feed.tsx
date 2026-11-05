"use client";
import Link from "next/link";
import { Activity, ArrowUpRight, Check, CircleAlert, Clock3, LoaderCircle } from "lucide-react";
import { useWorkspaceStore } from "./workspace.store";
import type { WorkspaceActivity } from "./types";
import { projectScopeKey } from "./types";
import { activityTones, activityStyles as s } from "./activity-feed.styles";

const statusLabels = { success: "成功", running: "进行中", warning: "待核对", error: "失败" };
function ActivityItem({ item }: { item: WorkspaceActivity }) {
  return <li className={s.feedItem}><span className={s.feedIcon + " " + activityTones[item.status]} aria-label={statusLabels[item.status]}>{item.status === "success" ? <Check size={14} /> : item.status === "running" ? <LoaderCircle size={14} className={s.spinner} /> : <CircleAlert size={14} />}</span><div className={s.feedBody}><div className={s.feedTop}><Link href={item.href} className={s.feedTitle}>{item.title}</Link><div className={s.feedTime}><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time><span>·</span><span>{item.durationMs !== undefined ? (item.durationMs / 1000).toFixed(1) + "s" : "进行中"}</span></div></div><p className={s.feedDetail}>{item.detail}</p></div></li>;
}
export function ActivityFeed({ all = false }: { all?: boolean }) {
  const activities = useWorkspaceStore((state) => state.activities);
  const projectId = useWorkspaceStore((state) => state.currentProjectId);
  const scope = useWorkspaceStore((state) => projectScopeKey(state.project));
  const items = activities.filter((item) => Boolean(projectId) && item.projectId === projectId && (item.scopeKey ? item.scopeKey === scope : scope === projectId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, all ? 100 : 5);
  return <section id="activity-feed" className={s.panel} aria-label={all ? "全部操作记录" : "实时任务流"}><div className={s.sectionHeader}><div><h3 className={s.title}><Activity size={17} />{all ? "全部操作记录" : "实时任务流"}</h3><p className={s.subtitle}>{all ? "本机最近 100 条操作，包含中断与降级记录。" : "最近 5 条真实操作，进展与异常都在这里。"}</p></div>{!all && <Link href="/?view=tasks#activity-feed" className={s.link}>查看全部任务<ArrowUpRight size={13} /></Link>}</div>
    {items.length ? <ol className={s.feed}>{items.map((item) => <ActivityItem item={item} key={item.id} />)}</ol> : <div className={s.empty}><Clock3 size={24} className={s.emptyIcon} /><p>还没有操作记录</p><p className={s.paperMeta}>选择比赛要求文件，开始第一条证据链。</p></div>}
  </section>;
}
