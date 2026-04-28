// src/shared/version.js
//
// Toggle de versão Legacy ↔ V2 do HYPR Report Hub.
//
// ──────────────────────────────────────────────────────────────────────
// COMPORTAMENTO ATUAL (Fase 0, PR-03 em diante)
// ──────────────────────────────────────────────────────────────────────
// useReportVersion() está ATIVO e respeita a prioridade abaixo. O default
// continua sendo 'legacy' até a Fase 7 — o V2 só aparece quando o
// cliente trouxer ?v=v2 na URL ou já tiver `hypr_report_version=v2`
// persistido no localStorage de uma sessão anterior.
//
// ──────────────────────────────────────────────────────────────────────
// PRIORIDADE DE RESOLUÇÃO
// ──────────────────────────────────────────────────────────────────────
// 1. Query param  ?v=v2   → força V2 (e persiste no localStorage)
//    Query param  ?v=legacy → força Legacy (e persiste no localStorage)
// 2. localStorage  hypr_report_version   → respeita escolha anterior
// 3. Fallback     → 'legacy' (default seguro até a Fase 7)
//
// A Fase 7 inverte o fallback para 'v2', mantendo o opt-out via
// `?v=legacy` por mais alguns ciclos antes da remoção definitiva do
// Legacy.
//
// ──────────────────────────────────────────────────────────────────────
// CHAVE DO localStorage
// ──────────────────────────────────────────────────────────────────────
// Namespace `hypr_*` para evitar colisão com chaves de auth/prefs já
// existentes (ver src/shared/auth.js e src/shared/prefs.js).

const STORAGE_KEY = "hypr_report_version";
const VALID_VERSIONS = ["legacy", "v2"];

// Lê a versão solicitada via query param. Retorna null se ausente ou inválida.
function readFromUrl() {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get("v");
    return VALID_VERSIONS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

// Lê a versão persistida no localStorage. Retorna null se ausente ou inválida.
function readFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return VALID_VERSIONS.includes(v) ? v : null;
  } catch {
    // localStorage pode falhar em modo privado ou com cota cheia.
    return null;
  }
}

// Persiste a escolha de versão. Silenciosamente ignora falhas.
// Exportado para uso futuro pelo botão "Voltar ao Legacy" (Fase 2+).
export function setReportVersion(version) {
  if (!VALID_VERSIONS.includes(version)) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Sem-op em ambientes onde localStorage está bloqueado.
  }
}

// Resolve a versão segundo a regra de prioridade documentada acima.
// Exportado para chamadas síncronas fora de componentes React.
export function resolveReportVersion() {
  const fromUrl = readFromUrl();
  const fromStorage = readFromStorage();

  // Side-effect: se a URL trouxe ?v=, persiste para próximas navegações.
  // Mantido aqui (não no hook) para que chamadas síncronas também persistam.
  if (fromUrl) setReportVersion(fromUrl);

  // Prioridade: URL > localStorage > fallback.
  // Fallback é 'legacy' até a Fase 7 (default seguro). Quando a Fase 7
  // for executada, este fallback vira 'v2', mantendo opt-out via ?v=legacy.
  return fromUrl || fromStorage || "legacy";
}

// Hook React. Retorna a versão atual ('legacy' | 'v2').
//
// Não usa useState/useEffect porque a versão é estável durante o ciclo
// de vida da página: trocar versão recarrega a aplicação inteira (via
// mudança de URL ou via botão "Voltar ao Legacy" que vai forçar reload).
// Isso simplifica drasticamente o roteamento e elimina classes inteiras
// de bug com state preservado entre versões.
export function useReportVersion() {
  return resolveReportVersion();
}
