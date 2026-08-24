import { z } from "zod";
import { DESTINO_KEYS } from "@/src/lib/fiscal";
import { HttpError } from "@/src/server/tenant";
import { asDestinos } from "@/src/server/compare";
import { normalizeNcm } from "@/src/server/ncm";
import { classifySituacao, parseMvaFields } from "@/src/server/rule-classify";

const destinosSchema = z
  .object({
    naoContribuinte: z.string().max(20).nullable().optional(),
    contribuinte: z.string().max(20).nullable().optional(),
    revenda: z.string().max(20).nullable().optional(),
    construtora: z.string().max(20).nullable().optional(),
    hospClinica: z.string().max(20).nullable().optional(),
    orgaoPublico: z.string().max(20).nullable().optional(),
    produtorRural: z.string().max(20).nullable().optional(),
    atacado: z.string().max(20).nullable().optional(),
  })
  .optional();

export const ruleBodySchema = z.object({
  ncm: z.string().min(1).max(20),
  ncmOriginal: z.string().max(20).optional(),
  segmento: z.string().trim().max(200).default(""),
  cstEntrada: z.string().max(20).nullable().optional(),
  cstSaida: z.string().max(20).nullable().optional(),
  cfopSaida: z.string().max(20).nullable().optional(),
  destinosCst: destinosSchema,
  situacao: z.string().trim().max(80).default(""),
  situacaoCodigo: z.enum(["REGRA_GERAL", "ST_INTERNO", "ST_NACIONAL", "REDUCAO", "INCOMPLETA"]).optional(),
  mvaTexto: z.string().max(40).nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
});

export type RuleBody = z.infer<typeof ruleBodySchema>;

export function ruleWriteData(companyId: string, body: RuleBody) {
  const ncmOriginal = (body.ncmOriginal ?? body.ncm).trim();
  const ncm = normalizeNcm(body.ncm);
  if (ncm.length !== 8) {
    throw new HttpError(400, "VALIDATION", "NCM inválido. Informe 8 dígitos.");
  }
  const cstEntrada = body.cstEntrada?.trim() || null;
  const cstSaida = body.cstSaida?.trim() || null;
  const cfopSaida = body.cfopSaida?.trim() || null;
  const situacao = body.situacao.trim();
  const situacaoCodigo =
    body.situacaoCodigo ?? classifySituacao(situacao, cstSaida || "", cfopSaida || "");
  const destinos = asDestinos(body.destinosCst ?? {});
  for (const key of DESTINO_KEYS) {
    const value = destinos[key];
    destinos[key] = value?.trim() ? value.trim() : null;
  }
  const mva = parseMvaFields(body.mvaTexto ?? null);
  return {
    companyId,
    ncm,
    ncmOriginal,
    segmento: body.segmento.trim(),
    cstEntrada,
    cstSaida,
    cfopSaida,
    destinosCst: destinos,
    situacao: situacao || situacaoCodigo,
    situacaoCodigo,
    mvaPercentual: mva.mvaPercentual,
    mvaTexto: mva.mvaTexto,
    mvaKind: mva.mvaKind,
    observacao: body.observacao?.trim() || null,
  };
}
