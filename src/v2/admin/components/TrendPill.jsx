// src/v2/admin/components/TrendPill.jsx
//
// Indicador de tendência inline: ↑ +12%, ↓ −3%, — 0%.
// Cor sólida sem chip de fundo — escala melhor quando há 10+ cards na
// tela (chip colorido em massa virava "campo de alertas"). A cor do
// texto + a seta carregam a semântica.
//
// Espelha exatamente o `compute_trend` do backend:
//   { pct: number, direction: "up" | "down" | "flat" }

import { cn } from "../../../ui/cn";

const COLOR = {
  up:   "text-success",
  down: "text-danger",
  flat: "text-fg-subtle",
};

const ARROW = {
  up:   "↑",
  down: "↓",
  flat: "—",
};

export function TrendPill({ trend, className }) {
  if (!trend || !trend.direction) return null;
  const colorCls = COLOR[trend.direction] || COLOR.flat;
  const arrow = ARROW[trend.direction] || ARROW.flat;
  const sign = trend.pct > 0 ? "+" : "";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums leading-none",
        colorCls,
        className
      )}
      title={`Variação vs período anterior: ${sign}${trend.pct}%`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>
        {sign}
        {Math.abs(trend.pct)}%
      </span>
    </span>
  );
}
