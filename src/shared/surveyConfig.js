// Parser unificado do `survey_data` salvo no BigQuery. O blob é uma
// string JSON com 3 formas históricas possíveis:
//
//   1. Legacy CSV — objeto único `{ nome, control_total, exposed_total,
//      questions: [{label, control, exposed}] }`. Pré-Typeform, mantido
//      pra retrocompat (demo report ainda usa).
//
//   2. v1 (Typeform sem range) — array `[{nome, ctrlUrl, expUrl,
//      ctrlFormId?, expFormId?, focusRow?}]`. Foi o formato padrão até
//      a introdução do `clientRange`.
//
//   3. v2 (Typeform com clientRange) — objeto
//      `{ version: 2, questions: [...itens v1...], clientRange: {from,to}|null }`.
//      Permite o admin escolher um período pra exibir ao cliente sem
//      afetar a visão de inspeção interna.
//
// Esta função normaliza pra `{ questions, clientRange, isLegacyCsv,
// legacyObject }` — chamadores não precisam saber o shape original.
//
// Devolve `null` se o JSON for inválido ou estiver vazio.

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeRange(r) {
  if (!r || typeof r !== "object") return null;
  const from = typeof r.from === "string" && YMD_RE.test(r.from) ? r.from : null;
  const to = typeof r.to === "string" && YMD_RE.test(r.to) ? r.to : null;
  if (!from || !to) return null;
  // from > to é inconsistente — descarta o range em vez de propagar erro
  if (from > to) return null;
  return { from, to };
}

export function parseSurveyConfig(jsonString) {
  if (!jsonString) return null;
  let parsed;
  try {
    parsed = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
  } catch {
    return null;
  }
  if (!parsed) return null;

  // v2: objeto com `version: 2` + questions array
  if (
    !Array.isArray(parsed) &&
    parsed.version === 2 &&
    Array.isArray(parsed.questions)
  ) {
    return {
      questions: parsed.questions,
      clientRange: normalizeRange(parsed.clientRange),
      isLegacyCsv: false,
      legacyObject: null,
    };
  }

  // v1: array de questions Typeform
  if (Array.isArray(parsed)) {
    return {
      questions: parsed,
      clientRange: null,
      isLegacyCsv: false,
      legacyObject: null,
    };
  }

  // Legacy CSV (objeto único com .questions de label/control/exposed)
  if (parsed && Array.isArray(parsed.questions)) {
    return {
      questions: null,
      clientRange: null,
      isLegacyCsv: true,
      legacyObject: parsed,
    };
  }

  return null;
}

// Serializa de volta pro storage. Se há clientRange válido, salva em v2;
// senão salva em v1 (array puro) pra preservar compat com qualquer leitor
// antigo que ainda assuma array.
export function serializeSurveyConfig(questions, clientRange) {
  const range = normalizeRange(clientRange);
  if (range) {
    return JSON.stringify({ version: 2, questions, clientRange: range });
  }
  return JSON.stringify(questions);
}
