import { z } from "zod";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireCompanySession } from "@/src/server/tenant";
import { markProductsTreated } from "@/src/server/treated-mark";

const schema = z.object({
  treated: z.boolean(),
  note: z.string().trim().max(200).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireCompanySession();
    const { id } = await context.params;
    const body = schema.parse(await request.json());
    const updated = await markProductsTreated({
      companyId: user.companyId,
      userId: user.id,
      treated: body.treated,
      note: body.note,
      scope: { productId: id },
    });
    return jsonOk({ id, treated: body.treated, updated: updated.updated });
  } catch (error) {
    return jsonError(error);
  }
}
