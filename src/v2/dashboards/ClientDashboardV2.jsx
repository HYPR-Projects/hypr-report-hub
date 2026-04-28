// src/v2/dashboards/ClientDashboardV2.jsx
//
// STUB do ClientDashboardV2.
//
// Esta é a primeira página V2 efetivamente importada e renderizada.
// O propósito desta versão é provar que a infraestrutura das PRs
// anteriores (typography, version toggle, ErrorBoundary, paleta HYPR)
// está funcionando antes do conteúdo real começar a ser construído
// na Fase 2.
//
// ──────────────────────────────────────────────────────────────────────
// O QUE ESTE STUB FAZ
// ──────────────────────────────────────────────────────────────────────
// 1. Importa typography.js — primeira vez que isso acontece, o que
//    valida que o tree-shaking do Vite passa a incluir os arquivos
//    .woff2 da Urbanist no bundle quando há consumidor real
// 2. Aplica a paleta HYPR oficial (canvas #1C262F + signature #3397B9)
// 3. Mostra um botão "Voltar à versão atual" que persiste 'legacy' no
//    localStorage e recarrega — exatamente o mesmo fluxo do
//    ErrorBoundary, validando que a rota de fuga funciona
// 4. Exibe os props recebidos (token, isAdmin) para confirmar que o
//    roteamento do App.jsx está passando as informações corretas
//
// ──────────────────────────────────────────────────────────────────────
// SUBSTITUIÇÃO NA FASE 2
// ──────────────────────────────────────────────────────────────────────
// Na Fase 2, este arquivo passa a renderizar o ClientDashboard V2 real
// (com tabs, dados, filtros, etc). O stub é descartado. O contrato com
// App.jsx (props: token, isAdmin, adminJwt) permanece o mesmo.

import { setReportVersion } from "../../shared/version";
import { FONT_FAMILY } from "../../ui/typography";

export default function ClientDashboardV2({ token, isAdmin /*, adminJwt */ }) {
  const goLegacy = () => {
    setReportVersion("legacy");
    // Remove ?v= da URL para que o reload não force V2 de novo via
    // prioridade do query param.
    const url = new URL(window.location.href);
    url.searchParams.delete("v");
    window.location.replace(url.toString());
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#1C262F", // canvas HYPR oficial
        color: "#fff",
        fontFamily: FONT_FAMILY,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          padding: "40px 32px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            borderRadius: 999,
            background: "rgba(51,151,185,0.15)",
            color: "#3397B9", // azul signature HYPR
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          Preview · V2
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.2,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Em construção
        </h1>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.7)",
            margin: 0,
            marginBottom: 32,
          }}
        >
          Esta é a próxima versão do dashboard de reports da HYPR. O
          conteúdo será construído nas próximas semanas. Por enquanto,
          a versão estável continua disponível.
        </p>

        <button
          type="button"
          onClick={goLegacy}
          style={{
            background: "#3397B9",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "background 120ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#246C84")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#3397B9")}
        >
          Voltar à versão atual
        </button>

        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12,
            color: "rgba(255,255,255,0.45)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            wordBreak: "break-all",
          }}
        >
          token: {token || "—"}
          <br />
          modo: {isAdmin ? "admin" : "cliente"}
        </div>
      </div>
    </div>
  );
}
