"use client";

import { VerificationActions, VerificationText } from "@/modules/verification";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  Archive,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clipboard,
  Cloud,
  CloudOff,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  Lightbulb,
  LoaderCircle,
  MessageSquareQuote,
  Scale,
  Search,
  Tag,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { useEvidenceData } from "./hooks/use-evidence-data";
import { evidenceStyles as styles } from "./evidence-center.styles";
import { quoteRanges } from "./utils/quote-ranges";
import { searchEvidence } from "./search";
import { useEvidenceStore } from "./stores/evidence.store";
import type {
  EvidenceCacheState,
  EvidenceCitation,
  EvidenceKind,
  EvidenceKindFilter,
  EvidenceRecord,
  EvidenceStatus,
} from "./types";

const kindLabels: Record<EvidenceKindFilter, string> = {
  all: "全部证据",
  academicPaper: "学术论文",
  competitionRule: "比赛规则",
  caseStudy: "优秀案例 / 竞品",
};

const statusLabels: Record<EvidenceStatus, string> = {
  confirmed: "已确认",
  pending: "待验证",
  deprecated: "已废弃",
};

const cacheLabels: Record<EvidenceCacheState, string> = {
  live: "实时来源",
  cached: "已缓存",
  unavailable: "原来源不可用",
};

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function kindIcon(kind: EvidenceKind, className: string = styles.icon) {
  if (kind === "academicPaper") return <BookOpen className={className} />;
  if (kind === "competitionRule") return <Scale className={className} />;
  return <Trophy className={className} />;
}

function kindTone(kind: EvidenceKind) {
  if (kind === "academicPaper") return styles.kindPaper;
  if (kind === "competitionRule") return styles.kindRule;
  return styles.kindCase;
}

function statusTone(status: EvidenceStatus) {
  if (status === "confirmed") return styles.statusConfirmed;
  if (status === "pending") return styles.statusPending;
  return styles.statusDeprecated;
}

function statusIcon(status: EvidenceStatus) {
  if (status === "confirmed") return <CheckCircle2 className={styles.tinyIcon} />;
  if (status === "pending") return <AlertCircle className={styles.tinyIcon} />;
  return <Archive className={styles.tinyIcon} />;
}

function cacheIcon(state: EvidenceCacheState) {
  if (state === "live") return <Cloud className={styles.tinyIcon} />;
  if (state === "cached") return <Cloud className={styles.tinyIcon} />;
  return <CloudOff className={styles.tinyIcon} />;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function highlightQuotes(text: string, quotes: string[]): ReactNode {
  const ranges = quoteRanges(text, quotes);
  let offset = 0;
  const parts: ReactNode[] = ranges.map(({ start, end }) => {
    const before = text.slice(offset, start);
    offset = end;
    return <Fragment key={start}><VerificationText text={before} /><mark className={styles.quoteHighlight}><VerificationText text={text.slice(start, end)} /></mark></Fragment>;
  });
  return <>{parts}<VerificationText text={text.slice(offset)} /></>;
}

function citationLabel(citation: EvidenceCitation) {
  if (citation.targetType === "projectOverview") return "项目总览";
  if (citation.targetType === "task") return "任务编排";
  return "指导报告";
}

function EvidenceCard({ record, onOpen, offline }: { record: EvidenceRecord; onOpen: () => void; offline: boolean }) {
  return (
    <article onClick={(event) => { if (!(event.target as HTMLElement).closest("button,a")) onOpen(); }} className={styles.card}>
      <div className={styles.rowBetween}>
        <span className={cn(styles.cardKindBadge, kindTone(record.kind))}>
          {kindIcon(record.kind, styles.tinyIcon)}
          {kindLabels[record.kind]}
        </span>
        <span className={cn(styles.cardStatusBadge, statusTone(record.status))}>
          {statusIcon(record.status)}
          {record.status === "pending" ? <VerificationActions id={"evidence-" + record.id} subject={record.title + "：" + record.excerpt} source={record.sourceUrl || record.source} href={record.sourceUrl || "/?view=evidence&evidence=" + encodeURIComponent(record.id)} /> : statusLabels[record.status]}
        </span>
      </div>
      {record.sourceMode === "sample" && <span className={styles.sampleLabel}>示例资料 · 请替换为真实来源</span>}

      <button type="button" onClick={onOpen} className={styles.cardTitleButton}>
        <h3 className={styles.cardTitle}>{record.title}</h3>
        <div className={styles.cardMeta}>
          <span className={styles.truncate}>{record.source}</span>
          <span className={styles.separator} />
          <span className={styles.noShrink}>{formatDate(record.occurredAt)}</span>
        </div>
      </button>

      <p className={styles.cardExcerpt}><VerificationText text={record.excerpt} source={record.sourceUrl} href={record.sourceUrl} /></p>
      <p className={styles.relevance}>相关度 {Math.round(record.relevance * 100)}% · {record.citations.length} 条引用记录</p>

      <div className={styles.cardBottom}>
        <div className={styles.tags}>
          {record.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={styles.tag}>
              <Tag className={styles.tagIcon} />
              {tag}
            </span>
          ))}
        </div>
        <div className={styles.cardFooter}>
          <span className={cn(styles.cacheLabel, record.cacheState === "unavailable" ? styles.cacheUnavailable : styles.cacheAvailable)}>
            {cacheIcon(record.cacheState)}
            {offline ? "离线 · 使用缓存" : cacheLabels[record.cacheState]}
          </span>
          <button type="button" onClick={onOpen} className={styles.openButton}>
            查看溯源
            <ArrowUpRight className={styles.tinyIcon} />
          </button>
        </div>
      </div>
    </article>
  );
}

