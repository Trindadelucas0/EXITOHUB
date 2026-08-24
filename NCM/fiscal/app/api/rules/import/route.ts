import { Prisma } from "@prisma/client";
import { LONG_TX, withTenant } from "@/src/server/db";
import { jsonError, jsonOk } from "@/src/server/http";
import { assertSafeUpload } from "@/src/server/import-cadastro";
import { dedupeParsedRules, parseRulesBuffer } from "@/src/server/import-rules";
import { HttpError, requireCompanyAdmin, requireCompanySession } from "@/src/server/tenant";

export async function POST(request: Request) {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "VALIDATION", "Envie um arquivo.");
    }
    try {
      assertSafeUpload(file.name, file.size, file.type);
    } catch (error) {
      throw new HttpError(400, "VALIDATION", error instanceof Error ? error.message : "Arquivo inválido.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = dedupeParsedRules(parseRulesBuffer(buffer));
    if (parsed.length === 0) {
      throw new HttpError(400, "EMPTY", "Nenhuma regra reconhecida na planilha.");
    }

    const result = await withTenant(
      user.companyId,
      async (db) => {
        const existing = await db.fiscalNcmRule.findMany({
          where: { companyId: user.companyId },
          select: { id: true, ncm: true, situacaoCodigo: true },
        });
        const byKey = new Map(existing.map((row) => [`${row.ncm}::${row.situacaoCodigo}`, row.id]));
        let inserted = 0;
        let updated = 0;
        const toInsert = parsed.filter((rule) => !byKey.has(`${rule.ncm}::${rule.situacaoCodigo}`));
        const toUpdate = parsed.filter((rule) => byKey.has(`${rule.ncm}::${rule.situacaoCodigo}`));
        for (const rule of toUpdate) {
          const id = byKey.get(`${rule.ncm}::${rule.situacaoCodigo}`);
          if (!id) continue;
          await db.fiscalNcmRule.updateMany({
            where: { id, companyId: user.companyId },
            data: {
              ncmOriginal: rule.ncmOriginal,
              segmento: rule.segmento,
              cstEntrada: rule.cstEntrada,
              cstSaida: rule.cstSaida,
              cfopSaida: rule.cfopSaida,
              destinosCst: rule.destinosCst,
              situacao: rule.situacao || rule.situacaoCodigo,
              situacaoCodigo: rule.situacaoCodigo,
              mvaPercentual: rule.mvaPercentual,
              mvaTexto: rule.mvaTexto,
              mvaKind: rule.mvaKind,
            },
          });
          updated += 1;
        }
        if (toInsert.length > 0) {
          const created = await db.fiscalNcmRule.createMany({
            data: toInsert.map((rule) => ({
              companyId: user.companyId,
              ncm: rule.ncm,
              ncmOriginal: rule.ncmOriginal,
              segmento: rule.segmento,
              cstEntrada: rule.cstEntrada,
              cstSaida: rule.cstSaida,
              cfopSaida: rule.cfopSaida,
              destinosCst: rule.destinosCst,
              situacao: rule.situacao || rule.situacaoCodigo,
              situacaoCodigo: rule.situacaoCodigo,
              mvaPercentual: rule.mvaPercentual,
              mvaTexto: rule.mvaTexto,
              mvaKind: rule.mvaKind,
            })),
          });
          inserted = created.count;
        }
        return { inserted, updated, ignored: 0, total: parsed.length };
      },
      LONG_TX,
    );

    return jsonOk(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(new HttpError(409, "CONFLICT", "Regra duplicada na importação."));
    }
    if (error instanceof Error && !(error instanceof HttpError) && error.message.includes("Nenhuma aba")) {
      return jsonError(new HttpError(400, "VALIDATION", error.message));
    }
    return jsonError(error);
  }
}
