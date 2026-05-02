/**
 * UI preferences helpers (localStorage).
 *
 * Persistem preferências visuais do usuário entre sessões. Diferente do
 * auth, não têm TTL — o usuário escolheu, fica salvo até trocar.
 *
 * Nota: a preferência de tema vive em `src/v2/hooks/useTheme.js` (key
 * `hypr_theme`, lida também pelo script anti-FOUC em index.html).
 */

const LS_OWNER_FILTER_KEY = "hypr.ownerFilter";

/**
 * Retorna o email do owner selecionado pelo admin no menu, ou ""
 * se nenhum filtro estiver ativo.
 */
export function getOwnerFilter() {
  try {
    return localStorage.getItem(LS_OWNER_FILTER_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Persiste o owner selecionado. Passar "" remove o filtro.
 */
export function setOwnerFilter(email) {
  try {
    if (email) localStorage.setItem(LS_OWNER_FILTER_KEY, email);
    else localStorage.removeItem(LS_OWNER_FILTER_KEY);
  } catch {
    /* ignore */
  }
}
