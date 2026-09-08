/**
 * Em modo HUB, o cookie exito_hub_sid é a fonte da verdade.
 * Sessão NCM (fiscal_session) só vale se for o mesmo usuário.
 */
export function ncmSessionMatchesHub(
  sessionEmail: string | null | undefined,
  hubEmail: string | null | undefined,
): boolean {
  const session = String(sessionEmail ?? "").trim().toLowerCase();
  const hub = String(hubEmail ?? "").trim().toLowerCase();
  if (!session || !hub) return false;
  return session === hub;
}
