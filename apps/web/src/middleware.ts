import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Auth is handled entirely client-side via Firebase onAuthStateChanged.
// This middleware exists only to exclude static assets from processing.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
