import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    Credentials({
      name: "Admin login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials?.email === "admin@test.com" &&
          credentials?.password === "password"
        ) {
          return {
            id: "1",
            email: "admin@test.com",
            name: "Test Admin",
            tenantSlugs: ["demo-a"],
            emailVerified: null,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantSlugs = user.tenantSlugs ?? [];
        token.email = user.email ?? "";
        token.name = user.name ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.userId ?? "");
      session.user.email = String(token.email ?? "");
      session.user.name = token.name ? String(token.name) : null;
      session.user.tenantSlugs = Array.isArray(token.tenantSlugs)
        ? token.tenantSlugs
        : [];

      return session;
    },
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
});
