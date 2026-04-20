import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PREFIXES = ["/auth"];
const PUBLIC_PATHS = ["/", "/login", "/pricing"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix + "/"));
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/auth/login";
    redirect.searchParams.set("next", pathname + search);
    return NextResponse.redirect(redirect);
  }

  if (user && (pathname === "/auth/login" || pathname === "/auth/signup")) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/home";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자산 / 이미지 / 파비콘 / API 제외 (API 는 route 레벨에서 보호)
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|robots.txt|sitemap.xml|api/).*)",
  ],
};
