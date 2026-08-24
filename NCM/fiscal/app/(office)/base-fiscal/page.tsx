"use client";

import { useEffect, useMemo, useState } from "react";
import { FiscalGrid } from "@/src/components/grid/fiscal-grid";
import { RULE_SHEET_COLUMNS, type RuleSheetItem } from "@/src/components/grid/rule-sheet-columns";
import { CstMatrix } from "@/src/components/matrix/cst-matrix";
import { emptyRuleForm, RuleEditor, type RuleFormState } from "@/src/components/rules/rule-editor";
import { PageHeader } from "@/src/components/ui/page-header";
import { Notice } from "@/src/components/ui/notice";
import { Pagination } from "@/src/components/ui/pagination";
import { SheetToolbar } from "@/src/components/ui/sheet-toolbar";
import { Button } from "@/src/components/ui/button";

const SITUACOES = [
  { value: "", label: "Todas as situações" },
  { value: "REGRA_GERAL", label: "Regra geral" },
  { value: "ST_INTERNO", label: "ST interno" },
  { value: "ST_NACIONAL", label: "ST nacional" },
  { value: "REDUCAO", label: "Redução" },
  { value: "INCOMPLETA", label: "Incompleta" },
];

const PAGE_SIZE_DEFAULT = 50;

function toForm(rule: RuleSheetItem): RuleFormState {
  return {
    ncm: rule.ncmOriginal || rule.ncm,
    segmento: rule.segmento,
    cstEntrada: rule.cstEntrada ?? "",
    cstSaida: rule.cstSaida ?? "",
    cfopSaida: rule.cfopSaida ?? "",
    destinosCst: rule.destinosCst,
    situacao: rule.situacao,
    situacaoCodigo: rule.situacaoCodigo,
    mvaTexto: rule.mvaTexto ?? "",
  };
}

function payloadFromForm(form: RuleFormState) {
  return {
    ncm: form.ncm,
    segmento: form.segmento,
    cstEntrada: form.cstEntrada || null,
    cstSaida: form.cstSaida || null,
    cfopSaida: form.cfopSaida || null,
    destinosCst: form.destinosCst,
    situacao: form.situacao,
    situacaoCodigo: form.situacaoCodigo || undefined,
    mvaTexto: form.mvaTexto || null,
  };
}

