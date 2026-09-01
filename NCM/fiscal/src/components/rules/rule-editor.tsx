"use client";

import {
  DESTINO_KEYS,
  DESTINO_LABELS,
  emptyUfTributacao,
  type DestinosCst,
  type UfTributacao,
} from "@/src/lib/fiscal";
import { Button } from "@/src/components/ui/button";
import { Field } from "@/src/components/ui/field";

export type RuleFormState = {
  ncm: string;
  segmento: string;
  cstEntrada: string;
  cstSaida: string;
  cfopSaida: string;
  destinosCst: DestinosCst;
  situacao: string;
  situacaoCodigo: string;
  mvaTexto: string;
  cest: string;
  ipi: string;
  abreviacao: string;
  ufTributacao: UfTributacao | null;
};

export function emptyRuleForm(): RuleFormState {
  return {
    ncm: "",
    segmento: "",
    cstEntrada: "",
    cstSaida: "",
    cfopSaida: "",
    destinosCst: {
      naoContribuinte: null,
      contribuinte: null,
      revenda: null,
      construtora: null,
      hospClinica: null,
      orgaoPublico: null,
      produtorRural: null,
      atacado: null,
    },
    situacao: "",
    situacaoCodigo: "",
    mvaTexto: "",
    cest: "",
    ipi: "",
    abreviacao: "",
    ufTributacao: null,
  };
}

const SITUACAO_OPTIONS = [
  { value: "", label: "Classificar automaticamente" },
  { value: "REGRA_GERAL", label: "Regra geral" },
  { value: "ST_INTERNO", label: "ST interno" },
  { value: "ST_NACIONAL", label: "ST nacional" },
  { value: "REDUCAO", label: "Redução" },
  { value: "TRIBUTACAO_UF", label: "Tributação por UF" },
  { value: "INCOMPLETA", label: "Incompleta" },
];

export function RuleEditor({
  form,
  onChange,
  onSubmit,
  onCancel,
  saving,
  title,
  layout = "matriz",
}: {
  form: RuleFormState;
  onChange: (next: RuleFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  title: string;
  layout?: "matriz" | "unica" | "egaplast";
}) {
  function setField<K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) {
    onChange({ ...form, [key]: value });
  }

  function setUf(uf: "DF" | "GO" | "MG", field: "original" | "aliqInterna", value: string) {
    const next = form.ufTributacao ? { ...form.ufTributacao } : emptyUfTributacao();
    next[uf] = { ...next[uf], [field]: value || null };
    onChange({ ...form, ufTributacao: next });
  }

  return (
    <form
      className="grid gap-4 rounded-lg bg-white p-4 shadow-panel sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="NCM" name="ncm" required value={form.ncm} onChange={(e) => setField("ncm", e.target.value)} />
        <Field
          label="Segmento"
          name="segmento"
          value={form.segmento}
          onChange={(e) => setField("segmento", e.target.value)}
        />
        {layout === "unica" ? (
          <>
            <Field
              label="CEST"
              name="cest"
              value={form.cest}
              onChange={(e) => setField("cest", e.target.value)}
            />
            <Field
              label="Abreviação"
              name="abreviacao"
              value={form.abreviacao}
              onChange={(e) => setField("abreviacao", e.target.value)}
            />
            <Field label="IPI" name="ipi" value={form.ipi} onChange={(e) => setField("ipi", e.target.value)} />
            <Field
              label="MVA original DF"
              name="mvaTexto"
              value={form.mvaTexto}
              onChange={(e) => setField("mvaTexto", e.target.value)}
            />
          </>
        ) : (
          <>
            <Field
              label="CST saída"
              name="cstSaida"
              value={form.cstSaida}
              onChange={(e) => setField("cstSaida", e.target.value)}
            />
            {layout === "egaplast" ? null : (
              <Field
                label="CFOP saída"
                name="cfopSaida"
                value={form.cfopSaida}
                onChange={(e) => setField("cfopSaida", e.target.value)}
              />
            )}
            {layout === "egaplast" ? null : (
            <Field
              label="CST entrada"
              name="cstEntrada"
              value={form.cstEntrada}
              onChange={(e) => setField("cstEntrada", e.target.value)}
            />
            )}
            <Field
              label="MVA"
              name="mvaTexto"
              value={form.mvaTexto}
              onChange={(e) => setField("mvaTexto", e.target.value)}
            />
          </>
        )}
        <Field
          label="Situação (texto)"
          name="situacao"
          value={form.situacao}
          onChange={(e) => setField("situacao", e.target.value)}
        />
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-ink">Código da situação</span>
          <select
            className="min-h-11 rounded-md border border-line bg-white px-3"
            value={form.situacaoCodigo}
            onChange={(e) => setField("situacaoCodigo", e.target.value)}
          >
            {SITUACAO_OPTIONS.map((item) => (
              <option key={item.value || "auto"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {layout === "unica" ? (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-ink">Alíquota interna e MVA original por UF</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Aliq. DF"
              name="aliqDf"
              value={form.ufTributacao?.DF.aliqInterna ?? ""}
              onChange={(e) => setUf("DF", "aliqInterna", e.target.value)}
            />
            <Field
              label="MVA DF"
              name="mvaDf"
              value={form.ufTributacao?.DF.original ?? form.mvaTexto}
              onChange={(e) => setUf("DF", "original", e.target.value)}
            />
            <Field
              label="Aliq. GO"
              name="aliqGo"
              value={form.ufTributacao?.GO.aliqInterna ?? ""}
              onChange={(e) => setUf("GO", "aliqInterna", e.target.value)}
            />
            <Field
              label="MVA GO"
              name="mvaGo"
              value={form.ufTributacao?.GO.original ?? ""}
              onChange={(e) => setUf("GO", "original", e.target.value)}
            />
            <Field
              label="Aliq. MG"
              name="aliqMg"
              value={form.ufTributacao?.MG.aliqInterna ?? ""}
              onChange={(e) => setUf("MG", "aliqInterna", e.target.value)}
            />
            <Field
              label="MVA MG"
              name="mvaMg"
              value={form.ufTributacao?.MG.original ?? ""}
              onChange={(e) => setUf("MG", "original", e.target.value)}
            />
          </div>
        </fieldset>
      ) : layout === "egaplast" ? null : (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium text-ink">CST por destinatário</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {DESTINO_KEYS.map((key) => (
              <Field
                key={key}
                label={DESTINO_LABELS[key]}
                name={key}
                value={form.destinosCst[key] ?? ""}
                onChange={(e) =>
                  setField("destinosCst", { ...form.destinosCst, [key]: e.target.value || null })
                }
              />
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar regra"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
