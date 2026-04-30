"""
Report owners — quem é responsável por cada report.

Modelo
------
Cada report tem dois owners HYPR:
  • CP (Commercial Person) — vendedor da conta.
  • CS (Customer Success)  — operador do report.

Os owners vêm de duas fontes, na ordem de precedência:

  1. Override manual (tabela `prod_assets.report_owners_overrides`)
     — admin clicou "Gerenciar Owner" no card e definiu manualmente.

  2. Lookup automático (primeira aba da planilha de De-Para Comercial,
     lida via Google Sheets API).
     — match por `client_name` (case-insensitive). Se houver múltiplos
     registros para o mesmo cliente (mesma cliente atendida por agências
     diferentes), o lookup retorna os emails apenas se forem TODOS iguais
     entre as linhas; do contrário, retorna NULL e cabe ao admin definir
     manualmente o override.

A segunda aba da planilha expõe a lista oficial de membros HYPR (CPs e
CSs com emails) para popular dropdowns no frontend.

Decisão de arquitetura
----------------------
Usamos Google Sheets API direto em vez de BigQuery external tables porque:
  • External tables exigem nome exato da aba (range "Sheet1!A:F"). A
    planilha está em PT-BR e usa "Página1"/"Página2" — nome que muda se
    alguém criar nova aba ou traduzir.
  • A Sheets API permite ler aba por ÍNDICE (primeira, segunda) — robusto
    contra rename. Pegamos os nomes das abas via spreadsheets.get e usamos
    pra montar os ranges.
  • Latência: ~150ms por request, mitigada por cache TTL de 60s.
  • Volume: ~280 linhas no lookup, ~11 no team. Cabe em memória.

Privacidade
-----------
Owners são dados internos da HYPR. Os endpoints expostos para clientes
(/report/<token>) NUNCA retornam emails de owner. Apenas o endpoint
admin `?list=true` (já protegido por JWT) traz essa informação.
"""

import os
import time
from typing import Dict, List, Optional, Tuple
from google.cloud import bigquery
from google.auth import default as google_auth_default
from googleapiclient.discovery import build as build_google_api


PROJECT_ID = os.environ.get("GCP_PROJECT", "site-hypr")
DATASET    = "prod_assets"
SHEET_ID   = "1nd6UtJJ5fA81D9VZRiH2ZJGHYsiiv28LPzXhNRtd2aM"

# Tabela física de overrides — única que usamos no BigQuery agora
TABLE_OVERRIDES = "report_owners_overrides"

# Cache global da planilha. Estrutura: {"data": dict | None, "ts": float}
#
# CACHE_TTL alto (5 min) porque a planilha de De-Para Comercial muda raras
# vezes por dia. Reduz exposição ao caminho de leitura remota — onde mora a
# falha intermitente que sumiu owners do menu admin.
#
# CACHE_STALE_MAX é o teto de aceitação do fallback "stale-while-error":
# se a Sheets API falhar e tivermos cache mais velho que isso, ainda assim
# servimos o stale (1h) em vez de dict vazio. Servir owner ligeiramente
# desatualizado é muito menos ruim que sumir avatares de toda a tela.
CACHE_TTL        = 300       # 5 min — vida útil do cache "fresco"
CACHE_STALE_MAX  = 3600      # 1h   — teto pra servir stale em caso de erro
SHEETS_RETRIES   = 1         # nº de retries antes de declarar falha
SHEETS_BACKOFF_S = 0.2       # espera entre retries
_sheet_cache: Dict[str, object] = {"data": None, "ts": 0.0}

bq = bigquery.Client()


def _full(table_name: str) -> str:
    return f"`{PROJECT_ID}.{DATASET}.{table_name}`"


def _sheets_client():
    """Cliente da Sheets API autenticado via Application Default Credentials.

    Na Cloud Function, ADC é a service account de runtime
    (453955675457-compute@developer.gserviceaccount.com), que já tem a
    planilha compartilhada. Não precisamos de JSON key.
    """
    creds, _ = google_auth_default(
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"]
    )
    return build_google_api("sheets", "v4", credentials=creds, cache_discovery=False)


