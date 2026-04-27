import { useState } from "react";
import { C } from "../../shared/theme";
import { saveSurvey as saveSurveyApi } from "../../lib/api";
import ModalShell from "./ModalShell";

/**
 * Modal pra configurar surveys (controle vs. exposto) via links públicos do
 * Typeform. Suporta N perguntas — admin pode adicionar/remover blocos.
 *
 * Props
 * -----
 * - `shortToken`: string da campanha;
 * - `onClose`, `onSaved`: callbacks pro pai;
 * - `theme`: cores derivadas do isDark.
 *
 * Schema do bloco
 * ---------------
 * { nome, ctrlUrl, expUrl, focusRow? }
 *
 * focusRow é opcional — só aplica a forms tipo matrix (detectado automaticamente
 * via API do Typeform). Quando preenchido, destaca a linha visualmente no
 * SurveyTab.
 */
const EMPTY_BLOCK = { nome: "", ctrlUrl: "", expUrl: "", focusRow: "" };

const SurveyModal = ({ shortToken, onClose, onSaved, theme }) => {
  const [blocks, setBlocks] = useState([{ ...EMPTY_BLOCK }]);
  const [saving, setSaving] = useState(false);

  const text     = theme?.text     || C.white;
  const muted    = theme?.muted    || C.muted;
  const modalBdr = theme?.modalBdr || C.dark3;
  const inputBg  = theme?.inputBg  || C.dark3;

  const handleClose = () => {
    setBlocks([{ ...EMPTY_BLOCK }]);
    if (onClose) onClose();
  };

  const updateBlock = (idx, patch) =>
    setBlocks(b => b.map((bl, i) => i === idx ? { ...bl, ...patch } : bl));

  const removeBlock = (idx) =>
    setBlocks(b => b.filter((_, i) => i !== idx));

  const addBlock = () =>
    setBlocks(b => [...b, { ...EMPTY_BLOCK }]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validação: todos os campos obrigatórios preenchidos
      for (const b of blocks) {
        if (!b.ctrlUrl.trim() || !b.expUrl.trim()) {
          alert("Preencha os dois links em todas as perguntas.");
          setSaving(false);
          return;
        }
        if (!b.nome.trim()) {
          alert("Preencha o nome de todas as perguntas.");
          setSaving(false);
          return;
        }
      }
      const payload = blocks.map(b => {
        const out = { nome: b.nome.trim(), ctrlUrl: b.ctrlUrl.trim(), expUrl: b.expUrl.trim() };
        if (b.focusRow && b.focusRow.trim()) out.focusRow = b.focusRow.trim();
        return out;
      });
      await saveSurveyApi({ short_token: shortToken, survey_data: JSON.stringify(payload) });
      alert("Survey salvo com sucesso!");
      setBlocks([{ ...EMPTY_BLOCK }]);
      if (onSaved) onSaved();
    } catch {
      alert("Erro ao salvar survey.");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = (highlighted = false) => ({
    width: "100%", background: inputBg,
    border: `1px solid ${highlighted ? C.blue + "60" : modalBdr}`,
    borderRadius: 7, padding: "9px 12px", color: text, fontSize: 12,
    outline: "none", fontFamily: "monospace",
  });

  return (
    <ModalShell onClose={handleClose} theme={theme} maxWidth={540} padding={32} maxHeight="90vh">
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: text }}>📋 Configurar Survey</h2>
      <p style={{ color: muted, fontSize: 14, marginBottom: 6 }}>
        Links públicos do Typeform para <strong>{shortToken}</strong>.
      </p>
      <p style={{ color: muted, fontSize: 12, marginBottom: 20, lineHeight: 1.6 }}>
        Cole a URL pública de cada form do Typeform (uma para o grupo controle, outra para o exposto).<br/>
        No Typeform: <span style={{ color: C.blue }}>Share → Copiar link público</span>. As respostas atualizam automaticamente.
      </p>

      {blocks.map((block, idx) => (
        <div key={idx} style={{ border: `1px solid ${modalBdr}`, borderRadius: 10, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: 1 }}>
              Pergunta {idx + 1}
            </div>
            {blocks.length > 1 && (
              <button
                onClick={() => removeBlock(idx)}
                style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0 }}
              >×</button>
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>Nome da pergunta</div>
            <input
              value={block.nome}
              onChange={e => updateBlock(idx, { nome: e.target.value })}
              placeholder="Ex: Ad Recall, Awareness — SP..."
              style={{
                width: "100%", background: inputBg, border: `1px solid ${modalBdr}`,
                borderRadius: 7, padding: "9px 12px", color: text, fontSize: 13, outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>Link Typeform — Grupo Controle</div>
            <input
              value={block.ctrlUrl}
              onChange={e => updateBlock(idx, { ctrlUrl: e.target.value })}
              placeholder="https://hypr-mobi.typeform.com/to/..."
              style={inputStyle(!!block.ctrlUrl)}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>Link Typeform — Grupo Exposto</div>
            <input
              value={block.expUrl}
              onChange={e => updateBlock(idx, { expUrl: e.target.value })}
              placeholder="https://hypr-mobi.typeform.com/to/..."
              style={inputStyle(!!block.expUrl)}
            />
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${modalBdr}` }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>
              Marca-foco para destaque <span style={{ opacity: 0.6 }}>(opcional)</span>
            </div>
            <input
              value={block.focusRow || ""}
              onChange={e => updateBlock(idx, { focusRow: e.target.value })}
              placeholder="Ex: Heineken — destaca essa linha visualmente"
              style={{
                width: "100%", background: inputBg,
                border: `1px solid ${block.focusRow ? C.blue+"60" : modalBdr}`,
                borderRadius: 7, padding: "9px 12px", color: text, fontSize: 13, outline: "none",
              }}
            />
            <div style={{ fontSize: 11, color: muted, marginTop: 6, lineHeight: 1.5, opacity: 0.85 }}>
              O tipo da pergunta (choice ou matrix) é detectado automaticamente pela API do Typeform. Se for matrix, a marca digitada acima fica em destaque visual no relatório.
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addBlock}
        style={{
          width: "100%", background: "none", border: `1px dashed ${modalBdr}`,
          color: C.blue, borderRadius: 8, padding: "10px 0", cursor: "pointer",
          fontSize: 13, fontWeight: 600, marginBottom: 16,
        }}
      >
        + Adicionar pergunta
      </button>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={handleClose}
          style={{
            flex: 1, background: inputBg, color: muted,
            border: `1px solid ${modalBdr}`, padding: 12, borderRadius: 8,
            cursor: "pointer", fontSize: 14,
          }}
        >
          Cancelar
        </button>
        <button
          disabled={saving}
          onClick={handleSave}
          style={{
            flex: 2, background: C.blue, color: C.white, border: "none",
            padding: 12, borderRadius: 8, cursor: "pointer",
            fontSize: 14, fontWeight: 700, opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "Salvando..." : `✓ Salvar ${blocks.length > 1 ? blocks.length + " perguntas" : "Survey"}`}
        </button>
      </div>
    </ModalShell>
  );
};

export default SurveyModal;
