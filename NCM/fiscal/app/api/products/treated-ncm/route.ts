import { z } from "zod";
import { digitsOnly } from "@/src/server/product-query";
import { jsonError, jsonOk } from "@/src/server/http";
import { HttpError, requireCompanySession } from "@/src/server/tenant";
import { markProductsTreated } from "@/src/server/treated-mark";

const schema = z.object({
  lote: z.string().min(1),
  ncm: z.string().min(1).max(20),
  treated: z.boolean(),
  note: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await requireCompanySession();
    const body = schema.parse(await request.json());
    const ncm = digitsOnly(body.ncm);
    if (!ncm) {
      throw new HttpError(400, "VALIDATION", "Informe um NCM.");
    }
    const result = await markProductsTreated({
      companyId: user.companyId,
      userId: user.id,
      treated: body.treated,
      note: body.note,
      scope: { batchId: body.lote, ncm },
    });
    return jsonOk({ updated: result.updated, ncm, treated: body.treated });
  } catch (error) {
    return jsonError(error);
  }
}
