import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/src/server/tenant";

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { success: false, error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION", message: "Dados inválidos." } },
      { status: 400 },
    );
  }
  const message = error instanceof Error ? error.message : "Erro interno.";
  const safe =
    process.env.NODE_ENV === "production" ? "Não foi possível concluir a operação." : message;
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL", message: safe } },
    { status: 500 },
  );
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}
