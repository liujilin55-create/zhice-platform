import { directoryInputSchema, type DirectoryInput } from "./types";

const aliases: Record<string, string> = { "比赛名称": "name", "学年度": "academicYear", "外部赛事级别": "externalLevel", "校内认定等级": "campusRecognitionLevel", "适用学院": "colleges", "适用专业": "majors", "适用年级": "grades", "参赛赛道": "tracks", "校内报名方式": "campusRegistration", "校内截止时间": "campusDeadline", "官方比赛链接": "officialUrl", "校内通知链接": "campusUrl", "来源文件名": "sourceFile", "来源页码": "sourcePage", "来源原文": "sourceText", "主管部门": "supervisingDepartment", "主要所属部门": "affiliatedDepartment", "备注": "frequencyNote", "项目主办单位": "organizer" };
const arrays = new Set(["colleges", "majors", "grades", "tracks", "keywords", "skills", "resources", "mentors", "goals", "submissionMaterials"]);
const numbers = new Set(["sourcePage", "teamMin", "teamMax", "weeklyHours", "budget"]);
// RFC4180: quoted commas, escaped quotes, BOM and embedded newlines are supported.
export function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); if (row.some((v) => v.trim())) rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (quoted) throw new Error("CSV 引号未闭合");
  row.push(cell); if (row.some((v) => v.trim())) rows.push(row);
  const headers = rows.shift()?.map((s) => s.replace(/^\uFEFF/, "").trim()) || [];
  if (new Set(headers).size !== headers.length) throw new Error("CSV 存在重复列名");
  return rows.map((cells, index) => { if (cells.length !== headers.length) throw new Error(`CSV 第 ${index + 2} 行列数不一致`); return Object.fromEntries(headers.map((h, i) => [h, cells[i]])); });
}
export function parseDirectory(content: string, format: "json" | "csv"): DirectoryInput[] {
  if (content.length > 2_000_000) throw new Error("目录文件最多 2 MB");
  const raw: unknown = format === "json" ? JSON.parse(content.replace(/^\uFEFF/, "")) : parseCsv(content);
  if (!Array.isArray(raw) || !raw.length || raw.length > 1000) throw new Error("目录必须是 1–1000 条记录的数组");
  return raw.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`第 ${index + 1} 条记录格式错误`);
    const normalized = Object.fromEntries(Object.entries(item).map(([key, raw]) => {
      const k = aliases[key] || key; let v = raw;
      if (typeof v === "string") { v = v.trim(); if (arrays.has(k)) v = v ? String(v).split(/[;；|]/).map((s: string) => s.trim()).filter(Boolean) : []; else if (numbers.has(k)) v = v === "" ? null : Number(v); else if (v === "" && k !== "sourceText") v = null; }
      return [k, v];
    }));
    const result = directoryInputSchema.safeParse(normalized);
    if (!result.success) throw new Error(`第 ${index + 1} 条：${result.error.issues.map((i) => i.path.join(".") + " " + i.message).join("；")}`);
    return result.data;
  });
}
