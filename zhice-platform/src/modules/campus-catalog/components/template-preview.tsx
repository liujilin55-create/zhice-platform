import { pageKinds, type VisualConfig } from "../types";

export function TemplatePreview({ config }: { config: VisualConfig }) {
  // Platform-owned vector preview. No source artwork or original deck content is rendered.
  return <div className="grid grid-cols-3 gap-2" aria-label="平台自绘版式预览">
    {pageKinds.map((kind) => { const rule = config.layouts.find((r) => r.kind === kind)!; return <svg key={kind} viewBox="0 0 160 90" role="img" aria-label={kind + " 布局"} className="w-full rounded-lg border border-slate-200">
      <rect width="160" height="90" fill={"#" + config.colors.background} /><rect width="160" height="3" fill={"#" + config.colors.accent} />
      <rect x="12" y={rule.arrangement === "title" ? 26 : 13} width={rule.arrangement === "title" ? 105 : 76} height="6" rx="2" fill={"#" + config.colors.text} />
      {rule.arrangement === "columns" ? [0, 1, 2].map((n) => <g key={n}><rect x={12 + n * 46} y="32" width="41" height="38" rx="3" fill={"#" + config.colors.surface} /><rect x={18 + n * 46} y="40" width="23" height="3" fill={"#" + config.colors.accent} /><rect x={18 + n * 46} y="51" width="29" height="2" fill={"#" + config.colors.muted} /></g>)
        : rule.arrangement === "chart" ? <g><line x1="16" y1="71" x2="143" y2="71" stroke={"#" + config.colors.muted} />{[0, 1, 2, 3].map((n) => <rect key={n} x={25 + n * 29} y={58 - n * 9} width="16" height={13 + n * 9} rx="1" fill={"#" + config.colors.accent} />)}</g>
        : rule.arrangement === "steps" ? [0, 1, 2].map((n) => <g key={n}><rect x="12" y={33 + n * 13} width="8" height="8" rx="2" fill={"#" + config.colors.accent} /><rect x="28" y={35 + n * 13} width="107" height="4" rx="1" fill={"#" + config.colors.surface} /></g>)
        : [0, 1, 2].map((n) => <rect key={n} x="12" y={rule.arrangement === "title" ? 48 + n * 7 : 33 + n * 13} width={rule.arrangement === "title" ? 85 - n * 10 : 122} height={rule.arrangement === "title" ? 3 : 7} rx="2" fill={"#" + (n === 0 ? config.colors.accent : config.colors.surface)} />)}
      <text x="12" y="83" fontSize="6" fill={"#" + config.colors.muted}>{kind} · 自有布局</text>
    </svg>; })}
  </div>;
}
