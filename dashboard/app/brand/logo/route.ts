import { readFile } from "fs/promises";
import path from "path";
import { LOGO_URL } from "../../../lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(LOGO_URL, {
      signal: AbortSignal.timeout(8_000),
      headers: { "user-agent": "FDC-Operations-Dashboard" },
    });
    if (response.ok) {
      const bytes = await response.arrayBuffer();
      return new Response(bytes, {
        headers: {
          "content-type": response.headers.get("content-type") || "image/png",
          "cache-control": "public, max-age=86400",
        },
      });
    }
  } catch (error) {
    console.error("Logo fetch failed", error instanceof Error ? error.message : error);
  }
  const fallback = await readFile(path.join(process.cwd(), "public", "fdc-logo.png"));
  return new Response(fallback, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" },
  });
}
