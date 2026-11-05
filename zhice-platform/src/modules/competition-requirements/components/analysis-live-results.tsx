import { VerificationText } from "@/modules/verification";
import { BookOpen, ExternalLink, Sparkles } from "lucide-react";
import type { AnalysisPreview } from "../stream-types";
import { liveStyles as s } from "./analysis-live-results.styles";

function TextList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return <section className={s.panel}><h4 className={s.heading}>{title}</h4><ul className={s.list}>{items.map((item, index) => <li key={index}><VerificationText text={item} /></li>)}</ul></section>;
}

export function AnalysisLiveResults({ preview: p, busy, warnings }: { preview: AnalysisPreview; busy: boolean; warnings: string[] }) {
  if (!p.file && !warnings.length) return null;
  const r = p.requirements;
  const report = p.report;
  return <section id="analysis-live-results" className={s.wrap} aria-label="实时分析内容" aria-busy={busy}>
    <div className={s.header}><h3 className={s.title}><Sparkles size={16} />{busy ? "边生成，边阅读" : "已接收的分析内容"}</h3><span className={s.badge}>{p.mode === "demo" ? "演示内容 · 请核验" : busy ? "实时更新 · 尚未完成校验" : "未完成 · 请重新分析"}</span></div>
    <div className={s.note}>AI 建议，仅供参考。{p.mode === "demo" ? "当前展示演示建议，请以官方通知为准。" : "下方生成内容尚未完成校验，最终报告将在全部阶段结束后显示。"}{warnings.map((warning, index) => <p key={index}><VerificationText text={warning} /></p>)}</div>
    <div className={s.grid}>
      <div className={s.column}>
        {p.file && <details className={s.panel}><summary className={s.summary}>原文已提取 · {p.characterCount} 字</summary><p className={s.meta}>{p.file.name} · {p.file.parser}</p><p className={s.text}><VerificationText text={p.textPreview || "暂未提取到可读文字，请核对文件。"} />{p.characterCount > p.textPreview.length && "\n（仅展示正文开头）"}</p></details>}
        {!!p.keywords.length && <section className={s.panel}><h4 className={s.heading}>已提炼的检索关键词</h4><div className={s.tags}>{p.keywords.map((keyword, index) => <span className={s.tag} key={index}>#{keyword}</span>)}</div></section>}
        {p.papers && <section className={s.panel}><h4 className={s.title}><BookOpen size={15} />论文已返回 · {p.papers.length} 篇</h4><p className={s.text}>{p.papersCached ? "当前为本地参考资料，相关性与来源需核验。" : "可以先阅读摘要，指导报告将继续生成。"}</p>{!p.papers.length && <p className={s.text}>暂未检索到论文，可尝试更具体的技术关键词。</p>}{p.papers.map((paper) => <article key={paper.id} className={s.paper}><a className={s.link} href={paper.url} target="_blank" rel="noreferrer">{paper.title}<ExternalLink size={12} className={s.icon} /></a><p className={s.meta}>{paper.source} · {paper.year} · 相关度 {paper.relevanceScore}</p><details><summary className={s.link}>阅读摘要</summary><p className={s.text}><VerificationText text={paper.abstract} /></p></details></article>)}</section>}
      </div>
      <div className={s.column}>
        {r && (r.summary || r.title) && <section className={s.panel}><h4 className={s.heading}><VerificationText text={r.title || "比赛要求解读"} /></h4>{r.theme && <p className={s.text}>主题：<VerificationText text={r.theme} /></p>}<p className={s.text}><VerificationText text={r.summary} /></p></section>}
        {r && <><TextList title="任务目标" items={r.taskGoals} /><TextList title="提交物" items={r.deliverables} /><TextList title="评分标准" items={r.scoringCriteria} /><TextList title="技术方向" items={r.technologyDirections} />{!!r.timeline.length && <section className={s.panel}><h4 className={s.heading}>时间节点</h4>{r.timeline.map((item, index) => <p className={s.text} key={index}><VerificationText text={item.milestone} /> · <VerificationText text={item.date} />：<VerificationText text={item.description} /></p>)}</section>}</>}
        {report?.overview && <section className={s.panel}><h4 className={s.heading}>指导摘要</h4><p className={s.text}><VerificationText text={report.overview} /></p></section>}
        {!!report?.topicDirections.length && <section className={s.panel}><h4 className={s.heading}>推荐选题方向</h4>{report.topicDirections.map((topic, index) => <article key={index} className={s.item}><h5 className={s.itemTitle}><VerificationText text={topic.title} /></h5><p className={s.text}><VerificationText text={topic.reason} /></p><p className={s.text}>预期产出：<VerificationText text={topic.expectedOutput} /></p></article>)}</section>}
        {report && <><TextList title="技术路线" items={report.technicalRoute} />{!!report.scoringSuggestions.length && <section className={s.panel}><h4 className={s.heading}>评分点对应建议</h4>{report.scoringSuggestions.map((item, index) => <p className={s.text} key={index}><strong><VerificationText text={item.criterion} />：</strong><VerificationText text={item.action} /></p>)}</section>}<TextList title="创新点建议" items={report.innovationPoints} />{!!report.plan.length && <section className={s.panel}><h4 className={s.heading}>备赛计划</h4>{report.plan.map((phase, index) => <article className={s.item} key={index}><h5 className={s.itemTitle}><VerificationText text={phase.phase} />（<VerificationText text={phase.days} />）</h5><ul className={s.list}>{phase.tasks.map((task, index) => <li key={index}><VerificationText text={task} /></li>)}</ul></article>)}</section>}<TextList title="风险与注意事项" items={report.risks} /><TextList title="参考文献" items={report.references} /></>}
        {!r && busy && <p className={s.ready}>文件和关键词会先出现在左侧。比赛要求、选题与技术路线将在生成后陆续显示在这里。</p>}
      </div>
    </div>
  </section>;
}
