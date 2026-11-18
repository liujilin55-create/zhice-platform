"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LightspeedBackground } from "./lightspeed-background";

type DesignWorldHeroProps = {
  fullScreen?: boolean;
  destination?: string;
};

export function DesignWorldHero({ fullScreen = false, destination = "/?view=competitions" }: DesignWorldHeroProps) {
  const router = useRouter();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "zhice-world-action" && event.data.action === "enter-workspace") {
        router.push(destination);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [destination, router]);

  if (fullScreen) {
    return (
      <main className="fixed inset-0 z-50 isolate min-h-svh overflow-hidden bg-black" aria-label="知策台全屏入口">
        <LightspeedBackground />
        <iframe title="知策台全屏入口" src="/design-world.html?embed=1&landing=1&external-background=1" className="relative z-10 block h-svh min-h-[520px] w-full border-0" />
        <div className="pointer-events-none absolute left-7 top-7 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs text-slate-200 backdrop-blur-md sm:left-10 sm:top-10">
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
          当前项目 · 备赛首页
        </div>
      </main>
    );
  }

  return (
    <section aria-label="知策台首页引导" className="relative overflow-hidden rounded-[24px] border border-slate-800 bg-black shadow-2xl shadow-slate-950/20">
      <iframe
        title="知策台备赛首页视觉引导"
        src="/design-world.html?embed=1"
        className="block h-[clamp(520px,64vh,680px)] w-full border-0"
      />
      <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] text-slate-300 backdrop-blur-md sm:left-7 sm:top-6">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
        当前项目 · 备赛首页
      </div>
    </section>
  );
}

export function WorkspaceLanding() {
  return <DesignWorldHero fullScreen destination="/?view=overview" />;
}
