import { MissionControl } from "@/components/mission-control";
import { Suspense } from "react";

export default function Home() {
  return <Suspense fallback={<div className="min-h-screen bg-slate-950 p-8 text-slate-300">正在加载工作空间…</div>}><MissionControl /></Suspense>;
}
