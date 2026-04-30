import { useState, useEffect, useMemo } from "react";
import { C } from "../../shared/theme";
import { listAliases, saveAlias, deleteAlias } from "../../lib/api";
import ModalShell from "./ModalShell";

/**
 * AliasesModal — admin gerencia apelidos de cliente.
 *
 * Para que serve
 * --------------
 * Quando uma campanha nova chega com `client_name = "RD"` e a planilha de
 * De-Para tem "Raia Drogasil", o match automático falha porque os nomes
 * não compartilham raiz textual. A normalização padrão (caixa, acentos,
 * artigos PT-BR, sufixos corporativos) já resolve "LOREAL" = "L'Oréal" e
 * "BOTICARIO" = "O Boticário", mas não cobre abreviações arbitrárias —
 * essa tabela manual é o escape hatch.
 *
 * Props
 * -----
 *  - clientNames: lista opcional de client_names únicos das campanhas (vem
 *    do menu admin). Usada como datalist nos inputs pra acelerar digitação.
 *  - onClose: callback de fechar
 *  - onChanged: callback após salvar/remover (pra menu refetch a lista
 *    de campanhas e re-renderizar com owners atualizados)
 *  - theme: { text, muted, modalBdr, inputBg, modalBg }
 */
const AliasesModal = ({ clientNames = [], onClose, onChanged, theme }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aliasInput, setAliasInput] = useState("");
  const [canonicalInput, setCanonicalInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  const text     = theme?.text     || C.white;
  const muted    = theme?.muted    || C.muted;
  const modalBdr = theme?.modalBdr || C.dark3;
  const inputBg  = theme?.inputBg  || C.dark3;
  const modalBg  = theme?.modalBg  || C.dark2;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await listAliases();
      if (cancelled) return;
      setItems(data);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) =>
        (it.alias_raw || "").toLowerCase().includes(q) ||
        (it.canonical_raw || "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  const handleSave = async () => {
    setError("");
    const alias = aliasInput.trim();
    const canonical = canonicalInput.trim();
    if (!alias || !canonical) {
      setError("Preencha apelido e nome canônico.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveAlias({ alias, canonical });
      const saved = res.alias;
      // Substitui se já existia, senão append
      setItems((prev) => {
        const idx = prev.findIndex((it) => it.alias_normalized === saved.alias_normalized);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = saved;
          return copy.sort(byCanonical);
        }
        return [...prev, saved].sort(byCanonical);
      });
      setAliasInput("");
      setCanonicalInput("");
      onChanged?.();
    } catch (e) {
      setError(e.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (alias) => {
    if (!confirm(`Remover o apelido "${alias.alias_raw}" → "${alias.canonical_raw}"?`)) return;
    try {
      await deleteAlias(alias.alias_raw);
      setItems((prev) => prev.filter((it) => it.alias_normalized !== alias.alias_normalized));
      onChanged?.();
    } catch (e) {
      alert("Erro ao remover: " + e.message);
    }
  };

  return (
    <ModalShell onClose={onClose} maxWidth={720} maxHeight="85vh" theme={theme}>
      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: text }}>
        🔗 Apelidos de Cliente
      </h2>
      <p style={{ color: muted, fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
        Conecta variações de nome (ex.: <strong>RD</strong> → <strong>Raia Drogasil</strong>) à grafia canônica usada no De-Para Comercial.
      </p>
      <p style={{ color: muted, fontSize: 12, marginBottom: 22, lineHeight: 1.5 }}>
        Casos como <em>LOREAL</em> = <em>L'Oréal</em> e <em>BOTICARIO</em> = <em>O Boticário</em> já são resolvidos automaticamente — só cadastre apelidos quando a normalização de caixa/acentos não basta.
      </p>

      {/* Form de criação ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: inputBg,
          border: `1px solid ${modalBdr}`,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "end" }}>
          <div>
            <label style={labelStyle(muted)}>Apelido (como vem da campanha)</label>
            <input
              type="text"
              list="aliases-client-names"
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value)}
              placeholder="ex.: RD"
              style={inputStyle(modalBg, modalBdr, text)}
            />
          </div>
          <div style={{ paddingBottom: 10, color: muted, fontSize: 18 }}>→</div>
          <div>
            <label style={labelStyle(muted)}>Canônico (como está no De-Para)</label>
            <input
              type="text"
              list="aliases-client-names"
              value={canonicalInput}
              onChange={(e) => setCanonicalInput(e.target.value)}
              placeholder="ex.: Raia Drogasil"
              style={inputStyle(modalBg, modalBdr, text)}
            />
          </div>
        </div>
        <datalist id="aliases-client-names">
          {clientNames.map((n) => (<option key={n} value={n} />))}
        </datalist>
        {error && (
          <div style={{ color: "#FF6B6B", fontSize: 12, marginTop: 10 }}>{error}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving || !aliasInput.trim() || !canonicalInput.trim()}
            style={{
              background: C.blue, color: C.white, border: "none",
              padding: "10px 18px", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontWeight: 700, opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Salvando..." : "+ Adicionar apelido"}
          </button>
        </div>
      </div>

      {/* Lista de existentes ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: text, textTransform: "uppercase", letterSpacing: 1 }}>
          Apelidos cadastrados
          <span style={{ color: muted, fontWeight: 500, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
            ({items.length})
          </span>
        </h3>
        {items.length > 0 && (
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar..."
            style={{ ...inputStyle(modalBg, modalBdr, text), width: 180, padding: "6px 10px", fontSize: 12 }}
          />
        )}
      </div>

      <div style={{ border: `1px solid ${modalBdr}`, borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 24, color: muted, fontSize: 13, textAlign: "center" }}>Carregando…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, color: muted, fontSize: 13, textAlign: "center" }}>
            Nenhum apelido cadastrado ainda.
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: 24, color: muted, fontSize: 13, textAlign: "center" }}>
            Nenhum apelido bate com o filtro.
          </div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {filteredItems.map((it) => (
              <div
                key={it.alias_normalized}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr auto",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 14px",
                  borderBottom: `1px solid ${modalBdr}`,
                  fontSize: 13,
                }}
              >
                <span style={{ color: text, fontWeight: 600 }}>{it.alias_raw}</span>
                <span style={{ color: muted }}>→</span>
                <span style={{ color: text }}>{it.canonical_raw}</span>
                <button
                  onClick={() => handleDelete(it)}
                  title="Remover apelido"
                  style={{
                    background: "transparent",
                    color: muted,
                    border: `1px solid ${modalBdr}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22 }}>
        <button
          onClick={onClose}
          style={{
            background: inputBg, color: text,
            border: `1px solid ${modalBdr}`, padding: "10px 18px", borderRadius: 8,
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}
        >
          Fechar
        </button>
      </div>
    </ModalShell>
  );
};

const byCanonical = (a, b) => {
  const ca = (a.canonical_raw || "").toLowerCase();
  const cb = (b.canonical_raw || "").toLowerCase();
  if (ca !== cb) return ca < cb ? -1 : 1;
  const aa = (a.alias_raw || "").toLowerCase();
  const ab = (b.alias_raw || "").toLowerCase();
  return aa < ab ? -1 : aa > ab ? 1 : 0;
};

const labelStyle = (muted) => ({
  display: "block",
  fontSize: 11,
  color: muted,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 1,
  marginBottom: 6,
});

const inputStyle = (bg, bdr, color) => ({
  width: "100%",
  background: bg,
  border: `1px solid ${bdr}`,
  borderRadius: 8,
  padding: "10px 12px",
  color,
  fontSize: 14,
  outline: "none",
});

export default AliasesModal;
