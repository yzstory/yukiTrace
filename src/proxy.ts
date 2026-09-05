import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/signup", "/share", "/invite"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const session = await decrypt(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !session?.userId) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/signup") && session?.userId) {
    return NextResponse.redirect(new URL("/trips", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|icons|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
