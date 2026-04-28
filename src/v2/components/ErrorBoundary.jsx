// src/v2/components/ErrorBoundary.jsx
//
// ErrorBoundary específico do V2.
//
// Captura erros de runtime em qualquer descendente do <ClientDashboardV2>,
// registra o ocorrido (console + Google Analytics existente), força a
// versão para 'legacy' no localStorage, e recarrega a página.
//
// ──────────────────────────────────────────────────────────────────────
// POR QUE FORÇAR LEGACY EM VEZ DE SÓ MOSTRAR FALLBACK UI
// ──────────────────────────────────────────────────────────────────────
// Mostrar uma fallback UI ("ops, algo deu errado") deixa o cliente
// olhando para uma mensagem de erro até decidir o que fazer. Forçar
// 'legacy' + reload coloca o cliente de volta numa interface
// funcional em ~500ms, sem ação manual. A persistência em localStorage
// garante que o crash não se repita na próxima visita — cliente fica
// no Legacy permanentemente até alguém intervir manualmente
// (?v=v2 na URL para tentar de novo).
//
// ──────────────────────────────────────────────────────────────────────
// COMO É RECONHECIDO COMO ERRO V2 NO GA
// ──────────────────────────────────────────────────────────────────────
// O evento disparado tem nome 'v2_crash' e parâmetros que permitem
// agrupar crashes recorrentes (mensagem do erro + nome do componente).
// No GA Dashboard: Reports → Engagement → Events → v2_crash.
//
// ──────────────────────────────────────────────────────────────────────
// LIMITAÇÕES CONHECIDAS DE ERRORBOUNDARY (React)
// ──────────────────────────────────────────────────────────────────────
// ErrorBoundary NÃO captura:
//   - Erros em event handlers (try/catch local resolve)
//   - Erros assíncronos (try/catch ou .catch resolve)
//   - Erros em SSR (não usamos SSR)
//   - Erros no próprio ErrorBoundary
//
// O suficiente para o caso de uso: erros de render do V2 (que são a
// classe mais grave — viram tela branca sem boundary).

import React from "react";
import { gaEvent } from "../../shared/analytics";
import { setReportVersion } from "../../shared/version";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    // Marca que houve erro. Render abaixo mostra mensagem provisória
    // enquanto o reload acontece (em <1s típico).
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 1. Console — para devs com DevTools aberto verem stack completo
    //    sem precisar abrir GA.
    console.error("[V2 ErrorBoundary] Crash capturado, voltando ao Legacy:", error, errorInfo);

    // 2. Google Analytics — telemetria leve para detectar volume
    //    anormal em produção. gaEvent é resiliente: se gtag não estiver
    //    carregado, vira no-op silencioso.
    try {
      gaEvent("v2_crash", {
        error_message: String(error?.message || error).slice(0, 200),
        error_name: error?.name || "Error",
        component_stack: String(errorInfo?.componentStack || "").slice(0, 500),
      });
    } catch {
      // Telemetria nunca pode quebrar o fallback. Engole qualquer erro
      // do próprio gaEvent.
    }

    // 3. Persistir 'legacy' no localStorage — cliente não cai no V2
    //    de novo na próxima visita até alguém forçar ?v=v2 na URL.
    try {
      setReportVersion("legacy");
    } catch {
      // setReportVersion já é resiliente, mas defesa em profundidade.
    }

    // 4. Reload — o ?v=v2 atual da URL precisa virar ?v=legacy ou
    //    sumir. Removemos o parâmetro 'v' explicitamente e recarregamos.
    //    Sem isso, o reload mantém ?v=v2 e o toggle prioriza URL sobre
    //    localStorage, então o cliente volta a cair no V2 quebrado.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("v");
      // replace em vez de assign pra não criar entrada no histórico
      // (evita cliente clicar "Voltar" e cair no V2 quebrado de novo).
      window.location.replace(url.toString());
    } catch {
      // Se URL API falhar (improvável em browsers modernos), reload
      // simples como último recurso.
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      // Mensagem mínima visível no instante entre captura e reload.
      // Tipicamente <500ms. Sem botão — o reload é automático.
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            background: "#1C262F",
            color: "#fff",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 14,
          }}
        >
          Carregando versão estável…
        </div>
      );
    }
    return this.props.children;
  }
}
