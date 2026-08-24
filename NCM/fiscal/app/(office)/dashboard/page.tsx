import { KpiDashboard } from "@/src/components/dashboard/kpi-dashboard";
import { getCurrentUser } from "@/src/server/auth";
import { resolveCompanyScope } from "@/src/server/company-scope";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const scope = user ? resolveCompanyScope(user) : null;
  return <KpiDashboard companyName={scope?.companyName ?? "Empresa"} />;
}
