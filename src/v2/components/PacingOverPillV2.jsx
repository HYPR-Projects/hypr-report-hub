// src/v2/components/PacingOverPillV2.jsx
//
// Pill "Over X%" reutilizável. Renderiza apenas quando pacing > 100.
//
// Originalmente vivia inline dentro do PacingBarV2; extraída em PR-23
// para ser reusada no card Pacing Geral do OverviewV2 (consistência
// visual entre Pacing Geral e Pacing Display/Video).
//
// Cor: warning (amarelo/dourado) tanto no dark quanto no light theme.
// Justificativa: over-delivery não é necessariamente positivo (custo
// extra), então o tom de alerta-leve faz mais sentido que verde.
//
// Tamanhos:
//   - "sm" (default): 10px, padding 1.5×0.5 — usado dentro de barras
//   - "md": 11px, padding 2×0.5 — usado em headers de KPI cards

import { fmt } from "../../shared/format";

export function PacingOverPillV2({ pacing, size = "sm", className = "" }) {
  const realPct = Number(pacing) || 0;
  if (realPct <= 100) return null;

  const overAmount = realPct - 100;

  const sizeClasses =
    size === "md"
      ? "text-[11px] px-2 py-0.5"
      : "text-[10px] px-1.5 py-0.5";

  return (
    <span
      className={`font-semibold uppercase tracking-wider rounded-md inline-flex items-center gap-1 whitespace-nowrap ${sizeClasses} ${className}`}
      style={{
        color: "var(--color-warning)",
        background: "var(--color-warning-soft)",
      }}
    >
      <BoltIcon className={size === "md" ? "size-3" : "size-2.5"} />
      Over {fmt(overAmount, 1)}%
    </span>
  );
}

function BoltIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
