import { readSessionCookie, setActiveCompany } from "@/src/server/auth";
import { jsonError, jsonOk } from "@/src/server/http";
import { requireSuperAdmin, requireUser } from "@/src/server/tenant";

export async function POST() {
  try {
    const user = await requireUser();
    requireSuperAdmin(user);
    await setActiveCompany(await readSessionCookie(), null);
    return jsonOk({ redirectTo: "/escritorio/empresas" });
  } catch (error) {
    return jsonError(error);
  }
}