def _fetch_sheet_data_remote() -> dict:
    """Faz a leitura efetiva da Google Sheets API. Sem cache, sem retry —
    é o "trabalho cru" chamado por `_load_sheet_data`. Pode levantar.
    """
    svc = _sheets_client().spreadsheets()

    # 1) Descobre os nomes das abas pra montar ranges robustos
    meta = svc.get(spreadsheetId=SHEET_ID, fields="sheets.properties.title").execute()
    sheets = meta.get("sheets", [])
    if len(sheets) < 2:
        raise RuntimeError(
            f"Planilha precisa ter pelo menos 2 abas (lookup + team), "
            f"encontradas: {len(sheets)}"
        )
    name_lookup = sheets[0]["properties"]["title"]
    name_team   = sheets[1]["properties"]["title"]

    # 2) Lê os ranges. Usamos ranges generosos (A:F / A:D) — o Sheets corta
    #    automaticamente nas linhas com dado.
    resp = svc.values().batchGet(
        spreadsheetId=SHEET_ID,
        ranges=[f"'{name_lookup}'!A:F", f"'{name_team}'!A:D"],
        valueRenderOption="UNFORMATTED_VALUE",
    ).execute()

    value_ranges = resp.get("valueRanges", [])
    lookup_raw = value_ranges[0].get("values", []) if len(value_ranges) > 0 else []
    team_raw   = value_ranges[1].get("values", []) if len(value_ranges) > 1 else []

    # Pula header (primeira linha)
    lookup_rows = lookup_raw[1:] if lookup_raw else []
    team_rows   = team_raw[1:]   if team_raw   else []

    return {
        "lookup_rows": lookup_rows,
        "team_rows":   team_rows,
        "sheet_names": [name_lookup, name_team],
    }


def _load_sheet_data() -> dict:
    """Lê as duas primeiras abas da planilha (por ÍNDICE, não por nome).

    Retorna dict com:
      - "lookup_rows": lista de listas (linhas da aba 1, sem header)
      - "team_rows":   lista de listas (linhas da aba 2, sem header)
      - "sheet_names": [nome_aba1, nome_aba2] (debug/log)

    Camadas de defesa, em ordem:
      1. Cache fresco (idade <= CACHE_TTL): devolve direto.
      2. Leitura remota com retry (`SHEETS_RETRIES` tentativas, backoff
         curto). Cobre blips transitórios da Sheets API (timeouts, 5xx,
         rate-limit ocasional).
      3. Stale-while-error: se a leitura remota falhar mas tivermos cache
         antigo (idade <= CACHE_STALE_MAX), devolvemos o stale e logamos.
         Owners ligeiramente velhos > avatares sumidos.
      4. Sem cache utilizável: levanta. O caller (`get_owners_lookup_dict`)
         já trata isso retornando dict vazio sem quebrar a request.

    Cloud Functions de 2ª geração mantêm processo entre invocações, então
    o cache persiste entre requests da mesma instância. Múltiplas
    instâncias têm caches independentes — daí o sintoma "F5 às vezes
    resolve" antes desse fix.
    """
    now = time.time()
    cached = _sheet_cache.get("data")
    cached_ts = float(_sheet_cache.get("ts") or 0.0)

    # 1) Cache fresco
    if cached and (now - cached_ts) < CACHE_TTL:
        return cached  # type: ignore

    # 2) Leitura remota com retry
    last_exc: Optional[Exception] = None
    for attempt in range(SHEETS_RETRIES + 1):
        try:
            data = _fetch_sheet_data_remote()
            _sheet_cache["data"] = data
            _sheet_cache["ts"]   = now
            return data
        except Exception as e:
            last_exc = e
            if attempt < SHEETS_RETRIES:
                time.sleep(SHEETS_BACKOFF_S)
            else:
                break

    # 3) Stale-while-error
    if cached and (now - cached_ts) < CACHE_STALE_MAX:
        age = int(now - cached_ts)
        print(
            f"[owners] sheets fetch falhou após {SHEETS_RETRIES + 1} tentativas, "
            f"servindo stale cache (idade={age}s). Erro: {last_exc}"
        )
        return cached  # type: ignore

    # 4) Sem cache utilizável — propaga
    print(f"[owners] sheets fetch falhou e não há cache stale válido. Erro: {last_exc}")
    raise last_exc if last_exc else RuntimeError("sheets fetch falhou")


def invalidate_cache() -> None:
    """Força a próxima leitura a ir até a planilha. Útil pra testes ou se
    o admin quer garantir dado fresco depois de editar o Sheet."""
    _sheet_cache["data"] = None
    _sheet_cache["ts"]   = 0.0


