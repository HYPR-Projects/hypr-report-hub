// src/ui/typography.js
//
// Tipografia compartilhada Legacy ↔ V2.
//
// Carrega a Urbanist via @fontsource (self-hosted, sem CDN externo) em
// quatro pesos: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
//
// Cada arquivo CSS importado abaixo registra um @font-face com
// `font-display: swap` e `unicode-range` por subset — o browser só baixa
// os arquivos .woff2 dos subsets que realmente aparecem no conteúdo da
// página. Para PT-BR isso significa que apenas o subset "latin"
// (~12 KB por peso) é baixado em runtime.
//
// ──────────────────────────────────────────────────────────────────────
// COMPORTAMENTO NESTA PR (Fase 0, PR-02)
// ──────────────────────────────────────────────────────────────────────
// Este módulo NÃO É IMPORTADO em lugar nenhum nesta PR. Fica dormente,
// igual src/shared/tokens.js e src/shared/version.js. Tree-shaking do
// Vite garante que nem o JS nem os arquivos de fonte vão pro bundle
// final enquanto não houver uma importação efetiva.
//
// A primeira importação acontece na Fase 1 (Design System primitives),
// quando o V2 começar a usar a fonte.
//
// ──────────────────────────────────────────────────────────────────────
// USO PREVISTO (a partir da Fase 1)
// ──────────────────────────────────────────────────────────────────────
//   // No entry point do V2 (ex: src/v2/dashboards/ClientDashboardV2.jsx):
//   import "../../ui/typography";  // efeito colateral: registra @font-face
//   import { FONT_FAMILY } from "../../ui/typography";
//
//   // Em qualquer componente:
//   <div style={{ fontFamily: FONT_FAMILY }}>...</div>
//
//   // Ou via CSS variável (tokens.js vai consumir esta constante):
//   :root { --font-family-base: 'Urbanist', system-ui, sans-serif; }
//
// ──────────────────────────────────────────────────────────────────────
// POR QUE FONTSOURCE E NÃO GOOGLE FONTS CDN
// ──────────────────────────────────────────────────────────────────────
// • Self-hosted: sem dependência de fonts.gstatic.com em runtime
// • Cacheável pelo CDN do Vercel (cache-control: immutable, far-future)
// • Privacidade: zero round-trip pra Google a cada page load
// • Build determinístico: versão da fonte fica congelada no package.json
// • Tree-shaking: peso não importado = peso não baixado pelo cliente

import "@fontsource/urbanist/400.css";  // regular
import "@fontsource/urbanist/500.css";  // medium
import "@fontsource/urbanist/600.css";  // semibold
import "@fontsource/urbanist/700.css";  // bold

// Stack completo com fallbacks. Ordem dos fallbacks (em caso da Urbanist
// falhar em carregar):
//   1. system-ui            — fonte de sistema do OS (San Francisco / Segoe UI / Roboto)
//   2. -apple-system        — fallback explícito pra Safari iOS antigo
//   3. BlinkMacSystemFont   — fallback explícito pra Chrome no macOS
//   4. "Segoe UI"           — Windows
//   5. Roboto               — Android
//   6. sans-serif           — fallback genérico universal
//
// Os dois primeiros (system-ui e -apple-system) cobrem ~95% dos casos
// em runtime moderno. O resto é defesa em profundidade.
export const FONT_FAMILY =
  "'Urbanist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// Pesos disponíveis. Exportados como constantes nomeadas para uso
// type-safe em estilos (e como referência rápida pra dev novo no projeto).
export const FONT_WEIGHTS = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};
