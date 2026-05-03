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
//   literais que casam com os tokens de tema.
//
// O resultado é uma transição visualmente contínua:
//   página em branco → LoadingShell (CSS inline)
//                    → DashboardSkeleton (Tailwind, mesma estrutura)
//                    → conteúdo real
// Sem o "flash de spinner solto" que existia antes.
//
// Tema dark/light
// ───────────────
// Lê `data-theme` do <html> (setado pelo anti-FOUC inline em index.html
// ANTES do React montar — sempre presente). Aplica paleta equivalente aos
// tokens do theme.css correspondente. MutationObserver cobre troca de
// tema enquanto o loading tá visível (caso raro mas possível).
//
// Cores hex literais em vez de CSS vars porque o caller pode estar antes
// do v2.css ter sido parseado — não dá pra confiar em var(--color-canvas).
//
// Mantido enxuto pra entrar no bundle inicial sem custo perceptível
// (o HyprReportCenterLogo já estava sendo carregado por outras rotas).

import { useEffect, useState } from "react";
import HyprReportCenterLogo from "./HyprReportCenterLogo";

const SHIMMER = `
@keyframes hypr-shimmer {
  0%   { opacity: 0.45; }
  50%  { opacity: 0.75; }
  100% { opacity: 0.45; }
}
`;

// Paletas equivalentes aos tokens de cada tema. Hex literais pra não
// depender de CSS vars (theme.css pode não ter sido parseado ainda).
const PALETTES = {
  dark: {
    canvas:  "#0C161D",
    surface: "#0F1A22",
    border:  "#1F2A33",
    shimmer: "#1F2A33",
    fgMuted: "#9CA3AF",
    text:    "#E5E7EB",
  },
  light: {
    canvas:  "#F8F9FA",
    surface: "#FFFFFF",
    border:  "#E5E8EC",
    shimmer: "#ECEEF1",
    fgMuted: "#6B7280",
    text:    "#111827",
  },
};

function readTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") || "dark";
}

function useDataTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const obs = new MutationObserver(() => setTheme(readTheme()));
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export default function LoadingShell() {
  const theme = useDataTheme();
  const COLORS = PALETTES[theme] || PALETTES.dark;

  const skeleton = (w, h, extra = {}) => ({
    width: w,
    height: h,
    background: COLORS.shimmer,
    borderRadius: 6,
    animation: "hypr-shimmer 1.6s ease-in-out infinite",
    ...extra,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: COLORS.canvas,
        color: COLORS.text,
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
