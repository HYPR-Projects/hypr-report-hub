import { C } from "../../shared/theme";
import { fmt, fmtP, fmtP2, fmtR } from "../../shared/format";
import Tabs from "../Tabs";
import MultiLineSelect from "../MultiLineSelect";
import DualChart from "../DualChart";
import CollapsibleTable from "../CollapsibleTable";
import PerfTable from "../PerfTable";
import TabChat from "../TabChat";

const TACTIC_TABS = ["O2O", "OOH"];

/**
 * Tab "Display" — switch O2O/OOH + filtro multi-line + KPIs + pacing
 * + 3 charts (entrega diária, por tamanho, por audiência) + tabela detalhada.
 *
 * Por que ficar separada
 * ----------------------
 * Antes inline no ClientDashboard ocupando ~147 linhas, com função IIFE
 * gigante misturando agregação e render. Aqui mantém a função interna
 * porque depende fortemente dos states (dispTab, dispLines) e os derivados
 * mudam a cada filtro — memoizar não compensa.
 *
 * Props
 * -----
 * - `aggregates`: { totals, daily0, detail0 } do dashboard (memoizado lá);
 * - `camp`: data.campaign;
 * - `theme`: cTheme;
 * - `token`, `isAdmin`, `adminJwt`;
 * - `isDarkClient`: pra cores do pacing bar (over);
 * - `dispTab`, `setDispTab`: tactic ativa (O2O/OOH) — controlado pelo pai
 *   pra preservar quando trocar de tab;
 * - `dispLines`, `setDispLines`: filtro de lines (array vazio = todas).
 */
