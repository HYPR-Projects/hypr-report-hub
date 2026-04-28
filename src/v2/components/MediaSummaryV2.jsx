// src/v2/components/MediaSummaryV2.jsx
//
// Card de resumo por mídia (Display ou Video) com FOCO na comparação
// Negociado vs Efetivo — diferencial citado no ADR como prioritário.
//
// Diferenças vs Legacy MediaSummary:
//   - Layout hero: CPM Negociado e CPM Efetivo lado a lado, com delta %
//     destacado (verde se efetivo < negociado, vermelho se acima)
//   - KPIs secundários em grid abaixo (Imp.Visíveis, Clicks/Views100, CTR/VTR, CPC)
//   - Não tem cálculo interno duplicado: consome `aggregates.display[0]` ou
//     `aggregates.video[0]` que já vêm de computeAggregates com effective_cpm,
//     effective_cpcv e rentabilidade calculados
//
// Quando consumir
//   - Display: <MediaSummaryV2 type="DISPLAY" row={display[0]} />
//   - Video:   <MediaSummaryV2 type="VIDEO"   row={video[0]} />
//   - row pode ser undefined se não há linhas dessa mídia — componente
//     renderiza null silenciosamente.

import { fmt, fmtP, fmtR } from "../../shared/format";
import { cn } from "../../ui/cn";
import { Card, CardBody } from "../../ui/Card";

// Renderiza um KPI compacto (label uppercase, valor tabular)
function MiniKpi({ label, value, accent = false }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </div>
      <div
        className={cn(
          "text-base font-bold tabular-nums leading-tight mt-1 truncate",
          accent ? "text-signature" : "text-fg",
        )}
      >
        {value}
      </div>
    </div>
  );
}

// Bloco hero: NEG. vs EFET. com delta. Cor do delta:
//   - rentab >= 0 → success (efetivo abaixo do negociado, lucro)
//   - rentab <  0 → danger  (efetivo acima do negociado, prejuízo)
function NegVsEffective({ negLabel, negValue, effLabel, effValue, rentab }) {
  const rentabPositive = (rentab ?? 0) >= 0;
  const rentabColor = rentabPositive ? "text-success" : "text-danger";
  const rentabBg    = rentabPositive ? "bg-success-soft" : "bg-danger-soft";
  const rentabSign  = rentabPositive ? "↓" : "↑";

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          {negLabel}
        </div>
        <div className="text-2xl font-bold text-fg tabular-nums leading-tight mt-1">
          {fmtR(negValue)}
        </div>
      </div>

      <div
        className={cn(
          "rounded-full px-3 py-1 text-xs font-bold tabular-nums",
          rentabBg,
          rentabColor,
        )}
        title="Rentabilidade — diferença % entre o CPM/CPCV negociado e o efetivo entregue"
      >
        {rentab == null ? "—" : `${rentabSign} ${fmtP(Math.abs(rentab))}`}
      </div>

      <div className="text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
          {effLabel}
        </div>
        <div className="text-2xl font-bold text-signature tabular-nums leading-tight mt-1">
          {fmtR(effValue)}
        </div>
      </div>
    </div>
  );
}

export function MediaSummaryV2({ type, row }) {
  if (!row) return null;

  const isDisplay = type === "DISPLAY";

  const vi   = row.viewable_impressions || 0;
  const clks = row.clicks || 0;
  const v100 = row.completions || 0;

  const ctr = vi > 0 ? (clks / vi) * 100 : null;
  const vtr = vi > 0 ? (v100 / vi) * 100 : null;
  // CPC efetivo: reusa effective_cpm_amount como base. Mesma fórmula
  // dimensional do Legacy: (CPM/1000) * (impressões/cliques).
  const cpc = clks > 0 && row.effective_cpm_amount
    ? (row.effective_cpm_amount / 1000) * (vi / clks)
    : null;

  return (
    <Card>
      <CardBody className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-signature">
            {type}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Hero: Negociado vs Efetivo */}
        <NegVsEffective
          negLabel={isDisplay ? "CPM Negociado" : "CPCV Negociado"}
          negValue={isDisplay ? row.deal_cpm_amount : row.deal_cpcv_amount}
          effLabel={isDisplay ? "CPM Efetivo" : "CPCV Efetivo"}
          effValue={isDisplay ? row.effective_cpm_amount : row.effective_cpcv_amount}
          rentab={row.rentabilidade}
        />

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border">
          <MiniKpi label="Imp. Visíveis" value={fmt(vi)} />
          {isDisplay ? (
            <>
              <MiniKpi label="Clicks" value={fmt(clks)} />
              <MiniKpi label="CTR" value={ctr == null ? "—" : fmtP(ctr)} accent />
              <MiniKpi label="CPC" value={cpc == null ? "—" : fmtR(cpc)} />
            </>
          ) : (
            <>
              <MiniKpi label="Views 100%" value={fmt(v100)} />
              <MiniKpi label="VTR" value={vtr == null ? "—" : fmtP(vtr)} accent />
              <MiniKpi label="Custo Efetivo" value={fmtR(row.effective_total_cost)} />
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
