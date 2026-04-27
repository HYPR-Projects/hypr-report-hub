import { C } from "../../shared/theme";

/**
 * ModalShell — overlay base que todos os modais do CampaignMenu compartilham.
 *
 * Responsabilidades:
 *  - renderiza o backdrop full-screen com fundo translúcido
 *  - intercepta cliques no backdrop pra fechar (ignora cliques no conteúdo)
 *  - aplica padding e centralização consistentes
 *  - aceita maxWidth e maxHeight customizados (Survey precisa de maxHeight + scroll)
 *
 * O conteúdo do modal vem como children. Cada modal cuida do próprio layout
 * interno, fields e botões.
 *
 * Props
 * -----
 *  - onClose: chamado quando o user clica no backdrop (cliques no conteúdo
 *    são ignorados via comparação target/currentTarget).
 *  - maxWidth: largura máxima do card interno (default 480).
 *  - maxHeight: opcional. Se passar, ativa scroll vertical interno.
 *  - padding: padding do card (default 40, mas SurveyModal usa 32).
 *  - theme: { modalBg, modalBdr } — fallback pro tema dark se ausente.
 */
const ModalShell = ({
  onClose,
  maxWidth = 480,
  maxHeight,
  padding = 40,
  theme,
  children,
}) => {
  const bg  = theme?.modalBg  || C.dark2;
  const bdr = theme?.modalBdr || C.dark3;

  const innerStyle = {
    background: bg,
    border: `1px solid ${bdr}`,
    borderRadius: 16,
    padding,
    width: "100%",
    maxWidth,
    ...(maxHeight ? { maxHeight, overflowY: "auto" } : null),
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000080",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fade-in" style={innerStyle}>
        {children}
      </div>
    </div>
  );
};

export default ModalShell;
