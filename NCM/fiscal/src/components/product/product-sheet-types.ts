import type { DestinosCst, FieldDiff, StatusFiscal } from "@/src/lib/fiscal";

export type ProductSheetItem = {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string;
  ncmOriginal: string;
  status: StatusFiscal;
  motivo: string;
  needsLink: boolean;
  situacao: string | null;
  situacaoCodigo: string | null;
  diffs: FieldDiff[];
  importado: {
    cstCompra: string | null;
    cstUnico: string | null;
    ivaMva: string | null;
    destinosCst: DestinosCst | null;
  };
  correto: {
    ncm: string;
    cstEntrada: string | null;
    cstSaida: string | null;
    cfopSaida: string | null;
    mva: string | null;
    situacao: string;
    destinosCst: DestinosCst;
  } | null;
  candidates: {
    id: string;
    situacao: string;
    situacaoCodigo: string;
    cstSaida: string | null;
    cfopSaida: string | null;
  }[];
  treated: boolean;
  treatedStale: boolean;
  treatedNote: string | null;
};
