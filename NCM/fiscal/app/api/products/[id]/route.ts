import { z } from "zod";
import { compareProduct } from "@/src/server/compare";
import { productFromDb, ruleFromDb, syncProductAudit } from "@/src/server/audit";
import { buildEntradaGuide } from "@/src/server/entrada";
import { jsonError, jsonOk } from "@/src/server/http";
import { HttpError, ownedWhere, requireCompanyAdmin, requireCompanySession } from "@/src/server/tenant";
import { withTenant } from "@/src/server/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    const { id } = await context.params;
    const payload = await withTenant(user.companyId, async (db) => {
      const product = await db.product.findFirst({
        where: ownedWhere(id, user.companyId),
      });
      if (!product) throw new HttpError(404, "NOT_FOUND", "Produto não encontrado.");
      const rules = await db.fiscalNcmRule.findMany({
        where: { companyId: user.companyId, ncm: product.ncm },
      });
      const link = await db.productRuleLink.findFirst({
        where: { companyId: user.companyId, productId: product.id },
      });
      const mappedProduct = productFromDb(product);
      const mappedRules = rules.map(ruleFromDb);
      const compare = compareProduct(mappedProduct, mappedRules, link?.ruleId ?? null);
      const guide = buildEntradaGuide(compare.rule, compare, mappedProduct.ncm);
      return {
        product: {
          ...mappedProduct,
          treated: Boolean(product.treatedAt),
          treatedStale: product.treatedStale,
          treatedNote: product.treatedNote,
          treatedAt: product.treatedAt,
        },
        compare,
        guide,
        rules: mappedRules,
        link,
      };
    });
    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}

const linkSchema = z.object({
  ruleId: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    requireCompanyAdmin(user);
    const { id } = await context.params;
    const body = linkSchema.parse(await request.json());
    await withTenant(user.companyId, async (db) => {
      const product = await db.product.findFirst({
        where: ownedWhere(id, user.companyId),
      });
      if (!product) throw new HttpError(404, "NOT_FOUND", "Produto não encontrado.");
      const rule = await db.fiscalNcmRule.findFirst({
        where: ownedWhere(body.ruleId, user.companyId),
      });
      if (!rule || rule.ncm !== product.ncm) {
        throw new HttpError(400, "INVALID_RULE", "A regra não pertence a este NCM/empresa.");
      }
      await db.productRuleLink.deleteMany({
        where: { companyId: user.companyId, productId: product.id },
      });
      await db.productRuleLink.create({
        data: {
          companyId: user.companyId,
          productId: product.id,
          ruleId: rule.id,
        },
      });
    });
    await syncProductAudit(user.companyId, id);
    return jsonOk({ linked: true });
  } catch (error) {
    return jsonError(error);
  }
}
