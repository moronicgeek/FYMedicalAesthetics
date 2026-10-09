import { NextResponse, type NextRequest } from "next/server";
import { KIOSK_COOKIE } from "./lib/kiosk";

// Cheap first gate: no session cookie means straight to sign-in. Every page
// and action still validates the session against the database itself.
const PROTECTED = ["/dashboard", "/checkin", "/patients", "/appointments", "/intake", "/staff", "/audit", "/kiosk", "/cases", "/settings"];

function redirectTo(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !req.cookies.has("fy_session")) return redirectTo(req, "/login");
  // A device in patient check-in mode can only show the check-in screens
  // until a staff member exits with their password.
  if (req.cookies.has(KIOSK_COOKIE) && !pathname.startsWith("/kiosk") && !pathname.startsWith("/d/") && pathname !== "/login" && req.method === "GET") {
    return redirectTo(req, "/kiosk");
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|api/).*)"] };
