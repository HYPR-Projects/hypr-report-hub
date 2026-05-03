// src/components/RouteSuspense.jsx
//
// Wrapper de <Suspense> usado pelas rotas lazy-loaded em App.jsx.
//
// Por que existe um fallback dedicado (em vez de inline)
//   1. As rotas lazy carregam módulos que importam estilos diferentes
//      — Login/CampaignMenu/ClientDashboard usam estilos inline +
//      GlobalStyle (Legacy), enquanto ClientDashboardV2 importa v2.css
//      (Tailwind). Esse fallback NÃO pode depender de Tailwind, porque
//      durante o load inicial do V2, o v2.css ainda não foi parseado.
//   2. Centralizar evita inconsistência visual entre fallbacks de
//      rotas diferentes.
//
// Tema dark/light
// ───────────────
// Lê `data-theme` do <html> (setado sincrono pelo anti-FOUC inline em
// index.html ANTES do React montar — sempre presente). Aplica fundo
// equivalente a `--color-canvas` do tema correspondente. MutationObserver
// cobre o caso raro de troca de tema enquanto o loading tá visível.
//
// As cores são hex literais (em vez de CSS vars) porque o caller pode
// estar antes do v2.css ter sido parseado — não dá pra confiar em
// `var(--color-canvas)` resolver.

import { useEffect, useState } from "react";
import Spinner from "./Spinner";

const BG_BY_THEME = {
  dark:  "#1C262F", // = --color-canvas (dark)
  light: "#F8F9FA", // = --color-canvas (light)
};

function readTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") || "dark";
}

export default function RouteSuspense() {
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

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BG_BY_THEME[theme] || BG_BY_THEME.dark,
      }}
    >
      <Spinner size={36} />
    </div>
  );
}
