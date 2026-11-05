import { competitionSchema, type Competition } from "@/modules/competition-recommendation/types";
import { latestReview, type DirectoryRecord } from "./types";

export function directoryToCompetition(record: DirectoryRecord): Competition {
  const d = record.data;
  const confirmed = record.verificationStatus === "verified";
  const status = record.verificationStatus === "expired" ? "pending" : record.verificationStatus;
  return competitionSchema.parse({
    id: record.id, competitionId: record.id, name: d.name, introduction: d.sourceText.slice(0, 400) || "学校目录登记记录，详细要求待补充官方通知。",
    majorTags: d.majors, level: ["校级", "省级", "国家级", "国际级"].includes(d.externalLevel || "") ? d.externalLevel : "待核验",
    externalLevel: d.externalLevel || "待核验", campusRecognitionLevel: d.campusRecognitionLevel, recognitionYear: /^\d{4}-\d{4}$/.test(d.academicYear) ? Number(d.academicYear.slice(0, 4)) : null,
    signupPeriod: d.campusDeadline ? "校内截止 " + d.campusDeadline.slice(0, 10) : "待核验", competitionPeriod: "待核验", timeMode: "不限", officialSite: d.officialUrl, organizer: d.organizer || "待核验", scoringDimensions: [], keywords: d.keywords,
    suitableGrades: [], tracks: (d.tracks.length ? d.tracks : ["赛道待核验"]).map((name, i) => ({ trackId: record.id + "-t" + i, name, verificationStatus: confirmed && d.tracks.length ? "verified" : "pending" })),
    registrationAudience: "以来源通知为准", gradeRestrictions: d.grades, majorRestrictions: d.majors,
    teamSize: { min: d.teamMin, max: d.teamMax }, signupStart: null, signupDeadline: d.campusDeadline, competitionTime: null, registrationStatus: d.campusDeadline && Date.parse(d.campusDeadline) < Date.now() ? "closed" : "unknown", submissionMaterials: d.submissionMaterials,
    officialSourceUrl: d.officialUrl, campusSourceUrl: d.campusUrl, lastVerified: record.lastVerified, verificationStatus: status, dataMode: "curated",
    fit: { skills: d.skills, team: d.majors, mentor: d.mentors, resources: d.resources, weeklyHours: d.weeklyHours, budget: d.budget, goals: d.goals },
    campusCatalog: { recordId: record.id, editionId: record.editionId, version: record.version, academicYear: d.academicYear, colleges: d.colleges, majors: d.majors, grades: d.grades, tracks: d.tracks, campusRegistration: d.campusRegistration, campusDeadline: d.campusDeadline, sourceFile: d.sourceFile, sourcePage: d.sourcePage, status: record.verificationStatus, recognitionVerified: latestReview(record.reviews, "recognition")?.status === "verified", officialLinkVerified: latestReview(record.reviews, "officialLink")?.status === "verified" },
  });
}
