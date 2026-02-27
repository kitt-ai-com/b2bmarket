import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/register");

  // 로그인 안 한 상태에서 보호된 페이지 접근
  if (!isLoggedIn && !isAuthPage && pathname !== "/") {
    return Response.redirect(new URL("/login", req.url));
  }

  // 로그인한 상태에서 인증 페이지 접근
  if (isLoggedIn && isAuthPage) {
    const role = (req.auth?.user as any)?.role;
    const redirectUrl =
      role === "SELLER" ? "/seller/dashboard" : "/admin/dashboard";
    return Response.redirect(new URL(redirectUrl, req.url));
  }

  return undefined;
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
