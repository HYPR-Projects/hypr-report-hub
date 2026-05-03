// src/v2/admin/components/HealthDistribution.jsx
//
// Visualização compacta da distribuição de campanhas ativas por tier de
// pacing. Substitui a sparkline de "tendência das últimas 12 semanas"
// que vivia no ClientCard — sparkline tinha 3 problemas:
//
//   1. Sem label, ninguém sabia o que era
//   2. Cor variava por trend (verde sobe / vermelho cai), conflitando
//      com o resto do app onde vermelho = crítico
//   3. A pílula `↓62.6%` no canto já dava a direção do trend de forma
//      mais direta — sparkline virava ruído redundante
//
// Esta visualização troca "trend temporal" por "estado atual da carteira":
// quantas campanhas tão saudáveis vs precisam de atenção. Mais acionável,
// auto-explicativo (cores já familiares no resto do admin).
//
// Variantes
// ─────────
// - ≤6 ativas: dots discretos (cada dot = 1 campanha). Conta exata visível.
// - >6 ativas: barra horizontal proporcional. Não escala dot pra evitar
//   "fileira de 15 dots" virando ruído.
//
// Tiers (alinhado com classifyPacing em aggregation.js):
//   critical  (vermelho)  — pacing < 90%
//   attention (amarelo)   — pacing 90-99%
//   healthy   (verde)     — pacing 100-124%
//   over      (azul)      — pacing ≥125%
//
// Ordem visual: critical → attention → healthy → over (mais crítico
// primeiro, pra que o olho pegue problema rápido).

import { cn } from "../../../ui/cn";

const TIERS = [
  { key: "critical",  label: "crítica",   labelPlural: "críticas",   bg: "bg-danger" },
  { key: "attention", label: "atenção",   labelPlural: "atenção",    bg: "bg-warning" },
  { key: "healthy",   label: "saudável",  labelPlural: "saudáveis",  bg: "bg-success" },
  { key: "over",      label: "over",      labelPlural: "over",       bg: "bg-signature" },
];

const DOT_THRESHOLD = 6;

export function HealthDistribution({ distribution, activeCount }) {
  if (!activeCount) {
    return (
      <div className="flex items-center h-full">
        <span className="text-[11px] text-fg-subtle italic">
          Nenhuma campanha ativa
        </span>
      </div>
    );
  }

  const segments = TIERS
    .map((t) => ({ ...t, count: distribution?.[t.key] || 0 }))
    .filter((s) => s.count > 0);

  // Edge case: backend retornou activeCount mas distribution vazio (dado
  // faltante por campanha sem pacing). Mostra estado neutro.
  if (segments.length === 0) {
    return (
      <div className="flex items-center h-full">
        <span className="text-[11px] text-fg-subtle italic">
          Sem dados de pacing
        </span>
      </div>
    );
  }

  const labelText = segments
    .map((s) => `${s.count} ${s.count === 1 ? s.label : s.labelPlural}`)
    .join(" · ");

  return (
    <div className="flex flex-col justify-center h-full gap-2.5">
      {activeCount <= DOT_THRESHOLD ? (
        <DotsRow segments={segments} />
      ) : (
        <ProportionalBar segments={segments} />
      )}
      <p className="text-[11px] text-fg-muted leading-tight">{labelText}</p>
    </div>
  );
}

function DotsRow({ segments }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-hidden="true">
      {segments.flatMap((s) =>
        Array.from({ length: s.count }).map((_, i) => (
          <span
            key={`${s.key}-${i}`}
            className={cn("w-2.5 h-2.5 rounded-full", s.bg)}
          />
        ))
      )}
    </div>
  );
}

function ProportionalBar({ segments }) {
  return (
    <div
      className="flex h-2 rounded-full overflow-hidden gap-0.5"
      role="img"
      aria-hidden="true"
    >
      {segments.map((s) => (
        <div
          key={s.key}
          className={cn("h-full", s.bg)}
          style={{ flex: s.count }}
          title={`${s.count} ${s.count === 1 ? s.label : s.labelPlural}`}
        />
      ))}
    </div>
  );
}