# ─── Setup de schema (apenas tabela física de overrides) ─────────────────────
def setup_schema() -> dict:
    """Cria a tabela física de overrides se não existir.

    Não há mais external tables — a leitura da planilha é feita via Sheets
    API direto em runtime. Mantemos esse endpoint só pra inicializar o BQ
    quando o backend é deployado pela primeira vez num projeto novo.
    """
    results: dict = {}
    sql_overrides = f"""
        CREATE TABLE IF NOT EXISTS {_full(TABLE_OVERRIDES)} (
            short_token  STRING NOT NULL,
            cp_email     STRING,
            cs_email     STRING,
            updated_by   STRING,
            updated_at   TIMESTAMP
        )
    """
    try:
        bq.query(sql_overrides).result()
        results["overrides"] = "ok"
    except Exception as e:
        results["overrides"] = f"erro: {e}"

    # Aproveita pra validar que a planilha está acessível e devolver os
    # nomes das abas detectados (debug).
    try:
        data = _load_sheet_data()
        results["sheet_access"] = "ok"
        results["sheet_names"]  = data["sheet_names"]
        results["lookup_rows"]  = len(data["lookup_rows"])
        results["team_rows"]    = len(data["team_rows"])
    except Exception as e:
        results["sheet_access"] = f"erro: {e}"

    return results


# ─── Queries de leitura ──────────────────────────────────────────────────────
def list_team_members() -> dict:
    """Lê a segunda aba da planilha e devolve as listas únicas de CPs e CSs.

    Estrutura da aba: CP | Email CP | CS | Email CS

    Linhas inválidas (sem email, "Greenfield", "#N/A") são filtradas — não
    fazem sentido como atribuíveis. Greenfield é registrado como conta sem
    CP/CS designado e não é uma pessoa que possa "ser owner".

    Retorna: {"cps": [{name, email}], "css": [{name, email}]}
    """
    data = _load_sheet_data()
    rows = data["team_rows"]

    cps_seen: Dict[str, str] = {}  # email_lower → name
    css_seen: Dict[str, str] = {}

    for row in rows:
        # Garante 4 colunas
        cells = (list(row) + ["", "", "", ""])[:4]
        cp_name, cp_email, cs_name, cs_email = (str(c).strip() for c in cells)

        if cp_email and cp_email.lower().endswith("@hypr.mobi"):
            key = cp_email.lower()
            if key not in cps_seen:
                cps_seen[key] = cp_name or cp_email.split("@")[0]

        if cs_email and cs_email.lower().endswith("@hypr.mobi"):
            key = cs_email.lower()
            if key not in css_seen:
                css_seen[key] = cs_name or cs_email.split("@")[0]

    cps = sorted(
        [{"name": n, "email": e} for e, n in cps_seen.items()],
        key=lambda x: x["name"].lower(),
    )
    css = sorted(
        [{"name": n, "email": e} for e, n in css_seen.items()],
        key=lambda x: x["name"].lower(),
    )
    return {"cps": cps, "css": css}


def get_owners_lookup_dict() -> Dict[str, Tuple[Optional[str], Optional[str]]]:
    """Lê a primeira aba e monta dict de lookup por client_name (lowercase).

    Estrutura da aba: Agência | Cliente | CP ATUAL | Email CP | CS Atual | Email CS

    Lógica de agregação quando o mesmo cliente aparece em múltiplas linhas
    (atendido por agências diferentes): só retornamos email se todas as
    linhas concordarem. Se houver divergência, retornamos None — o admin
    precisa criar override manual. Isso evita atribuir owner errado.

    Retorna: {client_name_lower: (cp_email_or_none, cs_email_or_none)}
    """
    data = _load_sheet_data()
    rows = data["lookup_rows"]

    # Agrega CPs e CSs por cliente
    by_client: Dict[str, Dict[str, set]] = {}
    for row in rows:
        cells = (list(row) + ["", "", "", "", "", ""])[:6]
        _agency, client, _cp_name, cp_email, _cs_name, cs_email = (str(c).strip() for c in cells)

        if not client:
            continue
        key = client.lower()
        bucket = by_client.setdefault(key, {"cp": set(), "cs": set()})

        cp_lower = cp_email.lower() if cp_email else ""
        if cp_lower.endswith("@hypr.mobi"):
            bucket["cp"].add(cp_lower)

        cs_lower = cs_email.lower() if cs_email else ""
        if cs_lower.endswith("@hypr.mobi"):
            bucket["cs"].add(cs_lower)

    # Resolve: só atribui se houver consenso (1 email único)
    result: Dict[str, Tuple[Optional[str], Optional[str]]] = {}
    for client_lc, bucket in by_client.items():
        cp = next(iter(bucket["cp"])) if len(bucket["cp"]) == 1 else None
        cs = next(iter(bucket["cs"])) if len(bucket["cs"]) == 1 else None
        result[client_lc] = (cp, cs)
    return result


