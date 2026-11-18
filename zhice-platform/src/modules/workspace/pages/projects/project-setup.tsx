"use client";
import { cloneElement, useId, useState, type ReactElement } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { useWorkspaceStore } from "../../workspace.store";
import { emptyStudentProfile, projectStageLabels, studentProfileSchema, type StudentProfile } from "../../types";

const s = {
  panel: "min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6",
  label: "mb-2 block text-sm font-medium text-slate-700",
  field: "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100",
  grid: "grid gap-5 sm:grid-cols-2",
  primary: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-700",
  secondary: "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700",
};

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactElement<{ id?: string; "aria-required"?: boolean }> }) {
  const id = useId();
  return <div><label htmlFor={id} className={s.label}>{label}{required && <span aria-hidden="true" className="ml-1 text-xs font-normal text-slate-400">必填</span>}</label>{cloneElement(children, { id, "aria-required": required || undefined })}</div>;
}

export function ProjectSetup({ editing = false, embedded = false, onDone, onCancel }: { editing?: boolean; embedded?: boolean; onDone: () => void; onCancel?: () => void }) {
  const saved = useWorkspaceStore((state) => state.studentProfile);
  const project = useWorkspaceStore((state) => state.project);
  const [profile, setProfile] = useState<StudentProfile>(() => structuredClone(editing && project ? project.studentProfile : saved || emptyStudentProfile()));
  const [name, setName] = useState(() => editing ? project?.name || "" : "");
  const [skills, setSkills] = useState(profile.skills.join("、"));
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [error, setError] = useState("");
  const change = <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => setProfile((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!name.trim()) { setError("请填写项目名称，也可以先用一个暂定名称。"); return; }
    if (name.trim().length > 120) { setError("项目名称请控制在 120 字以内。"); return; }
    const parsed = studentProfileSchema.safeParse({ ...profile, skills: skills.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean) });
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      const messages: Record<string, string> = {
        school: "请填写学校，最多 120 字。", college: "请填写学院，最多 120 字。", major: "请填写专业，最多 120 字。",
        competitionGoal: "请填写参赛目标，最多 600 字。", grade: "请选择年级。",
        weeklyHours: "每周计划投入时间应为 1–168 小时。", budget: "预算应为 0–1000 万元。",
        teamSize: "团队人数请填写 1–100 的整数，暂不清楚可以留空。", skills: "最多填写 30 项技能，每项不超过 100 字。",
      };
      if (!["school", "college", "major", "competitionGoal", "grade"].includes(String(field))) setAdditionalOpen(true);
      setError(messages[String(field)] || "请检查选填信息是否超过字数限制。");
      return;
    }
    const store = useWorkspaceStore.getState();
    if (editing) {
      store.saveProfile(parsed.data);
      store.renameProject(name);
    } else {
      store.newProject(name, parsed.data);
      const activity = store.beginActivity({ kind: "project", title: "备赛项目已创建", detail: name.trim(), href: "/?view=competitions" });
      store.finishActivity(activity, { status: "success" });
    }
    setError("");
    onDone();
  };

  return <section className={embedded ? "min-w-0 text-slate-900" : s.panel} aria-label={editing ? "修改项目基本信息" : "填写基本信息并创建项目"}>
    {!embedded && <header className="mb-6"><p className="text-xs font-semibold tracking-widest text-emerald-700">第一步 · 画像与选赛</p><h2 className="mt-2 text-xl font-bold">{editing ? "编辑项目基本信息" : "先填写基本信息"}</h2><p className="mt-2 text-sm leading-7 text-slate-500">保存后选择比赛与赛道。团队、技能和资源可以稍后补充。</p></header>}
    <form noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className={s.grid}>
        <div className="sm:col-span-2"><Field label="项目名称" required><input className={s.field} value={name} onChange={(event) => setName(event.target.value)} placeholder="填写项目名称，后续可以修改" required maxLength={120} /></Field></div>
        <Field label="学校" required><input className={s.field} value={profile.school} onChange={(event) => change("school", event.target.value)} required maxLength={120} /></Field>
        <Field label="学院" required><input className={s.field} value={profile.college} onChange={(event) => change("college", event.target.value)} placeholder="例如：材料工程学院" required maxLength={120} /></Field>
        <Field label="专业" required><input className={s.field} value={profile.major} onChange={(event) => change("major", event.target.value)} placeholder="例如：木材科学与工程" required maxLength={120} /></Field>
        <Field label="年级" required><select className={s.field} value={profile.grade} onChange={(event) => change("grade", event.target.value as StudentProfile["grade"])}>{studentProfileSchema.shape.grade.options.map((grade) => <option key={grade}>{grade}</option>)}</select></Field>
        <div className="sm:col-span-2"><Field label="参赛目标" required><textarea className={s.field} rows={2} value={profile.competitionGoal} onChange={(event) => change("competitionGoal", event.target.value)} placeholder="例如：完成项目原型、积累参赛经验或争取奖项" required maxLength={600} /></Field></div>
      </div>

      <details className="group mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4" open={additionalOpen} onToggle={(event) => setAdditionalOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden"><span>团队、技能与资源 <span className="font-normal text-slate-400">选填，可稍后补充</span></span><ChevronDown size={17} className="shrink-0 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-5 space-y-6">
          <div className={s.grid}>
            <div className="sm:col-span-2"><Field label="已有技能"><input className={s.field} value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="用顿号或逗号分隔，如：材料实验、调研、设计" maxLength={1200} /></Field></div>
            <Field label="团队情况"><select className={s.field} value={profile.hasTeam ? "yes" : "no"} onChange={(event) => change("hasTeam", event.target.value === "yes")}><option value="no">暂未组队</option><option value="yes">已有团队</option></select></Field>
            {profile.hasTeam && <Field label="团队人数（含自己）"><input className={s.field} type="number" min={1} max={100} value={profile.teamSize ?? ""} onChange={(event) => change("teamSize", event.target.value ? Number(event.target.value) : null)} placeholder="暂不清楚可留空" /></Field>}
            <div className="sm:col-span-2"><Field label="团队分工或待补能力"><textarea className={s.field} rows={2} value={profile.teamCapabilities} onChange={(event) => change("teamCapabilities", event.target.value)} placeholder="填写已有分工或希望补充的能力" maxLength={1200} /></Field></div>
            <div className="sm:col-span-2"><Field label="可用导师"><input className={s.field} value={profile.mentors} onChange={(event) => change("mentors", event.target.value)} placeholder="填写导师方向或可提供的指导，没有可留空" maxLength={600} /></Field></div>
            {([ ["equipment", "可用设备"], ["labs", "实验室"], ["bases", "实践基地"], ["enterprises", "企业资源"], ["ruralResearch", "乡村调研资源"] ] as const).map(([key, label]) => <Field key={key} label={label}><input className={s.field} value={profile.resources[key]} onChange={(event) => change("resources", { ...profile.resources, [key]: event.target.value })} placeholder="填写已具备或可以联系的资源，没有可留空" maxLength={600} /></Field>)}
          </div>
          <div className="border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-700">投入计划</h3><p className="mt-2 text-xs leading-6 text-slate-500">以下为可调整的规划参数；保留当前设置也可以继续。</p><div className={s.grid + " mt-4"}>
            <Field label="计划每周投入（小时）"><input className={s.field} type="number" min={1} max={168} value={profile.weeklyHours} onChange={(event) => change("weeklyHours", Number(event.target.value))} /></Field>
            <Field label="计划预算（元）"><input className={s.field} type="number" min={0} max={10000000} step="0.01" value={profile.budget} onChange={(event) => change("budget", Number(event.target.value))} /></Field>
            <div className="sm:col-span-2"><Field label="目前准备情况"><select className={s.field} value={profile.currentProjectStatus} onChange={(event) => change("currentProjectStatus", event.target.value as StudentProfile["currentProjectStatus"])}>{Object.entries(projectStageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field></div>
          </div></div>
        </div>
      </details>
      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><div>{onCancel && <button type="button" className={s.secondary} onClick={onCancel}>取消</button>}</div><button type="submit" className={s.primary}>{editing ? "保存基本信息" : "保存并选择比赛"}<ArrowRight size={15} /></button></div>
    </form>
  </section>;
}
