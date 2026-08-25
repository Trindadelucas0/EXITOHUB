import { resolveCompanyScope } from "@/src/server/company-scope";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireUser } from "@/src/server/tenant";
import {
  createSession,
  getUserFromToken,
  readSessionCookie,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/src/server/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const scope = resolveCompanyScope(user);
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: scope?.companyId ?? null,
      companyName: scope?.companyName ?? (user.role === "superadmin" ? "Escritório" : null),
      fromOffice: scope?.fromOffice ?? false,
      canWrite: scope ? scope.fromOffice || user.role === "admin" : false,
      hubMode: process.env.HUB_MODE === "1",
      modules: {
        folha: true,
        conci: true,
        ncm: true,
      },
    };

    // Em modo HUB, garante cookie fiscal válido (cookie velho/expirado não serve).
    if (process.env.HUB_MODE === "1") {
      const existing = await readSessionCookie();
      const valid = await getUserFromToken(existing);
      if (!valid) {
        const token = await createSession(user);
        const response = jsonOk(payload);
        response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
        return response;
      }
    }

    return jsonOk(payload);
  } catch (error) {
    return jsonError(error);
  }
}
