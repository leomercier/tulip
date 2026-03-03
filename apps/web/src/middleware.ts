import { NextRequest, NextResponse } from "next/server";

// Routes that require authentication
const PROTECTED_PREFIXES = ["/app"];
// Routes that should redirect to /app if already authenticated
const AUTH_ROUTES = ["/login", "/"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // The session cookie is set client-side via Firebase Auth.
  // We use a lightweight __session cookie set on sign-in to drive
  // server-side redirects without exposing Firebase internals.
  const sessionCookie = request.cookies.get("__session")?.value;
  const isAuthenticated = Boolean(sessionCookie);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (isProtected && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && isAuthenticated && pathname !== "/app") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and api routes that
     * handle their own auth.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