const DisplayTab = ({
  aggregates, camp, theme,
  token, isAdmin, adminJwt,
  isDarkClient,
  dispTab, setDispTab,
  dispLines, setDispLines,
}) => {
  const { totals, detail0 } = aggregates;

  const cbg2  = theme.bg2;
  const cbdr  = theme.bdr;
  const ctext = theme.text;
  const cmuted = theme.muted;

  return (
    <div>
      <Tabs
        tabs={TACTIC_TABS}
        active={dispTab}
        onChange={(t) => { setDispTab(t); setDispLines([]); }}
        small
        theme={theme}
      />
      {(() => {
        const rows      = totals.filter(r => r.media_type === "DISPLAY" && r.tactic_type === dispTab);
        const detailAll = detail0.filter(r => r.media_type === "DISPLAY" && r.line_name?.toLowerCase().includes(dispTab.toLowerCase()));
        // Lines disponíveis para o dropdown
        const lineNames = ["ALL", ...[...new Set(detailAll.map(r => r.line_name).filter(Boolean))].sort()];
        // detail/daily filtrados pela line — para impressões, cliques, gráficos, tabela
        const detail = dispLines.length === 0 ? detailAll : detailAll.filter(r => dispLines.includes(r.line_name));
        const daily = (() => {
          const m = {};
          detail.forEach(r => {
            if (!r.date) return;
            if (!m[r.date]) m[r.date] = { date: r.date, viewable_impressions: 0, clicks: 0 };
            m[r.date].viewable_impressions += Number(r.viewable_impressions) || 0;
            m[r.date].clicks               += Number(r.clicks) || 0;
          });
          return Object.values(m)
            .sort((a, b) => a.date > b.date ? 1 : -1)
            .map(r => ({ ...r, ctr: r.viewable_impressions > 0 ? r.clicks / r.viewable_impressions * 100 : 0 }));
        })();

        // Gráfico por audiência — sempre do total, ignora lines de survey
        const getAudience = (ln) => { const p = (ln || "").split("_"); return p.length >= 2 ? p[p.length - 2] : "N/A"; };
        const byAudience = Object.values(detailAll.reduce((acc, r) => {
          const k = getAudience(r.line_name);
          if (/survey/i.test(k) || k === "N/A") return acc;
          if (!acc[k]) acc[k] = { audience: k, viewable_impressions: 0, clicks: 0 };
          acc[k].viewable_impressions += r.viewable_impressions || 0;
          acc[k].clicks               += r.clicks || 0;
          return acc;
        }, {})).map(r => ({ ...r, ctr: r.viewable_impressions > 0 ? r.clicks / r.viewable_impressions * 100 : 0 }));

        // KPIs filtrados
        const sumD    = k => detail.reduce((s, r) => s + (r[k] || 0), 0);
        const cost    = rows.reduce((s, r) => s + (r.effective_total_cost || 0), 0);
        const impr    = sumD("impressions");
        const vi      = sumD("viewable_impressions");
        const clks    = sumD("clicks");
        const ctr     = vi > 0 ? clks / vi * 100 : 0;

        // Métricas contratuais — sempre do TOTAL (ignora filtro de line)
        const sumDAll = k => detailAll.reduce((s, r) => s + (r[k] || 0), 0);
        const viAll   = sumDAll("viewable_impressions");
        const budget  = rows.reduce((s, r) => s + (dispTab === "O2O" ? (r.o2o_display_budget || 0) : (r.ooh_display_budget || 0)), 0);
        const cpmNeg  = rows[0]?.deal_cpm_amount || 0;

        const [sy2, sm2, sd2] = camp.start_date.split("-").map(Number);
        const [ey2, em2, ed2] = camp.end_date.split("-").map(Number);
        const start2 = new Date(sy2, sm2 - 1, sd2);
        const end2   = new Date(ey2, em2 - 1, ed2);
        const today2 = new Date();

        const contracted2 = dispTab === "O2O" ? (rows[0]?.contracted_o2o_display_impressions || 0) : (rows[0]?.contracted_ooh_display_impressions || 0);
        const bonus2      = dispTab === "O2O" ? (rows[0]?.bonus_o2o_display_impressions || 0)      : (rows[0]?.bonus_ooh_display_impressions || 0);
        const totalNeg2   = contracted2 + bonus2;

        const tDays = (end2 - start2) / 864e5 + 1;
        const eDays = today2 < start2 ? 0 : today2 > end2 ? tDays : Math.floor((today2 - start2) / 864e5);
        const budgetPropDisp = today2 > end2 ? budget : budget / tDays * eDays;

        // CPM Efetivo, Rentabilidade e Pacing sempre sobre total (não filtrado por audiência)
        const cpmEf  = cpmNeg > 0 ? Math.min(viAll > 0 ? budgetPropDisp / viAll * 1000 : 0, cpmNeg) : 0;
        const cpc    = clks > 0 ? cpmEf / 1000 * (viAll / clks) : 0;
        const rentab = cpmNeg > 0 ? (cpmNeg - cpmEf) / cpmNeg * 100 : 0;

        const deliveredAll = sumDAll("viewable_impressions");
        const expected2    = totalNeg2 * (eDays / tDays);
        const pac          = totalNeg2 > 0 ? (today2 > end2 ? deliveredAll / totalNeg2 * 100 : expected2 > 0 ? deliveredAll / expected2 * 100 : 0) : 0;
        const pacBase      = Math.min(pac, 100);
        const pacOver      = Math.max(0, pac - 100);

        const bySize = Object.values(detail.reduce((acc, r) => {
          const k = r.creative_size || "N/A";
          if (!acc[k]) acc[k] = { size: k, viewable_impressions: 0, clicks: 0 };
          acc[k].viewable_impressions += r.viewable_impressions || 0;
          acc[k].clicks               += r.clicks || 0;
          return acc;
        }, {})).map(r => ({ ...r, ctr: r.viewable_impressions > 0 ? r.clicks / r.viewable_impressions * 100 : 0 }));

        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 16px", background: cbg2, border: `1px solid ${cbdr}`, borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: cmuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>Line Item:</span>
              <MultiLineSelect lines={lineNames} selected={dispLines} onChange={setDispLines} theme={theme}/>
              {dispLines.length > 0 && (
                <button onClick={() => setDispLines([])} style={{ background: "none", border: `1px solid ${cbdr}`, color: cmuted, borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
                  ✕ Limpar
                </button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { l: "Budget Contratado",  v: fmtR(budget) },
                { l: "Imp. Contratadas",   v: fmt(dispTab === "O2O" ? (rows[0]?.contracted_o2o_display_impressions || 0) : (rows[0]?.contracted_ooh_display_impressions || 0)) },
                { l: "Imp. Bonus",         v: fmt(dispTab === "O2O" ? (rows[0]?.bonus_o2o_display_impressions || 0)      : (rows[0]?.bonus_ooh_display_impressions || 0)) },
                { l: "CPM Negociado",      v: fmtR(cpmNeg) },
              ].map(({ l, v }) => (
                <div key={l} style={{ background: cbg2, border: `1px solid ${cbdr}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: cmuted, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: ctext }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { l: "Impressões",      v: fmt(impr) },
                { l: "Imp. Visíveis",   v: fmt(vi) },
                { l: "CPM Efetivo",     v: fmtR(cpmEf), blue: true },
                { l: "Rentabilidade",   v: fmtP(rentab), color: rentab > 0 ? C.blue : rentab < 0 ? C.red : C.white },
                { l: "Cliques",         v: fmt(clks) },
                { l: "CTR",             v: fmtP2(ctr) },
                { l: "CPC",             v: fmtR(cpc) },
              ].map(({ l, v, blue, color }) => (
                <div key={l} style={{ background: cbg2, border: `1px solid ${cbdr}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: cmuted, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: color || (blue ? C.blue : ctext) }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ background: cbg2, border: `1px solid ${cbdr}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              {(() => {
                const barC  = pac >= 100 ? "#2ECC71" : pac >= 70 ? "#F1C40F" : "#E74C3C";
                const overC = isDarkClient ? "#C5EAF6" : "#246C84";
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: cmuted, textTransform: "uppercase", letterSpacing: 1 }}>Pacing {dispTab}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: pac > 100 ? overC : barC }}>
                        {fmt(pac, 1)}%{pac > 100 && ` ⚡ Over de ${fmt(pac - 100, 1)}%`}
                      </span>
                    </div>
                    <div style={{ height: 8, background: isDarkClient ? C.dark3 : "#E2E8F0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ display: "flex", height: "100%" }}>
                        <div style={{ width: `${pacBase}%`, background: barC, borderRadius: 4, transition: "width 0.8s" }}/>
                        {pacOver > 0 && <div style={{ width: `${Math.min(pacOver, 20)}%`, background: overC, borderRadius: 4 }}/>}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                      <span style={{ fontSize: 11, color: cmuted }}>Investido: {fmtR(cost)}</span>
                      <span style={{ fontSize: 11, color: cmuted }}>Budget: {fmtR(budget)}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ background: cbg2, border: `1px solid ${cbdr}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Entrega × CTR Diário</div>
                <DualChart data={daily} xKey="date" y1Key="viewable_impressions" y2Key="ctr" label1="Imp. Visíveis" label2="CTR %" color1={C.blue} color2={C.blueLight}/>
              </div>
              <div style={{ background: cbg2, border: `1px solid ${cbdr}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Entrega × CTR por Tamanho</div>
                <DualChart data={bySize} xKey="size" y1Key="viewable_impressions" y2Key="ctr" label1="Imp. Visíveis" label2="CTR %" color1={C.blue} color2={C.blueLight}/>
              </div>
            </div>

            <div style={{ background: cbg2, border: `1px solid ${cbdr}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Entrega × CTR por Audiência</div>
              <DualChart data={byAudience} xKey="audience" y1Key="viewable_impressions" y2Key="ctr" label1="Imp. Visíveis" label2="CTR %" color1={C.blue} color2={C.blueLight}/>
            </div>

            <CollapsibleTable title="Detalhamento Diário" theme={theme}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button onClick={() => {
                  const headers = ["Data", "Campanha", "Line", "Criativo", "Tamanho", "Tática", "Impressões", "Imp. Visíveis", "Cliques", "CTR", "CPM Ef.", "Custo Ef."];
                  const csv = [headers, ...detail.map(r => [r.date, r.campaign_name, r.line_name, r.creative_name, r.creative_size, r.tactic_type, r.impressions, r.viewable_impressions, r.clicks, r.ctr, r.effective_cpm_amount, r.effective_total_cost])]
                    .map(r => r.map(v => `"${v ?? ""}`).join(",")).join("\n");
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  a.download = `display_${dispTab}_${camp.campaign_name}.csv`;
                  a.click();
                }} style={{ background: C.blue, color: C.white, border: "none", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  ⬇ Download CSV
                </button>
              </div>
              <PerfTable rows={detail} type="DISPLAY"/>
            </CollapsibleTable>

            <TabChat token={token} tabName="Display" author={isAdmin ? "HYPR" : "Cliente"} adminJwt={adminJwt} theme={theme}/>
          </div>
        );
      })()}
    </div>
  );
};

export default DisplayTab;
