import { loadDashboard } from "../../../lib/dashboard";
import { errorResponse, json, requireFullSession } from "../../../lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireFullSession();
    return json(await loadDashboard(session));
  } catch (error) {
    return errorResponse(error);
  }
}
