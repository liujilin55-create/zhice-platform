"use client";
import { cloneElement, useId, useState, type ReactElement } from "react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Users, Wallet } from "lucide-react";
import { useWorkspaceStore } from "../../workspace.store";
import { emptyStudentProfile, projectStageLabels, studentProfileSchema, type StudentProfile } from "../../types";
import { workspaceStyles as s } from "./projects.styles";

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return <div><label htmlFor={id} className={s.label}>{label}</label>{cloneElement(children, { id })}</div>;
}
export function ProjectSetup({ editing = false, onDone, onCancel }: { editing?: boolean; onDone: () => void; onCancel?: () => void }) {
  const saved = useWorkspaceStore((state) => state.studentProfile);
  const [profile, setProfile] = useState<StudentProfile>(() => saved ? structuredClone(saved) : emptyStudentProfile());
  const [name, setName] = useState("");
  const [skills, setSkills] = useState(profile.skills.join("、"));
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const change = <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const next = () => {
    if (step === 0 && (!profile.school.trim() || !profile.college.trim() || !profile.major.trim() || !profile.competitionGoal.trim())) { setError("请先填写学校、学院、专业和参赛目标。"); return; }
    setError(""); setStep((value) => value + 1);
  };
  const submit = () => {
    const parsed = studentProfileSchema.safeParse({ ...profile, skills: skills.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean) });
    if (!parsed.success) { setError("请检查填写内容：每周投入 1–168 小时，预算至少为 0，必填信息不能为空。"); return; }
    if (!editing && !name.trim()) { setError("请为备赛项目起一个名字。"); return; }
    const store = useWorkspaceStore.getState();
    if (editing) store.saveProfile(parsed.data); else {
      store.newProject(name, parsed.data);
      const activity = store.beginActivity({ kind: "project", title: "备赛项目已创建", detail: name.trim(), href: "/?view=projects" });
      store.finishActivity(activity, { status: "success" });
    }
    onDone();
  };
  return <section className={s.panel} aria-label={editing ? "修改学生画像" : "建立画像并创建备赛项目"}>
    <p className={s.eyebrow}>YOUR COMPETITION STARTS HERE</p><h2 className={s.heading}>{editing ? "更新我的参赛画像" : "先认识你，再开启备赛。"}</h2>
    <p className={s.hint}>填写你的方向、能力和资源，建立属于这个项目的备赛起点。学校可自由修改；没有的资源可以留空。</p>
    <ol className="mt-6 flex gap-2" aria-label="画像填写步骤">{["学习与目标", "能力与资源", editing ? "投入与状态" : "创建备赛项目"].map((title, index) => <li key={title} className={s.step + " " + (index === step ? s.activeStep : s.idleStep)} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={14} /> : index + 1}</span><span>{title}</span></li>)}</ol>
    <form onSubmit={(event) => { event.preventDefault(); if (step < 2) next(); else submit(); }}>
      {step === 0 && <div className={s.formGrid}>
        <Field label="学校"><input className={s.field} value={profile.school} onChange={(event) => change("school", event.target.value)} required maxLength={120} /></Field>
        <Field label="学院"><input className={s.field} value={profile.college} onChange={(event) => change("college", event.target.value)} placeholder="例如：计算机与信息学院" required maxLength={120} /></Field>
        <Field label="专业"><input className={s.field} value={profile.major} onChange={(event) => change("major", event.target.value)} placeholder="例如：计算机科学与技术" required maxLength={120} /></Field>
        <Field label="年级"><select className={s.field} value={profile.grade} onChange={(event) => change("grade", event.target.value as StudentProfile["grade"])}>{studentProfileSchema.shape.grade.options.map((grade) => <option key={grade}>{grade}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="参赛目标"><textarea className={s.field} rows={3} value={profile.competitionGoal} onChange={(event) => change("competitionGoal", event.target.value)} placeholder="例如：完成可演示的 AI Web 作品，争取省级奖项并积累科研经验" required maxLength={600} /></Field></div>
      </div>}
      {step === 1 && <div className={s.formGrid}>
        <div className="sm:col-span-2"><Field label="已有技能（用顿号或逗号分隔）"><input className={s.field} value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="例如：Python、前端开发、数据分析、文案策划" maxLength={1200} /></Field></div>
        <Field label="是否已有团队"><select className={s.field} value={profile.hasTeam ? "yes" : "no"} onChange={(event) => change("hasTeam", event.target.value === "yes")}><option value="no">暂时没有，先独立准备</option><option value="yes">已有团队</option></select></Field>
        {profile.hasTeam && <Field label="团队总人数（含自己，可留空待确认）"><input className={s.field} type="number" min={1} max={100} value={profile.teamSize ?? ""} onChange={(event) => change("teamSize", event.target.value ? Number(event.target.value) : null)} /></Field>}
        <Field label="团队成员能力 / 计划补齐的能力"><textarea className={s.field} value={profile.teamCapabilities} onChange={(event) => change("teamCapabilities", event.target.value)} placeholder="例如：我负责前端；同学负责调研与答辩" maxLength={1200} /></Field>
        <div className="sm:col-span-2"><Field label="可用导师"><input className={s.field} value={profile.mentors} onChange={(event) => change("mentors", event.target.value)} placeholder="导师方向、可提供的指导；没有可留空" maxLength={600} /></Field></div>
        {([ ["equipment", "可用设备"], ["labs", "实验室"], ["bases", "实践基地"], ["enterprises", "企业资源"], ["ruralResearch", "乡村调研资源"] ] as const).map(([key, label]) => <Field key={key} label={label}><input className={s.field} value={profile.resources[key]} onChange={(event) => change("resources", { ...profile.resources, [key]: event.target.value })} placeholder="已具备或可以联系的资源，没有可留空" maxLength={600} /></Field>)}
      </div>}
      {step === 2 && <div className={s.formGrid}>
        <Field label="每周可投入时间（小时）"><input className={s.field} type="number" min={1} max={168} required value={profile.weeklyHours} onChange={(event) => change("weeklyHours", Number(event.target.value))} /></Field>
        <Field label="可接受预算（元）"><input className={s.field} type="number" min={0} max={10000000} step="0.01" required value={profile.budget} onChange={(event) => change("budget", Number(event.target.value))} /></Field>
        <div className="sm:col-span-2"><Field label="当前项目状态"><select className={s.field} value={profile.currentProjectStatus} onChange={(event) => change("currentProjectStatus", event.target.value as StudentProfile["currentProjectStatus"])}>{Object.entries(projectStageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
        {!editing && <div className="sm:col-span-2"><Field label="备赛项目名称"><input className={s.field} value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：适老出行助手 · 2026 备赛" required maxLength={120} /></Field></div>}
        <div className="rounded-xl border border-indigo-300/20 bg-indigo-400/5 p-4 text-xs leading-6 text-indigo-100 sm:col-span-2"><GraduationCap size={14} className="mr-2 inline" />{profile.school} · {profile.major} · {profile.grade}<br /><Users size={14} className="mr-2 inline" />{profile.hasTeam ? "团队备赛" : "独立备赛"}<span className="mx-3">·</span><Wallet size={14} className="mr-2 inline" />每周 {profile.weeklyHours} 小时 / 预算 {profile.budget} 元</div>
      </div>}
      {error && <p className={s.error} role="alert">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5"><div>{step > 0 ? <button type="button" className={s.secondary} onClick={() => { setStep((value) => value - 1); setError(""); }}><ArrowLeft size={14} />上一步</button> : onCancel && <button type="button" className={s.secondary} onClick={onCancel}>取消</button>}</div><button type="submit" className={s.primary}>{step < 2 ? "下一步" : editing ? "保存画像" : "创建项目，选择比赛"}<ArrowRight size={15} /></button></div>
    </form>
  </section>;
}
