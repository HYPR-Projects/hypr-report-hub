// src/v2/components/PacingBarV2.jsx
//
// Barra de pacing horizontal. Comportamento idêntico ao Legacy:
//   - <70%   → vermelho (atrasado)
//   - 70-99% → amarelo (alerta)
//   - ≥100%  → verde (no alvo / over)
//   - Over-delivery aparece como segmento extra além dos 100%, em cor
//     signature pra destacar visualmente
//
// A barra é capada visualmente em 150% (50% de over) pra não estourar
// layout em casos extremos — o número exato continua no label.
//
// Renderiza null quando pacing é null/undefined (filtro de período ativo
// esconde pacing porque não faz sentido em janela parcial).

import { fmt, fmtR } from "../../shared/format";

const palette = {
  // valores do theme.css; replicados aqui pq são consumidos como style
  // inline (a barra precisa de width dinâmico em %).
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger:  "var(--color-danger)",
  signature: "var(--color-signature)",
};

function pickColor(pct) {
  if (pct >= 100) return palette.success;
  if (pct >= 70)  return palette.warning;
  return palette.danger;
}

export function PacingBarV2({ pacing, budget, cost, label = "Pacing da Campanha" }) {
  if (pacing == null) return null;

  const realPct = Number(pacing) || 0;
  const visiblePct = Math.min(realPct, 150);
  const overPct = visiblePct > 100 ? visiblePct - 100 : 0;
  const baseWidth = Math.min(visiblePct, 100);
  const barColor = pickColor(visiblePct);
  const labelColor = realPct > 100 ? palette.signature : barColor;

  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          {label}
        </span>
        <span
          className="text-sm font-bold tabular-nums whitespace-nowrap"
          style={{ color: labelColor }}
        >
          {fmt(realPct, 1)}%
          {realPct > 100 && (
            <span className="ml-2 text-xs font-semibold opacity-90">
              ⚡ Over de {fmt(realPct - 100, 1)}%
            </span>
          )}
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-surface-strong overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${baseWidth}%`, background: barColor }}
        />
        {overPct > 0 && (
          <div
            className="absolute inset-y-0 rounded-r-full transition-[width] duration-500 ease-out"
            style={{
              left: `${baseWidth}%`,
              width: `${Math.min(overPct, 50)}%`,
              background: palette.signature,
            }}
          />
        )}
      </div>

      <div className="flex justify-between mt-2 text-[11px] text-fg-muted tabular-nums">
        <span>Investido: {fmtR(cost)}</span>
        <span>Budget: {fmtR(budget)}</span>
      </div>
    </div>
  );
}
