"""Valida extração separada: OK.xlsx = BAIFER, ODS aba LOJA = Loja."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

from extract_rules import (  # noqa: E402
    DEFAULT_ODS,
    DEFAULT_OK,
    assert_not_mixed,
    extract_ods_loja,
    extract_ok_xlsx,
    normalize_ncm,
    parse_mva,
)


@pytest.fixture(scope="module")
def baifer() -> dict:
    assert DEFAULT_OK.exists(), f"OK.xlsx ausente: {DEFAULT_OK}"
    return extract_ok_xlsx(DEFAULT_OK)


@pytest.fixture(scope="module")
def loja() -> dict:
    assert DEFAULT_ODS.exists(), f"ODS ausente: {DEFAULT_ODS}"
    return extract_ods_loja(DEFAULT_ODS)


def test_empresas_nao_misturam(baifer: dict, loja: dict) -> None:
    assert_not_mixed(baifer, loja)
    assert baifer["extractedSheets"] != loja["extractedSheets"]
    assert "LOJA" not in baifer["extractedSheets"]
    assert "Planilha_Classes_Fiscais" not in baifer["extractedSheets"]
    assert "Planilha_Classes_Fiscais" in loja["ignoredSheets"]
    assert "BAIFER" in loja["ignoredSheets"]


def test_ok_xlsx_so_primeira_aba(baifer: dict) -> None:
    assert baifer["company"] == "baifer"
    assert baifer["source"].lower().endswith(".xlsx")
    assert len(baifer["extractedSheets"]) == 1
    for rule in baifer["rules"]:
        assert rule["company"] == "baifer"
        assert rule["sourceSheet"] != "LOJA"
        assert "codigoProduto" not in rule


def test_baifer_32141010_st_interno(baifer: dict) -> None:
    matches = [r for r in baifer["rules"] if r["ncm"] == "32141010"]
    assert len(matches) == 1
    rule = matches[0]
    assert rule["cstEntrada"] == "0"
    assert rule["cstSaida"] == "10"
    assert rule["cfopSaida"] == "5403"
    assert rule["situacaoCodigo"] == "ST_INTERNO"
    dest = rule["destinosCst"]
    assert dest["naoContribuinte"] == "0"
    assert dest["construtora"] == "0"
    assert dest["hospClinica"] == "0"
    assert dest["orgaoPublico"] == "0"
    assert dest["produtorRural"] == "0"
    assert dest["contribuinte"] == "10"
    assert dest["revenda"] == "10"
    assert dest["atacado"] == "10"


def test_loja_32141010_nao_usa_regra_baifer(loja: dict) -> None:
    matches = [r for r in loja["rules"] if r["ncm"] == "32141010"]
    assert len(matches) == 1
    rule = matches[0]
    assert rule["company"] == "loja"
    assert rule["sourceSheet"] == "LOJA"
    assert rule["situacaoCodigo"] == "ST_INTERNO"
    assert rule["cfopSaida"] == "5102"
    dest = rule["destinosCst"]
    for key in dest:
        assert dest[key] in ("0", "00", None)
    assert dest["revenda"] in ("0", "00")
    assert rule["cstSaida"] != "10"


def test_contagens_baifer_ok(baifer: dict) -> None:
    counts = baifer["counts"]
    assert baifer["totalRules"] >= 1000
    assert counts.get("ST_INTERNO", 0) >= 70
    assert counts.get("ST_NACIONAL", 0) >= 60
    assert counts.get("REDUCAO", 0) >= 200


def test_contagens_loja(loja: dict) -> None:
    assert loja["totalRules"] >= 1000
    assert loja["counts"].get("ST_INTERNO", 0) >= 70


def test_mva_fracao_excel() -> None:
    pct, _, kind = parse_mva(0.35)
    assert kind == "numeric"
    assert pct == 35
    pct2, _, kind2 = parse_mva(0.2972)
    assert kind2 == "numeric"
    assert abs((pct2 or 0) - 29.72) < 0.01


def test_normalize_ncm() -> None:
    assert normalize_ncm("82032010-2") == "82032010"
    assert normalize_ncm("82.03.20.10") == "82032010"
