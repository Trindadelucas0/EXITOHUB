import { Prisma } from "@prisma/client";
import { jsonError, jsonOk } from "@/src/server/http";
import { HttpError, ownedWhere, requireCompanyAdmin, requireCompanySession } from "@/src/server/tenant";
import { withTenant } from "@/src/server/db";
import { asDestinos } from "@/src/server/compare";
import { ruleBodySchema, ruleWriteData } from "@/src/server/rule-write";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    const { id } = await context.params;
    const rule = await withTenant(user.companyId, (db) =>
      db.fiscalNcmRule.findFirst({ where: ownedWhere(id, user.companyId) }),
    );
    if (!rule) throw new HttpError(404, "NOT_FOUND", "Regra não encontrada.");
    return jsonOk({ rule });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const { id } = await context.params;
    const patch = ruleBodySchema.partial().parse(await request.json());
    const updated = await withTenant(user.companyId, async (db) => {
      const existing = await db.fiscalNcmRule.findFirst({
        where: ownedWhere(id, user.companyId),
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Regra não encontrada.");
      const destinos = asDestinos(existing.destinosCst);
      const data = ruleWriteData(user.companyId, {
        ncm: patch.ncm ?? existing.ncm,
        ncmOriginal: patch.ncmOriginal ?? existing.ncmOriginal,
        segmento: patch.segmento ?? existing.segmento,
        cstEntrada: patch.cstEntrada === undefined ? existing.cstEntrada : patch.cstEntrada,
        cstSaida: patch.cstSaida === undefined ? existing.cstSaida : patch.cstSaida,
        cfopSaida: patch.cfopSaida === undefined ? existing.cfopSaida : patch.cfopSaida,
        destinosCst: patch.destinosCst ?? destinos,
        situacao: patch.situacao ?? existing.situacao,
        situacaoCodigo: patch.situacaoCodigo,
        mvaTexto: patch.mvaTexto === undefined ? existing.mvaTexto : patch.mvaTexto,
        observacao: patch.observacao === undefined ? existing.observacao : patch.observacao,
      });
      await db.fiscalNcmRule.updateMany({
        where: { id: existing.id, companyId: user.companyId },
        data: {
          ncm: data.ncm,
          ncmOriginal: data.ncmOriginal,
          segmento: data.segmento,
          cstEntrada: data.cstEntrada,
          cstSaida: data.cstSaida,
          cfopSaida: data.cfopSaida,
          destinosCst: data.destinosCst,
          situacao: data.situacao,
          situacaoCodigo: data.situacaoCodigo,
          mvaPercentual: data.mvaPercentual,
          mvaTexto: data.mvaTexto,
          mvaKind: data.mvaKind,
          observacao: data.observacao,
        },
      });
      return db.fiscalNcmRule.findFirst({ where: ownedWhere(id, user.companyId) });
    });
    if (!updated) throw new HttpError(404, "NOT_FOUND", "Regra não encontrada.");
    return jsonOk({ rule: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(new HttpError(409, "CONFLICT", "Já existe regra com este NCM e situação."));
    }
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const { id } = await context.params;
    await withTenant(user.companyId, async (db) => {
      const existing = await db.fiscalNcmRule.findFirst({
        where: ownedWhere(id, user.companyId),
        include: { _count: { select: { links: true } } },
      });
      if (!existing) throw new HttpError(404, "NOT_FOUND", "Regra não encontrada.");
      if (existing._count.links > 0) {
        throw new HttpError(
          409,
          "CONFLICT",
          "Esta regra está vinculada a produtos. Desfaça o vínculo antes de excluir.",
        );
      }
      await db.fiscalNcmRule.deleteMany({
        where: { id: existing.id, companyId: user.companyId },
      });
    });
    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
