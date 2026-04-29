// src/shared/version.js
//
// Toggle de versão Legacy ↔ V2 do HYPR Report Hub.
//
// ──────────────────────────────────────────────────────────────────────
// COMPORTAMENTO ATUAL (V2 default)
// ──────────────────────────────────────────────────────────────────────
// useReportVersion() está ATIVO. O default é 'v2' — todo cliente que
// abre /report/* sem flag específica recebe a interface nova.
// Legacy continua disponível como rede de proteção:
//   - O V2ErrorBoundary persiste 'legacy' no localStorage e recarrega
//     quando captura crash do V2.
//   - Opt-out manual via ?v=legacy na URL (persiste no localStorage).
//
// Killar a Legacy de vez é um passo separado, pra ser feito depois de
// algum tempo sem incidentes de v2_crash no GA.
//
// ──────────────────────────────────────────────────────────────────────
// PRIORIDADE DE RESOLUÇÃO
// ──────────────────────────────────────────────────────────────────────
// 1. Query param  ?v=v2     → força V2 (e persiste no localStorage)
//    Query param  ?v=legacy → força Legacy (e persiste no localStorage,
//                             usado pelo ErrorBoundary)
// 2. localStorage  hypr_report_version   → respeita escolha anterior
// 3. Fallback     → 'v2'
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
  // Fallback é 'v2' — interface padrão. Legacy permanece acessível via
  // ?v=legacy ou pela escrita automática do V2ErrorBoundary em caso de
  // crash. Quando killarmos a Legacy de vez, este fallback continua
  // 'v2' e os ramos de Legacy somem do App.jsx.
  return fromUrl || fromStorage || "v2";
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
