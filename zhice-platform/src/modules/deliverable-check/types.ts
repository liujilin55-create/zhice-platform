export type DeliverableKind = "PPTX" | "PDF" | "DOCX" | "ZIP" | "IMAGE";

export type CheckStatus = "pass" | "warning" | "fail" | "pending";

export type CheckItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: CheckStatus;
  score: number;
  maxScore: number;
  evidence: string;
  suggestion: string;
  automated: boolean;
};

export type DeliverableRecord = {
  id: string;
  name: string;
  kind: DeliverableKind;
  size: string;
  checkedAt: string;
  score: number;
  status: "ready" | "warning" | "failed";
  itemCount: number;
};
