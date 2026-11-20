import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("narrator_session")?.value;
  if (!token) {
    const next = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    const url = new URL("/login", req.url);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
