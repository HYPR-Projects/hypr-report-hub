// src/components/LoadingShell.jsx
//
// Fallback de loading visual usado enquanto:
//   - O chunk lazy do ClientDashboardV2 ainda está sendo baixado
//   - O lookup admin de share_id → short_token está em progresso
//
// Por que existe (vs reusar o DashboardSkeleton do V2)
//   O DashboardSkeleton vive dentro de ClientDashboardV2.jsx, que importa
//   v2.css (Tailwind v4). Quando esse fallback é mostrado, o chunk ainda
//   não baixou — então as classes Tailwind ainda não foram parsed e nada
//   estilizaria. Por isso este componente usa CSS inline puro, com cores
//   literais que casam com os tokens de tema dark do design system
//   (--color-canvas, --color-surface-2, --color-border).
//
// O resultado é uma transição visualmente contínua:
//   página em branco → LoadingShell (CSS inline)
//                    → DashboardSkeleton (Tailwind, mesma estrutura)
//                    → conteúdo real
// Sem o "flash de spinner solto" que existia antes.
//
// Mantido enxuto pra entrar no bundle inicial sem custo perceptível
// (o HyprReportCenterLogo já estava sendo carregado por outras rotas).

import HyprReportCenterLogo from "./HyprReportCenterLogo";

const SHIMMER = `
@keyframes hypr-shimmer {
  0%   { opacity: 0.45; }
  50%  { opacity: 0.75; }
  100% { opacity: 0.45; }
}
`;

const COLORS = {
  canvas:   "#0C161D", // bg-canvas em dark
  surface:  "#0F1A22", // bg-surface-2 em dark
  border:   "#1F2A33", // border em dark
  shimmer:  "#1F2A33", // mesmo da border, mas com animação de opacidade
  fgMuted:  "#9CA3AF",
};

const skeleton = (w, h, extra = {}) => ({
  width: w,
  height: h,
  background: COLORS.shimmer,
  borderRadius: 6,
  animation: "hypr-shimmer 1.6s ease-in-out infinite",
  ...extra,
});

export default function LoadingShell() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: COLORS.canvas,
        color: "#E5E7EB",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <style>{SHIMMER}</style>

      {/* Header — bate com o TopBarV2 (h-16, border-b, paddings) */}
      <div
        style={{
          height: 64,
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.canvas,
        }}
      >
        <HyprReportCenterLogo height={32} />
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 999,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            fontSize: 11,
            fontWeight: 500,
            color: COLORS.fgMuted,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "#3397B9",
              animation: "hypr-shimmer 1.6s ease-in-out infinite",
            }}
          />
          Carregando…
        </span>
      </div>

      {/* Body — bate com a estrutura do DashboardSkeleton */}
      <div
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* Hero card (CampaignHeader placeholder) */}
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
            padding: 32,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={skeleton(96, 12)} />
          <div style={skeleton(384, 36, { maxWidth: "70%" })} />
          <div style={skeleton(256, 16, { maxWidth: "40%" })} />
        </div>

        {/* Tabs row */}
        <div
          style={{
            display: "flex",
            gap: 8,
            borderBottom: `1px solid ${COLORS.border}`,
            paddingBottom: 0,
          }}
        >
          <div style={skeleton(128, 40)} />
          <div style={skeleton(96, 40)} />
          <div style={skeleton(96, 40)} />
        </div>

        {/* Hero KPI grid (5 cards) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={skeleton(80, 12)} />
              <div style={skeleton(112, 28)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
