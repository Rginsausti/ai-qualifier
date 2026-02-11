import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));

  // Logged-in users should not stay in /login.
  if (path === "/login") {
    if (hasAuthCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Keep API/static/public routes out of auth redirects.
  const isPublicPath = 
    path.startsWith("/auth") || 
    path.startsWith("/api/auth") ||
    path.startsWith("/api") ||
    path.startsWith("/api/cron") ||
    path.startsWith("/_next") || 
    path.startsWith("/static") || 
    path.startsWith("/images") ||
    path.includes("."); // files like favicon.ico, robots.txt

  if (isPublicPath) {
    return NextResponse.next();
  }

  if (!hasAuthCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
