import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "./lib/csp";
import { KIOSK_COOKIE } from "./lib/kiosk";

// Cheap first gate: no session cookie means straight to sign-in. Every page
// and action still validates the session against the database itself.
const PROTECTED = ["/dashboard", "/checkin", "/patients", "/appointments", "/intake", "/staff", "/audit", "/kiosk", "/cases", "/settings", "/account", "/report", "/problems"];

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
  // until a staff member exits with their password. Form posts to other pages
  // are refused too; requireUser() enforces the same for server actions.
  if (req.cookies.has(KIOSK_COOKIE) && !pathname.startsWith("/kiosk") && !pathname.startsWith("/d/") && pathname !== "/login") {
    if (req.method !== "GET" && req.method !== "HEAD") return new NextResponse("Not available in check-in mode.", { status: 403 });
    return redirectTo(req, "/kiosk");
  }
  // A fresh nonce per page; Next.js reads it from the request's CSP header
  // and puts it on the scripts it renders.
  const csp = contentSecurityPolicy(btoa(crypto.randomUUID()));
  const headers = new Headers(req.headers);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = { matcher: ["/((?!_next|favicon.ico|api/).*)"] };
