// src/v2/dashboards/VideoV2.jsx
//
// Dashboard Video V2 — equivalente refatorado do VideoTab Legacy
// (src/components/dashboard-tabs/VideoTab.jsx).
//
// LAYOUT, NA ORDEM
//   1. Toolbar interna — SegmentedControlV2 (O2O/OOH) à esquerda;
//      AudienceFilterV2 à direita
//   2. KPI grid 1 (contratual): Budget, Views Contratadas, Views Bonus,
//      CPCV Negociado
//   3. KPI grid 2 (entrega): Views Start, Views 100%, VTR, CPCV Efetivo,
//      Rentabilidade — 5 cards em lg:grid-cols-5 (exceção do Video;
//      Display usa 4)
//   4. PacingBarV2 (escondido com filtro de período ativo)
//   5. DualChartV2 — Views 100% × VTR Diário (full-width)
//   6. DualChartV2 grid (2-col em ≥md): Tamanho + Audiência
//   7. CollapsibleSectionV2 + tabela detalhada (filtrada VIDEO) + CSV
//
// FILTRO DE PERÍODO É GLOBAL
//   DateRangeFilterV2 vive no ClientDashboardV2 (shell), acima das tabs.
//   mainRange é compartilhado entre Visão Geral, Display e Video via
//   `aggregates` recebido como prop.
//
// COMPORTAMENTO COM FILTRO DE PERÍODO
//   Quando isFiltered=true, computeAggregates já reconstrói os totals
//   recalculando effective_cpcv_amount e rentabilidade com base no
//   delivery proporcional. PacingBarV2 some inteira (mesmo critério
//   do Display e da Visão Geral) — pacing em janela parcial não tem
//   leitura útil.
//
// CONTRATO COM ClientDashboardV2
//   Recebe `data` e `aggregates` (já calculado para mainRange atual),
//   além de tactic/lines como state vindo do shell. Ao trocar tactic,
//   filtro de audiência é zerado (line_names diferem entre O2O e OOH).
//
// REUSO
//   - computeAggregates / computeVideoKpis: shared/aggregations.js
//   - groupByDate / groupBySize / groupByAudience / buildLineOptions:
//     shared/aggregations.js (mesmas funções que o Legacy VideoTab)
//   - DualChartV2, KpiCardV2, PacingBarV2, CollapsibleSectionV2:
//     src/v2/components (do OverviewV2/DisplayV2)
//   - AudienceFilterV2, SegmentedControlV2: PR-10
//
// QUIRK PRESERVADA DO LEGACY
//   Filtro de detail por tactic usa `line_name?.toLowerCase()
//   .includes(tactic.toLowerCase())` em vez de `tactic_type === tactic`.
//   Mesma convenção HYPR documentada no DisplayV2.

import { useMemo } from "react";
import {
  buildLineOptions,
  computeVideoKpis,
  groupByDate,
  groupBySize,
  groupByAudience,
} from "../../shared/aggregations";
import { fmt, fmtP, fmtP2, fmtR } from "../../shared/format";

import { Button } from "../../ui/Button";

import { AudienceFilterV2 } from "../components/AudienceFilterV2";
import { CollapsibleSectionV2 } from "../components/CollapsibleSectionV2";
import { DualChartV2 } from "../components/DualChartV2";
import { KpiCardV2 } from "../components/KpiCardV2";
import { PacingBarV2 } from "../components/PacingBarV2";
import { SegmentedControlV2 } from "../components/SegmentedControlV2";

const TACTIC_OPTIONS = [
  { value: "O2O", label: "O2O" },
  { value: "OOH", label: "OOH" },
];

