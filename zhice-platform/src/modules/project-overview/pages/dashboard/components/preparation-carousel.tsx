"use client";

import { useRouter } from "next/navigation";
import CircularCarousel from "@/components/circular-carousel";

type PreparationCard = {
  src: string;
  alt: string;
  title: string;
  subtitle: string;
  href: string;
};

const preparationCards: PreparationCard[] = [
  {
    src: "/feature-cards/profile.svg",
    alt: "资源画像与赛事匹配的抽象图形",
    title: "画像与选赛",
    subtitle: "资源画像 · 赛事匹配",
    href: "/?view=competitions",
  },
  {
    src: "/feature-cards/topic.svg",
    alt: "题目验证与证据链的抽象图形",
    title: "定题与找依据",
    subtitle: "题目验证 · 证据链",
    href: "/?view=topics",
  },
  {
    src: "/feature-cards/plan.svg",
    alt: "计划书编辑与版本导出的抽象图形",
    title: "计划书与文档",
    subtitle: "在线编辑 · 版本导出",
    href: "/?view=plan",
  },
  {
    src: "/feature-cards/ppt.svg",
    alt: "演示文稿排版与提交前检查的抽象图形",
    title: "演示文稿与材料自查",
    subtitle: "排版检查 · 提交前准备",
    href: "/?view=ppt",
  },
];

export function PreparationCarousel() {
  const router = useRouter();

  return (
    <section
      aria-labelledby="preparation-carousel-title"
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1421] px-4 py-6 shadow-[0_24px_80px_-44px_rgba(56,189,248,.55)] sm:px-7 sm:py-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">四步材料准备</p>
          <h2 id="preparation-carousel-title" className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            把备赛路径，变成四张可执行的卡片。
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-400 sm:text-sm">
            拖动或点击卡片进入对应工作区；每一步都保留来源、状态和下一步动作。
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] text-slate-400">
          01 / 04
        </span>
      </div>

      <div className="mx-auto mt-2 h-[390px] w-full max-w-[1080px] sm:h-[470px]">
        <CircularCarousel
          items={preparationCards}
          preset="cylinder"
          intro="rise"
          cardWidth={240}
          aspectRatio={1}
          speed={14}
          captions
          ariaLabel="备赛四步功能卡片"
          cornerRadius={18}
          style={{ color: "#f8fafc" }}
          onItemClick={(_, index) => router.push(preparationCards[index]?.href || "/?view=overview")}
        />
      </div>

      <nav aria-label="四步功能快速入口" className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-4">
        {preparationCards.map((card, index) => (
          <a
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-white/5 bg-white/[.025] px-3 py-2.5 transition hover:border-cyan-300/35 hover:bg-cyan-300/[.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          >
            <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-200">
              <span className="font-mono text-cyan-300/80">0{index + 1}</span>
              {card.title}
            </span>
            <span className="mt-1 block text-[10px] leading-5 text-slate-500 group-hover:text-slate-300">{card.subtitle}</span>
          </a>
        ))}
      </nav>
    </section>
  );
}
