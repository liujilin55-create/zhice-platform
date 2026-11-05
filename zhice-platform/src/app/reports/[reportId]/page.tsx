import { Suspense } from "react";
import { EvidenceReportPage } from "@/modules/evidence-center";

async function ReportContent({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  return <EvidenceReportPage key={reportId} reportId={reportId} />;
}

export default function Page({ params }: { params: Promise<{ reportId: string }> }) {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950 p-8 text-slate-300">正在加载报告…</div>}><ReportContent params={params} /></Suspense>;
}
