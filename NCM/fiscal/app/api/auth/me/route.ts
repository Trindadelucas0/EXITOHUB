import { ncmSessionMatchesHub } from "@/src/lib/ncm-hub-session";
import { resolveCompanyScope } from "@/src/server/company-scope";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireUser } from "@/src/server/tenant";
import {
  createSession,
  destroySession,
  getUserFromToken,
  readSessionCookie,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/src/server/auth";
import { getHubModulesFromCookie } from "@/src/server/hub-sso";

export async function GET() {
  try {
    const user = await requireUser();
    const scope = resolveCompanyScope(user);
    const hubModules = await getHubModulesFromCookie();
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
      isHubAdmin: hubModules.isAdmin,
      modules: {
        folha: hubModules.folha,
        conci: hubModules.conci,
        ncm: hubModules.ncm,
      },
    };

    // Em modo HUB, o cookie do HUB manda: sessão NCM de outro usuário é descartada.
    if (process.env.HUB_MODE === "1") {
      const existing = await readSessionCookie();
      const valid = await getUserFromToken(existing);
      if (!valid || !ncmSessionMatchesHub(valid.email, user.email)) {
        if (existing) await destroySession(existing);
        const token = await createSession(user, {
          activeCompanyId: user.role === "superadmin" ? user.activeCompanyId : null,
        });
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
