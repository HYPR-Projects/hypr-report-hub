export const fmt  = (n,d=0) => n==null?"—":Number(n).toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
export const fmtR = (n)     => n==null?"—":`R$ ${fmt(n,2)}`;
export const fmtP = (n)     => n==null?"—":`${fmt(n,1)}%`;
export const fmtP2= (n)     => n==null?"—":`${fmt(n,2)}%`;

// Formato compacto pra números grandes — usado quando o espaço aperta
// (ex: cards de Display e Video lado a lado). Mantém 1 casa decimal pra
// preservar precisão sem ocupar largura. Padrão "k/M/B" universal.
//   1.234     → "1,2k"
//   25.470    → "25,5k"
//   1.234.567 → "1,2M"
export const fmtCompact = (n) => {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs < 1000)            return fmt(n);
  if (abs < 1_000_000)       return `${fmt(n / 1_000,         1)}k`;
  if (abs < 1_000_000_000)   return `${fmt(n / 1_000_000,     1)}M`;
  return                            `${fmt(n / 1_000_000_000, 1)}B`;
};