export default function VideoV2({
  data,
  aggregates,
  tactic,
  setTactic,
  lines,
  setLines,
}) {
  const camp = data.campaign;

  // Derivações por tactic + filtro de audiência. Mesma quirk Legacy:
  // detail filtrado por substring no line_name (ver header).
  const view = useMemo(() => {
    const totals = aggregates.totals.filter(
      (r) => r.media_type === "VIDEO" && r.tactic_type === tactic,
    );
    const detailAll = aggregates.detail.filter(
      (r) =>
        r.media_type === "VIDEO" &&
        r.line_name?.toLowerCase().includes(tactic.toLowerCase()),
    );
    const lineOptions = buildLineOptions(detailAll).filter((l) => l !== "ALL");
    const detailFiltered =
      lines.length === 0
        ? detailAll
        : detailAll.filter((r) => lines.includes(r.line_name));

    const kpis = computeVideoKpis({
      rows: totals,
      detail: detailFiltered,
      tactic,
    });

    // Séries pros 3 charts. groupByDate/Size respeitam o filtro do
    // usuário; groupByAudience opera sobre detailAll (visão de
    // audiências mostra TODAS, independente do filtro — coerente com
    // Legacy).
    const daily = groupByDate(detailFiltered, "video_view_100", "viewable_impressions", "vtr");
    const bySize = groupBySize(detailFiltered, "video_view_100", "viewable_impressions", "vtr");
    const byAudience = groupByAudience(detailAll, "video_view_100", "viewable_impressions", "vtr");

    return { totals, detailAll, detailFiltered, lineOptions, kpis, daily, bySize, byAudience };
  }, [aggregates, tactic, lines]);

  const { totals, detailFiltered, lineOptions, kpis, daily, bySize, byAudience } = view;

  // Sem dados de Video — render mínimo informativo.
  // Cobre dois casos: (a) campanha só-Display sem rows VIDEO em todos os
  // estados; (b) tactic atual sem entrega (ex.: campanha só O2O e usuário
  // selecionou OOH).
  if (totals.length === 0 && view.detailAll.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-fg-muted">
          Não há entrega Video {tactic} nesta campanha.
        </p>
      </div>
    );
  }

  // Views contratadas e bonus por tactic (vêm do row[0] em totals)
  const row0 = totals[0] || {};
  const contractedViews =
    tactic === "O2O"
      ? row0.contracted_o2o_video_completions || 0
      : row0.contracted_ooh_video_completions || 0;
  const bonusViews =
    tactic === "O2O"
      ? row0.bonus_o2o_video_completions || 0
      : row0.bonus_ooh_video_completions || 0;

  const downloadCSV = () => {
    const headers = [
      "Data",
      "Campanha",
      "Line",
      "Criativo",
      "Tamanho",
      "Tática",
      "Imp. Visíveis",
      "Video Start",
      "Views 25%",
      "Views 50%",
      "Views 75%",
      "Views 100%",
      "VTR",
      "Custo Ef.",
    ];
    const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = detailFiltered.map((r) => [
      r.date,
      r.campaign_name,
      r.line_name,
      r.creative_name,
      r.creative_size,
      r.tactic_type,
      r.viewable_impressions,
      r.video_starts,
      r.video_view_25,
      r.video_view_50,
      r.video_view_75,
      r.video_view_100,
      r.vtr ?? 0,
      r.effective_total_cost,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map(escape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video_${tactic}_${camp.campaign_name || "campanha"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar interna — tactic à esquerda, filtro de audiência à direita.
          Filtro de período é global (shell). */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <SegmentedControlV2
          label="Tática Video"
          options={TACTIC_OPTIONS}
          value={tactic}
          onChange={(t) => {
            setTactic(t);
            // Limpa filtro de audiência ao trocar tactic — o conjunto de
            // line_names é diferente entre O2O e OOH.
            setLines([]);
          }}
        />
        <AudienceFilterV2
          lines={lineOptions}
          selected={lines}
          onChange={setLines}
        />
      </div>

      {/* KPI grid 1 — contratual */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-3">
          Contratual
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCardV2
            label="Budget Contratado"
            value={fmtR(kpis.budget)}
            hint="Budget alocado à tática selecionada (O2O ou OOH)."
          />
          <KpiCardV2
            label="Views Contratadas"
            value={fmt(contractedViews)}
            hint="Volume de completions (views 100%) contratadas para a tática."
          />
          <KpiCardV2
            label="Views Bonus"
            value={fmt(bonusViews)}
            hint="Bonus negociado adicional ao contratado."
          />
          <KpiCardV2
            label="CPCV Negociado"
            value={fmtR(kpis.cpcvNeg)}
            hint="CPCV (Custo Por Completion View) acordado em contrato."
          />
        </div>
      </section>

      {/* KPI grid 2 — entrega. 5 cards em lg:grid-cols-5 (exceção do
          Video; Display usa lg:grid-cols-4). */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-3">
          Entrega
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCardV2
            label="Views Start"
            value={fmt(kpis.starts)}
            hint="Total de video starts (impressões com início de reprodução)."
          />
          <KpiCardV2
            label="Views 100%"
            value={fmt(kpis.views100)}
            hint="Completions — vídeos vistos até o final."
          />
          <KpiCardV2
            label="VTR"
            value={fmtP2(kpis.vtr)}
            hint="View-Through Rate: Views 100% / Imp. Visíveis."
          />
          <KpiCardV2
            label="CPCV Efetivo"
            value={fmtR(kpis.cpcvEf)}
            accent
            hint="Custo Efetivo / Views 100%. Quando filtrado, recalculado proporcionalmente ao período."
          />
          <KpiCardV2
            label="Rentabilidade"
            value={fmtP(kpis.rentab)}
            accent
            hint="(CPCV Negociado − CPCV Efetivo) / CPCV Negociado. Positivo = a HYPR entregou mais que o contratado."
          />
        </div>
      </section>

      {/* Pacing — esconde quando há filtro de período (mesma regra de
          Overview/Display). Pacing Video vem direto do backend (rows[0]
          .pacing) — fórmula com days_with_delivery por frente, mais
          precisa que dá pra fazer no front. */}
      {!aggregates.isFiltered && (
        <PacingBarV2
          label={`Pacing ${tactic}`}
          pacing={kpis.pac}
          budget={kpis.budget}
          cost={kpis.cost}
        />
      )}

      {/* Chart diário — full width */}
      {daily.length > 0 && (
        <section>
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-signature mb-3">
              Views 100% × VTR Diário
            </div>
            <DualChartV2
              data={daily}
              xKey="date"
              y1Key="video_view_100"
              y2Key="vtr"
              label1="Views 100%"
              label2="VTR %"
            />
          </div>
        </section>
      )}

      {/* Charts por dimensão — 2 colunas em ≥md, 1 em mobile */}
      {(bySize.length > 0 || byAudience.length > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {bySize.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-signature mb-3">
                Views 100% × VTR por Tamanho
              </div>
              <DualChartV2
                data={bySize}
                xKey="size"
                y1Key="video_view_100"
                y2Key="vtr"
                label1="Views 100%"
                label2="VTR %"
              />
            </div>
          )}
          {byAudience.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="text-[11px] font-bold uppercase tracking-widest text-signature mb-3">
                Views 100% × VTR por Audiência
              </div>
              <DualChartV2
                data={byAudience}
                xKey="audience"
                y1Key="video_view_100"
                y2Key="vtr"
                label1="Views 100%"
                label2="VTR %"
              />
            </div>
          )}
        </section>
      )}

      {/* Tabela detalhada — colapsável + CSV */}
      {detailFiltered.length > 0 && (
        <section>
          <CollapsibleSectionV2 title="Detalhamento Diário">
            <div className="flex justify-end mb-3">
              <Button variant="secondary" size="sm" onClick={downloadCSV}>
                ⬇ Download CSV
              </Button>
            </div>
            <VideoDetailTable rows={detailFiltered} />
          </CollapsibleSectionV2>
        </section>
      )}
    </div>
  );
}

// ─── Tabela detalhada inline ───────────────────────────────────────────
//
// Tabela específica do VideoV2 — só colunas relevantes pra Video. Mesmo
// design pattern da DisplayDetailTable: header sticky, hover row,
// truncamento em 200 linhas (com aviso) + CSV completo via botão.

const DETAIL_COLUMNS = [
  { key: "date", label: "Data" },
  { key: "line_name", label: "Line" },
  { key: "creative_name", label: "Criativo" },
  { key: "creative_size", label: "Tamanho" },
  { key: "viewable_impressions", label: "Imp. Visíveis", numeric: true },
  { key: "video_starts", label: "Starts", numeric: true },
  { key: "video_view_25", label: "25%", numeric: true },
  { key: "video_view_50", label: "50%", numeric: true },
  { key: "video_view_75", label: "75%", numeric: true },
  { key: "video_view_100", label: "100%", numeric: true },
  { key: "vtr", label: "VTR", numeric: true, formatter: fmtP2 },
  {
    key: "effective_total_cost",
    label: "Custo Ef.",
    numeric: true,
    formatter: fmtR,
  },
];

const ROW_LIMIT = 200;

function VideoDetailTable({ rows }) {
  const visible = rows.slice(0, ROW_LIMIT);
  const truncated = rows.length > ROW_LIMIT;

  return (
    <div>
      <div className="text-[11px] text-fg-subtle mb-2 tabular-nums">
        Mostrando {fmt(visible.length)} de {fmt(rows.length)} linhas
        {truncated && " — exporte CSV para o conjunto completo"}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border max-h-[480px]">
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-surface-strong border-b border-border">
            <tr>
              {DETAIL_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={
                    c.numeric
                      ? "px-3 py-2 text-right font-semibold text-fg-muted whitespace-nowrap"
                      : "px-3 py-2 text-left font-semibold text-fg-muted whitespace-nowrap"
                  }
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr
                key={i}
                className="border-b border-border/40 last:border-b-0 hover:bg-surface transition-colors"
              >
                {DETAIL_COLUMNS.map((c) => {
                  const raw = r[c.key];
                  const display = c.formatter
                    ? c.formatter(raw)
                    : c.numeric
                      ? fmt(raw)
                      : raw ?? "—";
                  return (
                    <td
                      key={c.key}
                      className={
                        c.numeric
                          ? "px-3 py-2 text-right text-fg whitespace-nowrap"
                          : "px-3 py-2 text-left text-fg whitespace-nowrap"
                      }
                      title={typeof raw === "string" ? raw : undefined}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
