import { z } from "zod";
import { verificationStatusSchema } from "@/shared/contracts/competition-binding";
import type { StudentProfile } from "@/modules/workspace/types";

declare const competitionIdBrand: unique symbol;
export type CompetitionId = string & { readonly [competitionIdBrand]: "CompetitionId" };
export const toCompetitionId = (value: string) => value as CompetitionId;

export const competitionLevelSchema = z.enum(["校级", "省级", "国家级", "国际级", "待核验"]);
export const timePreferenceSchema = z.enum(["周末集中", "线上灵活", "寒暑假", "不限"]);
export const gradeSchema = z.enum(["大一", "大二", "大三", "大四", "研究生", "不限"]);

export const competitionSchema = z.object({
  id: z.string().min(1).transform(toCompetitionId),
  name: z.string().min(1),
  introduction: z.string().min(1),
  majorTags: z.array(z.string()),
  level: competitionLevelSchema,
  signupPeriod: z.string().min(1),
  competitionPeriod: z.string().min(1),
  timeMode: timePreferenceSchema,
  officialSite: z.string().url().nullable(),
  organizer: z.string().min(1),
  scoringDimensions: z.array(z.string()),
  keywords: z.array(z.string()),
  suitableGrades: z.array(gradeSchema),
  competitionId: z.string(), externalLevel: z.string(), campusRecognitionLevel: z.string().nullable(), recognitionYear: z.number().nullable(),
  tracks: z.array(z.object({ trackId: z.string(), name: z.string(), verificationStatus: verificationStatusSchema })),
  registrationAudience: z.string(), gradeRestrictions: z.array(z.string()), majorRestrictions: z.array(z.string()),
  teamSize: z.object({ min: z.number().int().positive().nullable(), max: z.number().int().positive().nullable() }),
  signupStart: z.string().nullable(), signupDeadline: z.string().nullable(), competitionTime: z.string().nullable(),
  registrationStatus: z.enum(["unknown", "open", "upcoming", "closed"]), submissionMaterials: z.array(z.string()),
  officialSourceUrl: z.string().url().nullable(), campusSourceUrl: z.string().url().nullable(),
  lastVerified: z.string().nullable(), verificationStatus: verificationStatusSchema,
  dataMode: z.enum(["demo", "curated"]),
  campusCatalog: z.object({ recordId: z.string(), editionId: z.string(), version: z.number(), academicYear: z.string(), colleges: z.array(z.string()), majors: z.array(z.string()), grades: z.array(z.string()), tracks: z.array(z.string()), campusRegistration: z.string().nullable(), campusDeadline: z.string().nullable(), sourceFile: z.string().nullable(), sourcePage: z.number().nullable(), status: z.enum(["pending", "verified", "expired", "conflict"]), recognitionVerified: z.boolean(), officialLinkVerified: z.boolean() }).optional(),
  fit: z.object({ skills: z.array(z.string()), team: z.array(z.string()), mentor: z.array(z.string()), resources: z.array(z.string()), weeklyHours: z.number().nullable(), budget: z.number().nullable(), goals: z.array(z.string()) }),
});

export type Competition = z.infer<typeof competitionSchema>;
export type CompetitionLevel = z.infer<typeof competitionLevelSchema>;
export type TimePreference = z.infer<typeof timePreferenceSchema>;
export type Grade = z.infer<typeof gradeSchema>;

export type RecommendationInput = {
  major: string;
  grade: Grade;
  interests: string[];
  levelPreference: CompetitionLevel | "不限";
  timePreference: TimePreference;
  profile?: StudentProfile;
  now?: string;
  includeExpired?: boolean;
};

export type MatchReason = { label: string; detail: string };
export type CompetitionMatch = Competition & {
  matchScore: number;
  relevance: "高" | "中" | "低";
  reasons: MatchReason[];
  category: "高匹配" | "提升型" | "挑战型" | "资料待完善";
  eligibilityWarnings: string[];
};
