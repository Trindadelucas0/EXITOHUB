import { NextResponse } from "next/server";
import { destroySession, readSessionCookie, SESSION_COOKIE, sessionCookieOptions } from "@/src/server/auth";
import { BATCH_COOKIE, batchCookieOptions } from "@/src/server/batch";

export async function POST() {
  const token = await readSessionCookie();
  await destroySession(token);
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set(BATCH_COOKIE, "", { ...batchCookieOptions(), maxAge: 0 });
  return response;
}