function EvidenceDrawer({
  record,
  onClose,
  onToast,
  onStatusChange,
  offline,
}: {
  record: EvidenceRecord;
  onClose: () => void;
  onToast: (message: string) => void;
  onStatusChange: (id: string, status: EvidenceStatus) => Promise<void>;
  offline: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyOverflow = document.body.style.overflow;
    const backgrounds = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(drawerRef.current));
    const inertStates = backgrounds.map((element) => element.inert);
    backgrounds.forEach((element) => { element.inert = true; });
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    return () => {
      document.body.style.overflow = bodyOverflow;
      backgrounds.forEach((element, index) => { element.inert = inertStates[index]; });
      previous?.focus();
    };
  }, []);
  const saveStatus = async (status: EvidenceStatus) => {
    setSaving(true);
    try {
      await onStatusChange(record.id, status);
      onToast("状态已保存为“" + statusLabels[status] + "”");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "状态保存失败，请重试");
    } finally { setSaving(false); }
  };

  const copyCitation = async () => {
    const text = "【" + record.title + "】\n来源：" + record.source + "\n位置：" + (record.pageRef ?? "未标注") + "\n" + (record.highlightedQuotes.join("\n") || record.excerpt) + "\n" + (record.sourceUrl ?? "");
    try {
      await navigator.clipboard.writeText(text);
      onToast("引用已复制到剪贴板");
    } catch {
      onToast("浏览器未授权剪贴板，请手动复制");
    }
  };

  return createPortal(
    <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" tabIndex={-1} aria-label="关闭证据详情" onClick={onClose} className={styles.backdrop} />
      <motion.aside
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="证据溯源详情"
        initial={{ x: reduceMotion ? 0 : "100%" }}
        animate={{ x: 0 }}
        exit={{ x: reduceMotion ? 0 : "100%" }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { onClose(); return; }
          if (event.key !== "Tab") return;
          const items = drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled), [tabindex="0"]');
          if (!items?.length) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === drawerRef.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || document.activeElement === drawerRef.current)) { event.preventDefault(); first.focus(); }
        }}
        className={styles.drawer}
      >
        <div className={styles.drawerHeader}>
          <div className={styles.minWidth}>
            <div className={styles.badges}>
              <span className={cn(styles.drawerKindBadge, record.kind === "academicPaper" ? styles.drawerPaperTone : record.kind === "competitionRule" ? styles.drawerRuleTone : styles.drawerCaseTone)}>
                {kindIcon(record.kind, styles.tinyIcon)}
                {kindLabels[record.kind]}
              </span>
              <span className={cn(styles.cardStatusBadge, record.status === "confirmed" ? styles.drawerCaseTone : record.status === "pending" ? styles.drawerPendingTone : styles.drawerDeprecatedTone)}>
                {statusIcon(record.status)}
                {record.status === "pending" ? <VerificationActions id={"evidence-" + record.id} subject={record.title + "：" + record.excerpt} source={record.sourceUrl || record.source} href={record.sourceUrl || "/?view=evidence&evidence=" + encodeURIComponent(record.id)} /> : statusLabels[record.status]}
              </span>
            </div>
            <h2 className={styles.drawerTitle}>{record.title}</h2>
            <p className={styles.drawerMeta}>{record.source} · {formatDate(record.occurredAt)}{record.pageRef ? " · " + record.pageRef : ""}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭抽屉" className={styles.closeButton}>
            <X className={styles.closeIcon} />
          </button>
        </div>

        <div className={styles.drawerBody}>
          <div className={styles.badges}>
            <span className={styles.cacheBadge}>
              {cacheIcon(record.cacheState)}
              {offline ? "离线 · 使用缓存" : cacheLabels[record.cacheState]} · 缓存于 {formatDate(record.cachedAt)}
            </span>
            {record.sourceUrl && record.sourceUrl.startsWith("http") && (
              <a href={record.sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceButton}>
                打开来源
                <ExternalLink className={styles.tinyIcon} />
              </a>
            )}
            <button type="button" onClick={() => void copyCitation()} className={styles.copyButton}>
              <Clipboard className={styles.tinyIcon} />
              复制引用
            </button>
            <button type="button" onClick={() => document.getElementById("evidence-citations")?.scrollIntoView({ block: "start", behavior: reduceMotion ? "instant" : "smooth" })} className={styles.sourceButton}>
              <ArrowUpRight className={styles.tinyIcon} />引用记录 {record.citations.length}
            </button>
          </div>

          <section className={styles.detailSection}>
            <div className={styles.detailHeading}>
              <FileText className={styles.headingIcon} />
              证据说明
            </div>
            {record.sourceMode === "sample" && <p className={styles.sampleNotice}>示例资料，用于演示交互。请上传正式比赛文件后核对。</p>}
            {record.status === "deprecated" && <p className={styles.deprecatedNotice}>该证据已废弃，历史引用保留以便复核，请勿继续用于新结论。</p>}
            <p className={styles.originalText}>{highlightQuotes(record.body, record.highlightedQuotes)}</p>
          </section>

          {record.academic && (
            <section className={styles.sourcePanel}>
              <div className={styles.detailHeading}>
                <BookOpen className={styles.paperIcon} />
                论文元数据与摘要原文
              </div>
              <div className={styles.metadataGrid}>
                <div><span className={styles.mutedText}>作者：</span>{record.academic.authors.join("、")}</div>
                <div><span className={styles.mutedText}>年份：</span>{record.academic.year} · {record.academic.venue}</div>
                {record.academic.doi && <div className={styles.metadataWide}><span className={styles.mutedText}>DOI：</span>{record.academic.doi}</div>}
              </div>
              <p className={styles.abstractText}>{highlightQuotes(record.academic.abstract, record.highlightedQuotes)}</p>
              <div className={styles.quoteSection}>
                <div className={styles.quoteHeading}>
                  <MessageSquareQuote className={styles.icon} />
                  AI 提取 / 引用原句
                </div>
                <div className={styles.quoteList}>
                  {record.highlightedQuotes.filter((quote) => record.academic?.abstract.includes(quote)).map((quote) => <blockquote key={quote} className={styles.quoteBlock}>“{quote}”</blockquote>)}
                  {!record.highlightedQuotes.length && <p className={styles.emptyQuotes}>尚未记录可核验的引用原句。</p>}
                </div>
              </div>
            </section>
          )}

          {record.ruleItems && (
            <section className={styles.detailSection}>
              <div className={styles.detailHeading}>
                <Scale className={styles.ruleIcon} />
                解析出的评分相关条款
              </div>
              <div className={styles.ruleList}>
                {record.ruleItems.map((item) => (
                  <div key={item.label} className={styles.ruleItem}>
                    <div className={styles.rowBetween}>
                      <span className={styles.ruleTitle}>{item.label}</span>
                      <span className={styles.rulePage}>{item.page}{item.scoreWeight ? " · " + item.scoreWeight : ""}</span>
                    </div>
                    <p className={styles.ruleText}>{highlightQuotes(item.text, record.highlightedQuotes)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!record.academic && !record.ruleItems && (
            <section className={styles.sourcePanel}>
              <div className={styles.detailHeading}>
                <Trophy className={styles.caseIcon} />
                案例观察片段
              </div>
              <p className={styles.caseText}>{highlightQuotes(record.excerpt, record.highlightedQuotes)}</p>
              <div className={styles.ruleList}>{record.highlightedQuotes.map((quote) => <blockquote key={quote} className={styles.caseQuote}>“{quote}”</blockquote>)}</div>
            </section>
          )}

          <section className={styles.statusSection}>
            <label htmlFor="evidence-status" className={styles.statusLabel}>核验状态</label>
            <select id="evidence-status" aria-label="证据核验状态" value={record.status} disabled={saving || offline} onChange={(event) => void saveStatus(event.target.value as EvidenceStatus)} className={styles.statusSelect}>
              <option value="confirmed">已确认</option><option value="pending">待验证</option><option value="deprecated">已废弃</option>
            </select>
            {saving && <LoaderCircle className={styles.savingIcon} />}
          </section>

          <section id="evidence-citations" className={styles.citationsSection}>
            <div className={styles.citationsHeadingRow}>
              <div className={styles.citationsIcon}><ArrowUpRight className={styles.icon} /></div>
              <div>
                <h3 className={styles.citationsHeading}>引用反向追踪</h3>
                <p className={styles.citationsHelp}>这条证据已被哪些生成内容使用</p>
              </div>
            </div>
            <div className={styles.citationsList}>
              {record.citations.length ? record.citations.map((citation) => (
                <div key={citation.id} className={styles.citationLink}>
                  <div className={styles.rowBetween}>
                    <div className={styles.minWidth}>
                      <div className={styles.citationTitle}>
                        <Link href={citation.href}>{citation.targetTitle} ↗</Link>
                        <span className={styles.citationStatus}>{citation.verification === "pending" ? <VerificationActions id={"citation-" + citation.id} subject={citation.targetTitle + "：" + citation.excerpt} source={record.sourceUrl || record.source} href={record.sourceUrl || citation.href} /> : "已核验引用"}</span>
                        <span className={styles.citationType}>{citationLabel(citation)}</span>
                      </div>
                      <div className={styles.citationsHelp}>{citation.section}</div>
                    </div>
                    <ArrowUpRight className={styles.citationArrow} />
                  </div>
                  <p className={styles.citationExcerpt}>“<VerificationText text={citation.excerpt} source={record.sourceUrl} href={record.sourceUrl} />”</p>
                </div>
              )) : <div className={styles.emptyCitations}>暂未发现引用记录，确认后可作为新的证据节点。</div>}
            </div>
          </section>
        </div>
      </motion.aside>
    </motion.div>, document.body
  );
}

export function EvidenceCenter() {
  const { records, loading, error, offline, savedAt, refresh, changeStatus } = useEvidenceData();
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const params = useSearchParams();
  const query = useEvidenceStore((state) => state.query);
  const kind = useEvidenceStore((state) => state.kind);
  const setQuery = useEvidenceStore((state) => state.setQuery);
  const setKind = useEvidenceStore((state) => state.setKind);
  const openEvidence = useEvidenceStore((state) => state.openEvidence);
  const closeDrawer = useEvidenceStore((state) => state.closeDrawer);
  const drawerOpen = useEvidenceStore((state) => state.drawerOpen);
  const selectedEvidenceId = useEvidenceStore((state) => state.selectedEvidenceId);
  const linkedEvidenceId = params.get("evidence");
  const filteredRecords = useMemo(() => searchEvidence(records, query, kind), [records, query, kind]);
  const selectedRecord = records.find((record) => record.id === selectedEvidenceId) ?? null;
  useEffect(() => {
    if (linkedEvidenceId) openEvidence(linkedEvidenceId);
    else closeDrawer();
  }, [linkedEvidenceId, openEvidence, closeDrawer]);
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);
  const closeDetails = () => {
    closeDrawer();
    if (linkedEvidenceId) {
      const next = new URLSearchParams(params.toString());
      next.delete("evidence");
      window.history.replaceState(null, "", "/?" + next.toString());
    }
  };
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  const handleOpen = (record: EvidenceRecord) => {
    openEvidence(record.id);
    const next = new URLSearchParams(params.toString());
    next.set("view", "evidence");
    next.set("evidence", record.id);
    window.history.replaceState(null, "", "/?" + next.toString());
  };

  const confirmedCount = records.filter((record) => record.status === "confirmed").length;
  const citationCount = records.reduce((total, record) => total + record.citations.length, 0);
  const visibleKinds: EvidenceKindFilter[] = ["all", "academicPaper", "competitionRule", "caseStudy"];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGlowSecondary} />
        <div className={styles.heroContent}>
          <div>
            <div className={styles.heroEyebrow}>
              <span className={styles.heroBadge}><FolderOpen className={styles.tinyIcon} />可溯源知识库</span>
              <span className={styles.heroLabel}>Evidence Hub</span>
            </div>
            <h2 className={styles.heroTitle}>证据中心<span className={styles.heroAccent}>，每条结论都有出处。</span></h2>
            <p className={styles.heroDescription}>把论文、赛事条款和案例放进同一条可追溯链路。AI 的每一个建议，都能回到原文、页码和它被使用的地方。</p>
          </div>
          <div className={styles.metrics}>
            <div className={styles.metric}><div className={styles.metricLabel}>证据总数</div><div className={styles.metricValue}>{records.length}</div><div className={styles.metricPrimary}>来源可核验</div></div>
            <div className={styles.metric}><div className={styles.metricLabel}>已确认</div><div className={styles.metricValue}>{confirmedCount}</div><div className={styles.metricConfirmed}>可直接引用</div></div>
            <div className={styles.metric}><div className={styles.metricLabel}>引用关系</div><div className={styles.metricValue}>{citationCount}</div><div className={styles.metricCitations}>双向可跳转</div></div>
          </div>
        </div>
      </section>

      <section className={styles.searchPanel}>
        <div className={styles.searchRow}>
          <label className={styles.searchLabel}>
            <Search className={styles.searchIcon} />
            <input aria-label="搜索证据" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="语义搜索，例如：如何提升技术实现得分？" className={styles.searchInput} />
          </label>
          <button type="button" disabled={loading} onClick={() => void refresh()} className={styles.refreshButton}>{loading && <LoaderCircle className={styles.spinner} />}刷新证据</button>
          <Link href="/?view=requirements" className={styles.uploadButton}><Upload className={styles.icon} />上传比赛要求</Link>
        </div>
        <div className={styles.filters}>
          <Filter className={styles.filterIcon} />
          {visibleKinds.map((value) => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)} className={cn(styles.filterButton, kind === value ? styles.filterSelected : styles.filterIdle)}>{kindLabels[value]}</button>)}
        </div>
      </section>

      {(offline || error) && <div role="status" className={styles.offlineBanner}><span>{offline ? "连接不可用，正在使用本地缓存。" : error} {savedAt ? "缓存时间：" + new Date(savedAt).toLocaleString("zh-CN") : "暂无本地缓存，请恢复连接后重试。"}</span><button type="button" disabled={loading} onClick={() => void refresh()} className={styles.reconnectButton}>重新连接</button></div>}
      {loading && records.length === 0 && <div role="status" className={styles.skeletonGrid}>{[1, 2, 3].map((id) => <div key={id} className={styles.skeleton} />)}<span className={styles.visuallyHidden}>正在加载证据</span></div>}
      {!loading && linkedEvidenceId && !selectedRecord && <p role="alert" className={styles.missingEvidence}>该证据不存在，或尚未缓存。请刷新后重试。</p>}
      <section>
        <div className={styles.resultsHeader}>
          <div>
            <div className={styles.sectionTitle}><FileCheck2 className={styles.sectionIcon} />证据卡片</div>
            <p className={styles.drawerMeta}>{query.trim() ? "同义词扩展 + 关键词相关度 · " : "按相关度和确认状态排序 · "}{filteredRecords.length} 条结果</p>
          </div>
          {query.trim() && <span className={styles.searchBadge}>正在检索：{query}</span>}
        </div>
        {filteredRecords.length ? <div className={styles.grid}>{filteredRecords.map((record) => <EvidenceCard key={record.id} record={record} offline={offline} onOpen={() => handleOpen(record)} />)}</div> : loading ? null : <div aria-live="polite" className={styles.emptyResults}><Search className={styles.emptyIcon} /><h3 className={styles.emptyTitle}>没有找到匹配证据</h3><p className={styles.drawerMeta}>试试“RAG”“评分标准”或“如何提升技术实现得分”。</p><button type="button" onClick={() => { setQuery(""); setKind("all"); }} className={styles.clearButton}>清除筛选</button></div>}
      </section>

      <section className={styles.helpPanel}>
        <div className={styles.helpRow}>
          <div className={styles.helpIcon}><Lightbulb className={styles.icon} /></div>
          <div><div className={styles.helpTitle}>如何使用证据中心</div><p className={styles.helpText}>分析比赛要求后，原文、论文与指导报告会自动保存。在指导报告中点击【证据】查看原文，再从抽屉底部的引用记录跳回对应段落。黄色状态表示检索关联仍需人工确认，可直接打开来源并记录核验依据。</p></div>
        </div>
      </section>

      <AnimatePresence>{drawerOpen && selectedRecord && <EvidenceDrawer key={selectedRecord.id} record={selectedRecord} onClose={closeDetails} onToast={showToast} onStatusChange={changeStatus} offline={offline} />}</AnimatePresence>
      <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 12, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 8 }} className={styles.toast}><Check className={styles.toastIcon} />{toast}</motion.div>}</AnimatePresence>
    </div>
  );
}
