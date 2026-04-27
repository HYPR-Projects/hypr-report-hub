import { C } from "../../shared/theme";

/**
 * Tab "VIDEO LOOM" — exibe o vídeo explicativo da campanha (gravado pela
 * equipe HYPR) num iframe responsivo. Se a campanha ainda não tem loom
 * cadastrado, mostra placeholder.
 *
 * Props
 * -----
 * - `loomUrl`: string com URL do tipo `https://www.loom.com/share/{id}`,
 *   ou null/undefined se não houver vídeo. Reescrita pra `/embed/` é feita
 *   aqui dentro pra manter o contrato simples no caller.
 */
const LoomTab = ({ loomUrl }) => {
  if (!loomUrl) {
    return (
      <div style={{ padding: "24px 0" }}>
        <div style={{ textAlign: "center", padding: 80, color: C.muted }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎥</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhum vídeo disponível ainda</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>O vídeo explicativo será adicionado em breve.</div>
        </div>
      </div>
    );
  }

  const embedUrl = loomUrl.replace("https://www.loom.com/share/", "https://www.loom.com/embed/");

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{
        background: C.dark2, border: `1px solid ${C.dark3}`, borderRadius: 12,
        overflow: "hidden", position: "relative", paddingTop: "56.25%",
      }}>
        <iframe
          src={embedUrl}
          frameBorder="0"
          allowFullScreen
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
          title="Loom explicativo"
        />
      </div>
    </div>
  );
};

export default LoomTab;
