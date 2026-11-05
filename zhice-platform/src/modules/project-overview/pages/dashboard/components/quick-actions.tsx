"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck, FilePenLine, Presentation, Trophy, Zap } from "lucide-react";
import { dashboardStyles as s } from "../dashboard.styles";

const actions = [
  { href: "/?view=competitions", icon: Trophy, title: "回到画像与选赛", text: "补充资源访谈，比较赛事并核对本届规则。" },
  { href: "/?view=topics", icon: BookOpen, title: "比较题目与依据", text: "比较方向、检索论文、登记案例并进入证据库。" },
  { href: "/?view=plan", icon: FilePenLine, title: "继续计划书与 Word", text: "修改章节、确认来源并导出当前版本。" },
  { href: "/?view=ppt", icon: Presentation, title: "生成与检查 PPT", text: "组织大纲、选择版式，导出后进入提交前检查。" },
];

export function QuickActions() {
  return <section id="quick-actions" className={s.panel} aria-label="四步入口"><div className={s.sectionHeader}><div><h3 className={s.title}><Zap size={17} />继续材料准备</h3><p className={s.subtitle}>项目首页只保留四步主路径，具体工具在对应步骤内打开。</p></div><span className={s.count}>四步工作流</span></div><div className={s.actions}>{actions.map(({ href, icon: Icon, title, text }) => <Link key={href} href={href} className={s.action}><div className={s.actionHeader}><span className={s.actionIcon}><Icon size={19} /></span><div><h4 className={s.actionTitle}>{title}</h4><p className={s.actionText}>{text}</p></div></div><ArrowRight size={18} className={s.arrow} /></Link>)}<Link href="/?view=check" className={s.action + " " + s.ppt}><div className={s.actionHeader}><span className={s.actionIcon}><ClipboardCheck size={19} /></span><div><h4 className={s.actionTitle}>打开材料一致性检查</h4><p className={s.actionText}>完成 PPT、计划书和引用的提交前检查。</p></div></div><ArrowRight size={18} className={s.arrow} /></Link></div></section>;
}
