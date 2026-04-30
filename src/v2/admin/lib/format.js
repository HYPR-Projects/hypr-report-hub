// src/v2/admin/lib/format.js
//
// Formatadores compartilhados pelo admin V2. Todos os helpers aqui são
// puros (input → output, sem side effects), pra serem testáveis e
// reusáveis em qualquer componente.

/**
 * Tempo relativo curto em PT-BR.
 * "há 2h" / "há 5d" / "há 1mês" / "agora"
 *
 * Usa Intl.RelativeTimeFormat quando disponível pra granularidade
 * automática. Fallback para parse manual em browsers antigos.
 */
const RTF = typeof Intl !== "undefined" && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto", style: "narrow" })
  : null;

export function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const then = new Date(timestamp);
  if (isNaN(then.getTime())) return "";
  const now = new Date();
  const diffSec = Math.round((then.getTime() - now.getTime()) / 1000);

  const absSec = Math.abs(diffSec);
  if (absSec < 60) return "agora";

  if (RTF) {
    if (absSec < 3600)     return RTF.format(Math.round(diffSec / 60),    "minute");
    if (absSec < 86400)    return RTF.format(Math.round(diffSec / 3600),  "hour");
    if (absSec < 86400 * 30) return RTF.format(Math.round(diffSec / 86400), "day");
    if (absSec < 86400 * 365) return RTF.format(Math.round(diffSec / (86400 * 30)), "month");
    return RTF.format(Math.round(diffSec / (86400 * 365)), "year");
  }

  // Fallback simples
  if (absSec < 3600)     return `há ${Math.round(absSec / 60)}min`;
  if (absSec < 86400)    return `há ${Math.round(absSec / 3600)}h`;
  if (absSec < 86400 * 30) return `há ${Math.round(absSec / 86400)}d`;
  return `há ${Math.round(absSec / (86400 * 30))}mês`;
}

/**
 * "115%" / "—"  (preserva ausência sem confundir com zero).
 */
