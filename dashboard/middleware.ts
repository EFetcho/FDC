import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "./lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/brand")) return NextResponse.next();

  const session = await readSession(request.cookies.get("fdc_session")?.value);

  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    if (!session || session.stage !== "full") {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!session) {
    if (pathname === "/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.stage === "full") {
    if (pathname === "/login" || pathname === "/enroll" || pathname === "/verify") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (session.stage === "pending" || session.stage === "codes") {
    if (pathname === "/enroll") return NextResponse.next();
    return NextResponse.redirect(new URL("/enroll", request.url));
  }

  if (session.stage === "verify") {
    if (pathname === "/verify") return NextResponse.next();
    return NextResponse.redirect(new URL("/verify", request.url));
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|fdc-logo.png).*)"],
};
