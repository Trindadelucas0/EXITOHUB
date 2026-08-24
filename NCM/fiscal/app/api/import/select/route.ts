import { NextResponse } from "next/server";
import { z } from "zod";
import { BATCH_COOKIE, batchCookieOptions, requireOwnedBatch } from "@/src/server/batch";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireCompanySession } from "@/src/server/tenant";

const schema = z.object({
  batchId: z.string().min(1).max(64),
});

export async function POST(request: Request) {
  try {
    const user = await requireCompanySession();
    const body = schema.parse(await request.json());
    await requireOwnedBatch(user.companyId, body.batchId);
    const response = jsonOk({ batchId: body.batchId });
    response.cookies.set(BATCH_COOKIE, body.batchId, batchCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION", message: "Informe o lote." } },
        { status: 400 },
      );
    }
    return jsonError(error);
  }
}
