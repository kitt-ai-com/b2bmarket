import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

/**
 * 역할별 기본 대시보드 경로를 반환합니다.
 */
function getDashboardByRole(role: string | undefined): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    case "SELLER":
      return "/seller/dashboard";
    default:
      return "/login";
  }
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = (req.auth?.user as any)?.role as string | undefined;
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");
  const isPublicPage = pathname.startsWith("/invite");

  // 로그인 안 한 상태에서 보호된 페이지 접근
  if (!isLoggedIn && !isAuthPage && !isPublicPage && pathname !== "/") {
    return Response.redirect(new URL("/login", req.url));
  }

  // 로그인한 상태에서 인증 페이지 접근 → 역할별 대시보드로 리다이렉트
  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL(getDashboardByRole(role), req.url));
  }

  // 로그인한 상태에서 라우트 보호 (역할별 접근 제어)
  if (isLoggedIn) {
    const dashboard = getDashboardByRole(role);

    // /super-admin/* : SUPER_ADMIN만 허용
    if (pathname.startsWith("/super-admin")) {
      if (role !== "SUPER_ADMIN") {
        return Response.redirect(new URL(dashboard, req.url));
      }
    }

    // /admin/* : ADMIN 또는 SUPER_ADMIN만 허용
    if (pathname.startsWith("/admin")) {
      if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
        return Response.redirect(new URL(dashboard, req.url));
      }
    }

    // /seller/* : SELLER만 허용
    if (pathname.startsWith("/seller")) {
      if (role !== "SELLER") {
        return Response.redirect(new URL(dashboard, req.url));
      }
    }
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
