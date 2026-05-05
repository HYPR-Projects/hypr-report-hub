// src/components/modals/SimpleUploadModal.jsx
//
// Modal genérico de upload de Excel/CSV usado pelas abas que ainda não
// foram migradas pro fluxo "rico" (com filtros) do RmndUploadModal —
// hoje, PDOOH. Mantém o parsing legado idêntico ao do UploadTab pra não
// quebrar nada que cliente já dependa.

import { useRef, useState } from "react";
import { C } from "../../shared/theme";
import { useXlsx } from "../../shared/useXlsx";
import { saveUpload } from "../../lib/api";
import ModalShell from "./ModalShell";
import { toast } from "../../lib/toast";
import { fmt } from "../../shared/format";

const SimpleUploadModal = ({
  shortToken,
  type,           // "PDOOH" | "RMND" | …
  existing,
  adminJwt,
  onClose,
  onSaved,
  theme,
  description,
}) => {
  const XLSX = useXlsx();
  const fileRef = useRef();
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed]   = useState(null);  // { rows, headers, fileName }
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const text     = theme?.text     || C.white;
  const muted    = theme?.muted    || C.muted;
  const modalBdr = theme?.modalBdr || C.dark3;
  const inputBg  = theme?.inputBg  || C.dark3;
  const cardBg   = theme?.modalBg  || C.dark2;

  const pick = () => fileRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !XLSX) return;
    setParsing(true);
    setError("");
    try {
      const ab  = await file.arrayBuffer();
      const wb  = XLSX.read(ab);
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
      let headerIdx = 0;
      for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        if (row && row.some(c => typeof c === "string" && (c.toUpperCase().includes("DATE") || c.toUpperCase().includes("CAMPAIGN")))) {
          headerIdx = i;
          break;
        }
      }
      const headers = raw[headerIdx].map(h => String(h || "").trim());
      const rows = raw.slice(headerIdx + 1)
        .filter(r => r && r[0])
        .map(r => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = r[i]; });
          return obj;
        });
      if (!rows.length) throw new Error("Nenhuma linha de dados foi reconhecida.");
      setParsed({ rows, headers, fileName: file.name });
    } catch (err) {
      setError(err.message || "Falha ao ler arquivo");
      setParsed(null);
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const payload = {
        type,
        rows: parsed.rows,
        headers: parsed.headers,
        uploadedAt: new Date().toISOString(),
      };
      await saveUpload({
        short_token: shortToken,
        type,
        data_json: JSON.stringify(payload),
        adminJwt,
      });
      try {
        localStorage.setItem(`hypr_${type.toLowerCase()}_${shortToken}`, JSON.stringify(payload));
      } catch { /* quota */ }
      toast.success(`Base ${type} de ${shortToken} salva`);
      if (onSaved) onSaved(payload);
    } catch (err) {
      toast.error(`Erro ao salvar ${type}: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const hasExisting = !!(existing?.rows?.length);

  return (
    <ModalShell onClose={onClose} theme={theme} maxWidth={520} padding={32}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: text }}>
        📂 Subir base {type}
      </h2>
      <p style={{ color: muted, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
        {description || `Suba a planilha de ${type} (.csv ou .xlsx) para `}
        <strong>{shortToken}</strong>.
      </p>

      {hasExisting && !parsed && (
        <div
          style={{
            background: `${C.blue}15`,
            border: `1px solid ${C.blue}40`,
            color: text,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          Base atual: {fmt(existing.rows.length)} linhas
          {existing.uploadedAt && <> · {new Date(existing.uploadedAt).toLocaleDateString("pt-BR")}</>}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      <button
        type="button"
        onClick={pick}
        disabled={!XLSX || parsing}
        style={{
          width: "100%",
          background: !XLSX ? inputBg : C.blue,
          color: !XLSX ? muted : "#fff",
          border: "none",
          padding: "14px 18px",
          borderRadius: 10,
          cursor: !XLSX || parsing ? "not-allowed" : "pointer",
          fontSize: 14,
          fontWeight: 700,
          opacity: !XLSX || parsing ? 0.6 : 1,
          marginBottom: 12,
        }}
      >
        {parsing ? "Lendo arquivo…" : !XLSX ? "Carregando biblioteca…" : parsed ? "📂 Trocar arquivo" : "📂 Selecionar arquivo (.csv / .xlsx)"}
      </button>

      {error && (
        <div
          style={{
            background: "#FFB95E20",
            border: "1px solid #FFB95E50",
            color: text,
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          ⚠ {error}
        </div>
      )}

      {parsed && (
        <div
          style={{
            border: `1px solid ${modalBdr}`,
            background: cardBg,
            borderRadius: 10,
            padding: 14,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: muted, marginBottom: 2 }}>Arquivo lido</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={parsed.fileName}
          >
            {parsed.fileName}
          </div>
          <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>
            {fmt(parsed.rows.length)} linhas · {parsed.headers.length} colunas
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            flex: 1,
            background: inputBg,
            color: muted,
            border: `1px solid ${modalBdr}`,
            padding: 12,
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!parsed || saving}
          onClick={handleSave}
          style={{
            flex: 2,
            background: C.blue,
            color: "#fff",
            border: "none",
            padding: 12,
            borderRadius: 8,
            cursor: !parsed || saving ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 700,
            opacity: !parsed || saving ? 0.5 : 1,
          }}
        >
          {saving ? "Salvando…" : "✓ Salvar base"}
        </button>
      </div>
    </ModalShell>
  );
};

export default SimpleUploadModal;
