import { redirect } from "next/navigation";
import Dashboard from "../components/Dashboard";
import { currentSession } from "../lib/cookies";
import { loadDashboard } from "../lib/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await currentSession();
  if (!session || session.stage !== "full") redirect("/login");
  const data = await loadDashboard(session);
  return <Dashboard initial={data} />;
}