export function formatPct(value, decimals = 0) {
  if (value == null || isNaN(value)) return "—";
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Cores condicionais por métrica.
 *
 * Régua única definida pela operação:
 *   Pacing  (DSP/VID): <90 vermelho · 90–99 amarelo · 100–124 verde · ≥125 azul
 *   CTR              : <0.50 vermelho · 0.50–0.64 amarelo · ≥0.65 verde
 *   VTR              : <70 vermelho · 70–79 amarelo · ≥80 verde
 *
 * Verde e azul são ambos estados saudáveis; azul sinaliza over-delivery
 * relevante (≥125%) que merece destaque visual diferente do "no alvo".
 *
 * Sem dado → cinza sutil (não polui visualmente).
 */
export function pacingColorClass(pacing) {
  if (pacing == null || isNaN(pacing)) return "text-fg-subtle";
  if (pacing < 90)  return "text-danger";
  if (pacing < 100) return "text-warning";
  if (pacing < 125) return "text-success";
  return "text-signature";
}

export function ctrColorClass(ctr) {
  if (ctr == null || isNaN(ctr)) return "text-fg-subtle";
  if (ctr < 0.50) return "text-danger";
  if (ctr < 0.65) return "text-warning";
  return "text-success";
}

export function vtrColorClass(vtr) {
  if (vtr == null || isNaN(vtr)) return "text-fg-subtle";
  if (vtr < 70) return "text-danger";
  if (vtr < 80) return "text-warning";
  return "text-success";
}

/**
 * Régua de cor do eCPM real (admin).
 *
 * IMPORTANTE — semântica INVERTIDA das outras métricas:
 *   pacing/CTR/VTR: maior = melhor
 *   eCPM:           MENOR = melhor (custo por mil mais eficiente,
 *                                   = mais margem)
 *
 * Tiers (em R$):
 *   < 0,70   verde   (abaixo do alvo — ótima margem)
 *   0,70–0,80  amarelo (atenção — perto do teto)
 *   ≥ 0,80   vermelho (acima do alvo — margem comprimida)
 *
 * Sem dado → cinza sutil. Thresholds definidos junto com a operação;
 * ajustar aqui se a régua mudar (única fonte da verdade pro front).
 */
export function ecpmColorClass(ecpm) {
  if (ecpm == null || isNaN(ecpm)) return "text-fg-subtle";
  if (ecpm < 0.70) return "text-success";
  if (ecpm < 0.80) return "text-warning";
  return "text-danger";
}

/**
 * Variante de cor de FUNDO pastelíssima pro eCPM. Usa tokens base
 * (success/warning/danger) com alpha curta (/8 a /12) — bem mais
 * sutil que os tokens *-soft (alpha 0.15) que pesavam visualmente.
 *
 * Calibragem por tier:
 *   verde/vermelho:  /8  (8% alpha — quase imperceptível, só dá um tom)
 *   amarelo:         /12 (saturação do warning é mais baixa, precisa um
 *                         pouco mais de alpha pra não sumir contra fundo)
 *
 * Usado no card admin (Por mês + Por cliente) pra sinalizar saúde
 * via tint do box em vez do texto — mais minimalista, deixa o número
 * neutro pra leitura limpa.
 *
 * Mesma régua de tiers do `ecpmColorClass`. Sem dado / sem dinheiro
 * → bg-surface neutro (não polui visualmente).
 */
export function ecpmBgClass(ecpm) {
  if (ecpm == null || isNaN(ecpm)) return "bg-surface";
  if (ecpm < 0.70) return "bg-success/8";
  if (ecpm < 0.80) return "bg-warning/12";
  return "bg-danger/8";
}

/**
 * Campanha encerrada = data final estritamente menor que hoje (timezone
 * local do usuário). Usado pra "esmaecer" cards e tirar a cor condicional
 * — uma vez encerrada, a métrica vira histórico e não precisa mais
 * alarmar visualmente.
 *
 * Aceita YYYY-MM-DD direto do backend. Para evitar o mesmo bug de
 * timezone que tinha em `formatDateRange`, comparamos via getUTCDate
 * comparado com a data local de hoje convertida pra UTC midnight.
 */
export function isCampaignEnded(endISO) {
  if (!endISO) return false;
  const e = new Date(endISO);
  if (isNaN(e.getTime())) return false;
  const now = new Date();
  // Hoje à meia-noite UTC, pra comparar com end_date que veio como
  // YYYY-MM-DD (UTC midnight). Encerrada se end < hoje.
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return e.getTime() < todayUTC;
}

/**
 * Display de pacing curto. Acima de 999% mostra "999%+" pra evitar
 * estouro de layout (caso raro mas existe — backfill de delivery).
 */
export function formatPacingValue(pacing) {
  if (pacing == null) return "—";
  if (pacing > 999) return "999%+";
  return `${Math.round(pacing)}%`;
}

/**
 * Mês/ano formatado a partir de YYYY-MM-DD. Usado pra labels de
 * agrupamento mensal e quick-filter pills.
 *
 * "2026-04-15" → "Abril de 2026" (long) ou "Abr 26" (short)
 */
const MONTH_LONG  = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export function formatMonthLabel(yyyymm, variant = "long") {
  if (!yyyymm) return "";
  const [y, m] = String(yyyymm).split("-").map(Number);
  if (!y || !m) return "";
  if (variant === "short") return `${MONTH_SHORT[m - 1]} ${String(y).slice(-2)}`;
  return `${MONTH_LONG[m - 1]} de ${y}`;
}

/**
 * Date range curto: "01/04 → 30/04" (mesmo ano omite ano), "01/12/25 → 15/01/26"
 */
export function formatDateRange(startISO, endISO) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  // Usa getters UTC porque o backend manda "YYYY-MM-DD" puro, que o JS parseia
  // como UTC midnight. Em fusos negativos (BRT = UTC-3) os getters locais
  // jogam a data um dia para trás.
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const sd = String(s.getUTCDate()).padStart(2, "0");
  const sm = String(s.getUTCMonth() + 1).padStart(2, "0");
  const ed = String(e.getUTCDate()).padStart(2, "0");
  const em = String(e.getUTCMonth() + 1).padStart(2, "0");
  if (sameYear) return `${sd}/${sm} → ${ed}/${em}`;
  const sy = String(s.getUTCFullYear()).slice(-2);
  const ey = String(e.getUTCFullYear()).slice(-2);
  return `${sd}/${sm}/${sy} → ${ed}/${em}/${ey}`;
}

/**
 * Email → display name curto. "joao.buzolin@hypr.mobi" → "joao.buzolin".
 * Usado quando não temos o nome cadastrado mas precisa exibir alguém.
 */
export function localPartFromEmail(email) {
  if (!email) return "";
  const idx = email.indexOf("@");
  return idx > 0 ? email.slice(0, idx) : email;
}

/**
 * Formatter de moeda BRL. Cacheado em module scope porque
 * `Intl.NumberFormat` custa ~1ms na primeira chamada por locale —
 * vale reusar a instância em vez de criar a cada render.
 *
 * Usado pra exibir eCPM real (admin) nos cards do menu.
 *   formatBRL(1.2)     → "R$ 1,20"
 *   formatBRL(12.45)   → "R$ 12,45"
 *   formatBRL(null)    → "—"
 */
const _BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export function formatBRL(value) {
  if (value == null || isNaN(value)) return "—";
  return _BRL.format(Number(value));
}

/**
 * "kenvue" → "Kenvue", "coca-cola-brasil" → "Coca Cola Brasil"
 * Usado em fallbacks quando display_name não veio do backend.
 */
export function slugToDisplay(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
