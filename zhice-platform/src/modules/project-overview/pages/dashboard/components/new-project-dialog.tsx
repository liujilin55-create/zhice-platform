import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { dashboardStyles as s } from "../dashboard.styles";

export function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={s.dialog} aria-labelledby="new-project-title" onCancel={onClose}><form onSubmit={(event) => { event.preventDefault(); if (name.trim()) onCreate(name.trim()); }}><p className={s.eyebrow}>A FRESH START</p><h3 id="new-project-title" className={s.heading}>开始一段新的备赛</h3><p className={s.subtitle}>为新的比赛建立工作空间。历史报告、证据和操作记录仍可查看。</p><label htmlFor="new-project-name" className={s.dialogLabel}>比赛或项目名称</label><input ref={(node) => { node?.focus(); }} id="new-project-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required placeholder="例如：传智杯 · 校园智能助手" className={s.dialogInput} /><div className={s.dialogButtons}><button type="button" onClick={onClose} className={s.secondary}>取消</button><button type="submit" className={s.primary} disabled={!name.trim()}>开始备赛<ArrowRight size={14} /></button></div></form></dialog>;
}
