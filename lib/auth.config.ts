import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;

      const publicPaths = ["/login", "/api/auth"];
      if (publicPaths.some((p) => pathname.startsWith(p))) {
        return true;
      }

      if (!isLoggedIn) return false;

      const role = auth?.user?.role;
      const driverPaths = ["/capture", "/trips"];
      const adminPaths = ["/dashboard", "/admin"];

      if (driverPaths.some((p) => pathname.startsWith(p)) && role !== "CHOFER") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (adminPaths.some((p) => pathname.startsWith(p)) && role !== "ADMIN") {
        return Response.redirect(new URL("/capture", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.companyId = user.companyId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as import("@prisma/client").Role;
      session.user.companyId = token.companyId as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
