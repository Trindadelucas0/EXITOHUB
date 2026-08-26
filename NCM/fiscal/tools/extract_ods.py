"""Extrai SOMENTE a aba BAIFER do ODS de regras fiscais.

Não lê Planilha_Classes_Fiscais, LOJA nem abas-link.
Preferir tools/extract_rules.py (BAIFER + LOJA do ODS padrão).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from extract_rules import DEFAULT_BAIFER_JSON, extract_ods_baifer, resolve_default_ods

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JSON = DEFAULT_BAIFER_JSON


def write_json(payload: dict, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    ods = Path(args[0]) if args else resolve_default_ods()
    dest = Path(args[1]) if len(args) > 1 else DEFAULT_JSON
    if not ods.exists():
        print(f"ODS não encontrado: {ods}", file=sys.stderr)
        return 1
    payload = extract_ods_baifer(ods)
    write_json(payload, dest)
    print(
        f"Extraidas {payload['totalRules']} regras da aba {payload['sheet']} "
        f"({payload['uniqueNcm']} NCMs unicos) -> {dest}"
    )
    print("Contagens:", payload["counts"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
