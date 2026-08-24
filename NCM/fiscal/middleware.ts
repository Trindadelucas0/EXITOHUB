import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/src/lib/constants";

const HUB_COOKIE = "exito_hub_sid";
const PUBLIC = ["/login"];
const PUBLIC_ASSETS = ["/favicon.ico", "/icon", "/icon.png", "/exito-logo.png"];

function redirectPath(request: NextRequest, pathname: string) {
  const location = `${pathname}${request.nextUrl.search}`;
  return new NextResponse(null, {
    status: 307,
    headers: { Location: location },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hubMode = process.env.HUB_MODE === "1";
  const basePath = hubMode ? "/ncm" : "";

  // Pathname no middleware do Next com basePath costuma vir sem o prefixo.
  const path = pathname.startsWith(basePath) && basePath
    ? pathname.slice(basePath.length) || "/"
    : pathname;

  if (
    path.startsWith("/api/auth/login") ||
    path.startsWith("/_next") ||
    PUBLIC_ASSETS.includes(path)
  ) {
    return NextResponse.next();
  }

  if (hubMode && (path === "/login" || path.startsWith("/api/auth/login"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.basePath = "";
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hubSid = request.cookies.get(HUB_COOKIE)?.value;
  const isPublic = PUBLIC.some((p) => path === p);

  if (!token && !(hubMode && hubSid) && !isPublic && !path.startsWith("/api")) {
    if (hubMode) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return redirectPath(request, `${basePath}/login`);
  }

  if ((token || (hubMode && hubSid)) && path === "/login") {
    if (hubMode) {
      return NextResponse.redirect(new URL("/ncm/", request.url));
    }
    return redirectPath(request, `${basePath}/`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