export default function BaseFiscalPage() {
  const [q, setQ] = useState("");
  const [situacao, setSituacao] = useState("");
  const [rules, setRules] = useState<RuleSheetItem[]>([]);
  const [selected, setSelected] = useState<RuleSheetItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [form, setForm] = useState<RuleFormState>(emptyRuleForm());
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => setIsAdmin(Boolean(json.data?.canWrite)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (situacao) params.set("situacao", situacao);
      fetch(`/api/rules?${params}`, { signal: ctrl.signal })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error?.message ?? "Falha");
          const rows = (json.data.rules ?? []) as RuleSheetItem[];
          setRules(rows);
          setPage(1);
        })
        .catch((err: Error) => {
          if (err.name !== "AbortError") setError(err.message);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, situacao, reload]);

  const highlight = useMemo(
    () => selected ?? rules[0] ?? null,
    [selected, rules],
  );
  const pageCount = Math.max(1, Math.ceil(rules.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rules.slice(start, start + pageSize);
  }, [rules, page, pageSize]);
  const dirty = Boolean(q || situacao);

  async function saveRule() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const url = mode === "edit" && selected ? `/api/rules/${selected.id}` : "/api/rules";
      const method = mode === "edit" && selected ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadFromForm(form)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível salvar.");
      setSuccess("Regra salva.");
      setMode("idle");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(rule: RuleSheetItem) {
    if (!window.confirm(`Excluir a regra do NCM ${rule.ncm}?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível excluir.");
      setSelected(null);
      setSuccess("Regra excluída.");
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    } finally {
      setSaving(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    setError("");
    setSuccess("");
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/rules/import", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Falha na importação.");
      setSuccess(
        `${json.data.inserted} regras novas e ${json.data.updated} atualizadas nesta empresa.`,
      );
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na importação.");
    } finally {
      setImporting(false);
    }
  }

  async function clearFiscalBase() {
    if (
      !window.confirm(
        `Apagar todas as regras da base fiscal desta empresa${rules.length > 0 && !dirty ? ` (${rules.length})` : ""}? Os lotes de produtos continuam; a conferência passa a marcar falta de regra até importar de novo.`,
      )
    ) {
      return;
    }
    setClearing(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/rules", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Não foi possível excluir a base fiscal.");
      setSelected(null);
      setMode("idle");
      setSuccess(
        `${json.data.deleted} regra${json.data.deleted === 1 ? "" : "s"} excluída${json.data.deleted === 1 ? "" : "s"}. Lotes de produtos mantidos.`,
      );
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a base fiscal.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        kicker="Regras da empresa"
        title="Base fiscal"
        description="NCM, CST, CFOP, destinatários, situação e MVA desta empresa. Produtos não entram aqui."
        actions={
          isAdmin ? (
            <Button
              type="button"
              onClick={() => {
                setMode("create");
                setForm(emptyRuleForm());
              }}
            >
              Nova regra
            </Button>
          ) : null
        }
      />
      {isAdmin ? (
        <form className="rounded-lg border border-line bg-white p-4 sm:p-6">
          <label htmlFor="arquivo-regras" className="text-sm font-medium text-ink">
            Importar planilha de regras (XLSX, CSV ou ODS, até 8 MB)
          </label>
          <input
            id="arquivo-regras"
            name="arquivo-regras"
            type="file"
            accept=".xlsx,.csv,.ods"
            disabled={importing || clearing}
            className="mt-2 block w-full text-base md:text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = "";
            }}
          />
          <p className="mt-2 text-xs text-ink-muted">
            Colunas: NCM, segmento, CST entrada, CST saída, CFOP, 8 destinatários, situação e MVA.
          </p>
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm text-ink-muted">
              Excluir a importação remove todas as regras desta empresa. Os lotes de produtos em
              Importar não são apagados.
            </p>
            <Button
              type="button"
              variant="danger"
              className="mt-3"
              disabled={importing || clearing || loading || (rules.length === 0 && !dirty)}
              onClick={() => void clearFiscalBase()}
            >
              {clearing ? "Excluindo…" : "Excluir base fiscal"}
            </Button>
          </div>
        </form>
      ) : null}
      {mode !== "idle" && isAdmin ? (
        <RuleEditor
          form={form}
          onChange={setForm}
          onSubmit={() => void saveRule()}
          onCancel={() => setMode("idle")}
          saving={saving}
          title={mode === "edit" ? "Editar regra" : "Cadastrar regra"}
        />
      ) : null}
      <SheetToolbar>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="busca-ncm" className="text-sm font-medium text-ink">
              Buscar NCM ou segmento
            </label>
            <input
              id="busca-ncm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ex.: 32141010 ou Tintas"
              className="min-h-11 rounded-md border border-line-strong bg-white px-3 text-base md:text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="filtro-sit" className="text-sm font-medium text-ink">
              Situação
            </label>
            <select
              id="filtro-sit"
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className="min-h-11 rounded-md border border-line-strong bg-white px-3 text-base md:text-sm"
            >
              {SITUACOES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {dirty ? (
          <div>
            <Button type="button" variant="ghost" onClick={() => { setQ(""); setSituacao(""); }}>
              Limpar filtros
            </Button>
          </div>
        ) : null}
      </SheetToolbar>
      {error ? <Notice variant="error">{error}</Notice> : null}
      {success ? <Notice variant="success">{success}</Notice> : null}
      <p className="text-sm text-ink-muted">
        {loading
          ? "Carregando regras…"
          : rules.length === 0
            ? "Nenhuma regra. Importe a planilha ou cadastre a primeira."
            : `${rules.length} regra${rules.length === 1 ? "" : "s"}`}
      </p>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <FiscalGrid
            caption="Base fiscal NCM"
            columns={RULE_SHEET_COLUMNS}
            rows={pageRows}
            getRowId={(row) => row.id}
            loading={loading}
            selectedId={highlight?.id}
            onRowActivate={setSelected}
          />
          <div className="mt-4">
            <Pagination
              page={page}
              pageCount={pageCount}
              onPage={setPage}
              pageSize={pageSize}
              onPageSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              label="Paginação da base fiscal"
            />
          </div>
        </div>
        {highlight ? (
          <aside className="hidden rounded-lg border border-brand bg-white p-4 shadow-brand xl:block">
            <p className="text-xs font-medium uppercase tracking-wide text-status-ok">Linha selecionada</p>
            <h2 className="mt-1 font-display text-2xl tabular text-brand">{highlight.ncm}</h2>
            <p className="text-sm text-ink-muted">
              {highlight.segmento} · {highlight.situacaoCodigo} · MVA {highlight.mvaTexto ?? "—"}
            </p>
            <div className="mt-4">
              <CstMatrix layout="stacked" ideal={highlight.destinosCst} />
            </div>
            {isAdmin ? (
              <div className="mt-4 grid gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSelected(highlight);
                    setForm(toForm(highlight));
                    setMode("edit");
                  }}
                >
                  Editar
                </Button>
                <Button type="button" variant="danger" onClick={() => void deleteRule(highlight)} disabled={saving}>
                  Excluir
                </Button>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
