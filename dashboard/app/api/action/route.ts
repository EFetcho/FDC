import { runAction } from "../../../lib/actions";
import { errorResponse, json, readJson, requireFullSession } from "../../../lib/guard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireFullSession();
    const body = await readJson(request);
    const type = typeof body.type === "string" ? body.type : "";
    return json(await runAction(session, type, body));
  } catch (error) {
    return errorResponse(error);
  }
}
