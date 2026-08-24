"""Extrai SOMENTE a aba BAIFER do ODS de regras fiscais.

Não lê Planilha_Classes_Fiscais, LOJA nem abas-link.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

from odf.opendocument import load
from odf.table import Table, TableCell, TableRow
from odf.text import P

DESTINO_KEYS = [
    "naoContribuinte",
    "contribuinte",
    "revenda",
    "construtora",
    "hospClinica",
    "orgaoPublico",
    "produtorRural",
    "atacado",
]

FORBIDDEN_SHEETS = {"Planilha_Classes_Fiscais"}
ALLOWED_SHEET = "BAIFER"

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ODS = ROOT / "data" / "relacao-produtos-ncms-baifer.ods"
DEFAULT_JSON = ROOT / "data" / "base-baifer.json"


def normalize_ncm(raw: str | None) -> str:
    if not raw:
        return ""
    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        return ""
    if len(digits) < 8:
        return digits.zfill(8)
    return digits[:8]


def _strip_accents(text: str) -> str:
    nfd = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


def _cell_text(cell: TableCell) -> str:
    texts: list[str] = []
    for p in cell.getElementsByType(P):
        texts.append(str(p))
    val = " ".join(texts).strip()
    if val:
        return val
    for key, value in cell.attributes.items():
        key_s = str(key)
        if key_s.endswith("}value") or key_s.endswith(":value"):
            if value not in (None, ""):
                return str(value)
    return ""


def _expand_row(row: TableRow, max_cols: int = 16) -> list[str]:
    out: list[str] = []
    for cell in row.getElementsByType(TableCell):
        repeated = cell.getAttribute("numbercolumnsrepeated")
        n = int(repeated) if repeated else 1
        val = _cell_text(cell)
        for _ in range(n):
            out.append(val)
            if len(out) >= max_cols:
                return out
    while len(out) < max_cols:
        out.append("")
    return out[:max_cols]


def parse_mva(raw: str | None) -> tuple[float | None, str | None, str]:
    """Retorna (percentual, texto, kind).

    kind: numeric | skip | analise
    """
    text = (raw or "").strip()
    if not text:
        return None, None, "skip"
    folded = _strip_accents(text).lower()
    if folded in {"nao", "não"}:
        return None, text, "skip"
    if "#n/d" in folded or folded.startswith("sim"):
        return None, text, "analise"
    cleaned = text.replace("%", "").replace(".", "").replace(",", ".").strip()
    try:
        number = float(cleaned)
        return number, text, "numeric"
    except ValueError:
        return None, text, "analise"


def classify_situacao(
    situacao: str,
    cst_entrada: str,
    cst_saida: str,
    cfop: str,
) -> str:
    sit = _strip_accents((situacao or "").upper())
    cst_s = (cst_saida or "").strip()
    cfop_s = (cfop or "").strip()
    if not cst_s or not cfop_s:
        return "INCOMPLETA"
    if "ST INTERNO" in sit:
        return "ST_INTERNO"
    if "ST NACIONAL" in sit:
        return "ST_NACIONAL"
    if "REDUC" in sit:
        return "REDUCAO"
    if "REGRA GERAL" in sit:
        return "REGRA_GERAL"
    if cst_s in {"0", "00"} and cfop_s == "5102":
        return "REGRA_GERAL"
    if cst_s == "60" and cfop_s == "5405":
        return "ST_NACIONAL"
    return "INCOMPLETA"


def extract_baifer(ods_path: Path) -> dict:
    doc = load(str(ods_path))
    tables = doc.spreadsheet.getElementsByType(Table)
    sheet_names = [str(t.getAttribute("name")) for t in tables]

    baifer = None
    for table in tables:
        name = str(table.getAttribute("name"))
        if name in FORBIDDEN_SHEETS:
            continue
        if name == ALLOWED_SHEET:
            baifer = table
            break

    if baifer is None:
        raise RuntimeError("Aba BAIFER não encontrada no ODS.")

    rows = baifer.getElementsByType(TableRow)
    if not rows:
        raise RuntimeError("Aba BAIFER está vazia.")

    header = _expand_row(rows[0])
    rules: list[dict] = []
    skipped_empty = 0

    for row in rows[1:]:
        cells = _expand_row(row)
        ncm_original = (cells[0] or "").strip()
        if not ncm_original:
            skipped_empty += 1
            continue
        ncm = normalize_ncm(ncm_original)
        if len(ncm) != 8:
            continue

        destinos: dict[str, str | None] = {}
        for i, key in enumerate(DESTINO_KEYS):
            raw = (cells[5 + i] or "").strip()
            destinos[key] = raw if raw else None

        cst_entrada = (cells[2] or "").strip() or None
        cst_saida = (cells[3] or "").strip() or None
        cfop_saida = (cells[4] or "").strip() or None
        situacao = (cells[13] or "").strip()
        mva_raw = (cells[14] or "").strip()
        mva_pct, mva_texto, mva_kind = parse_mva(mva_raw)
        codigo = classify_situacao(situacao, cst_entrada or "", cst_saida or "", cfop_saida or "")

        rules.append(
            {
                "sourceSheet": ALLOWED_SHEET,
                "ncm": ncm,
                "ncmOriginal": ncm_original,
                "segmento": (cells[1] or "").strip(),
                "cstEntrada": cst_entrada,
                "cstSaida": cst_saida,
                "cfopSaida": cfop_saida,
                "destinosCst": destinos,
                "situacao": situacao,
                "situacaoCodigo": codigo,
                "mvaPercentual": mva_pct,
                "mvaTexto": mva_texto,
                "mvaKind": mva_kind,
                "observacao": None,
            }
        )

    counts: dict[str, int] = {}
    for rule in rules:
        code = rule["situacaoCodigo"]
        counts[code] = counts.get(code, 0) + 1

    return {
        "source": str(ods_path.name),
        "sheet": ALLOWED_SHEET,
        "extractedSheets": [ALLOWED_SHEET],
        "ignoredSheets": [n for n in sheet_names if n != ALLOWED_SHEET],
        "header": header,
        "totalRules": len(rules),
        "uniqueNcm": len({r["ncm"] for r in rules}),
        "counts": counts,
        "skippedEmptyRows": skipped_empty,
        "rules": rules,
    }


def write_json(payload: dict, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    ods = Path(args[0]) if args else DEFAULT_ODS
    dest = Path(args[1]) if len(args) > 1 else DEFAULT_JSON
    if not ods.exists():
        print(f"ODS não encontrado: {ods}", file=sys.stderr)
        return 1
    payload = extract_baifer(ods)
    write_json(payload, dest)
    print(
        f"Extraidas {payload['totalRules']} regras da aba {payload['sheet']} "
        f"({payload['uniqueNcm']} NCMs unicos) -> {dest}"
    )
    print("Contagens:", payload["counts"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
