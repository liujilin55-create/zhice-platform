export type OverviewRiskTone = "high" | "medium" | "low";
export type OverviewRisk = { id: string; title: string; detail: string; tone: OverviewRiskTone; source: string; resolved: boolean };
export type OverviewMilestone = { id: string; title: string; date: string; detail: string; status: "done" | "active" | "upcoming" };