def get_overrides_dict() -> Dict[str, Tuple[Optional[str], Optional[str]]]:
    """Lê a tabela física de overrides e devolve dict por short_token.

    Retorna: {short_token: (cp_email_or_none, cs_email_or_none)}

    Resiliente: se a tabela ainda não existe (primeiro deploy, antes do
    setup_schema), retorna dict vazio em vez de levantar.
    """
    sql = f"""
        SELECT short_token, cp_email, cs_email
        FROM {_full(TABLE_OVERRIDES)}
    """
    try:
        rows = list(bq.query(sql).result())
    except Exception as e:
        # Tabela não existe ainda? Loga e segue.
        print(f"[WARN get_overrides_dict] {e}")
        return {}

    return {
        r["short_token"]: (r.get("cp_email"), r.get("cs_email"))
        for r in rows
    }


def resolve_owners_for_campaigns(campaigns: List[dict]) -> None:
    """Mutação in-place: enriquece cada campaign dict com cp_email/cs_email.

    Faz uma única leitura da planilha e uma única leitura da tabela de
    overrides, depois aplica o merge em Python. Muito mais rápido que
    JOIN no BigQuery quando temos só ~280 entries no lookup.

    Override sempre vence lookup. Se nenhum dos dois tem dado, deixa None.
    Cada campaign dict precisa ter `short_token` e `client_name`.
    """
    try:
        lookup = get_owners_lookup_dict()
    except Exception as e:
        print(f"[WARN resolve_owners] lookup falhou, sem auto-attrib: {e}")
        lookup = {}

    overrides = get_overrides_dict()

    for c in campaigns:
        token = c.get("short_token")
        client_lc = (c.get("client_name") or "").strip().lower()

        ov_cp, ov_cs = overrides.get(token, (None, None))
        lk_cp, lk_cs = lookup.get(client_lc, (None, None))

        c["cp_email"] = ov_cp or lk_cp
        c["cs_email"] = ov_cs or lk_cs


# ─── Mutations (admin write) ─────────────────────────────────────────────────
# Flag de bootstrap: na primeira escrita, garantimos que a tabela de
# overrides exista. CREATE TABLE IF NOT EXISTS é idempotente e custa ~200ms
# só na primeira invocação por instância da Cloud Function. Depois, o flag
# evita a query repetida.
_overrides_table_ready = False


def _ensure_overrides_table() -> None:
    """Cria a tabela física de overrides se ainda não existe.

    Chamado em lazy init dentro de save_owner_override pra evitar dependência
    de um setup_schema explícito antes do primeiro save. Idempotente.
    """
    global _overrides_table_ready
    if _overrides_table_ready:
        return
    sql = f"""
        CREATE TABLE IF NOT EXISTS {_full(TABLE_OVERRIDES)} (
            short_token  STRING NOT NULL,
            cp_email     STRING,
            cs_email     STRING,
            updated_by   STRING,
            updated_at   TIMESTAMP
        )
    """
    bq.query(sql).result()
    _overrides_table_ready = True


def save_owner_override(short_token: str, cp_email: str, cs_email: str,
                         updated_by: str) -> None:
    """Upsert no override. cp_email ou cs_email vazios são tratados como
    "remover override deste campo" — quando ambos vazios e o registro
    já existe, deletamos a linha pra cair de volta no lookup automático.
    """
    _ensure_overrides_table()

    cp = cp_email.strip().lower() if cp_email else None
    cs = cs_email.strip().lower() if cs_email else None

    if not cp and not cs:
        # Limpar override → próxima leitura pega lookup
        sql = f"""
            DELETE FROM {_full(TABLE_OVERRIDES)}
            WHERE short_token = @t
        """
        bq.query(sql, job_config=bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("t", "STRING", short_token),
            ]
        )).result()
        return

    sql = f"""
        MERGE {_full(TABLE_OVERRIDES)} T
        USING (SELECT @t AS short_token) S
        ON T.short_token = S.short_token
        WHEN MATCHED THEN UPDATE SET
            cp_email   = @cp,
            cs_email   = @cs,
            updated_by = @by,
            updated_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT (short_token, cp_email, cs_email, updated_by, updated_at)
            VALUES (@t, @cp, @cs, @by, CURRENT_TIMESTAMP())
    """
    bq.query(sql, job_config=bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("t",  "STRING", short_token),
            bigquery.ScalarQueryParameter("cp", "STRING", cp),
            bigquery.ScalarQueryParameter("cs", "STRING", cs),
            bigquery.ScalarQueryParameter("by", "STRING", updated_by),
        ]
    )).result()
