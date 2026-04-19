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
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";

        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (email === "force@test.com" && password === "forcepass123") {
          return {
            id: "force-user",
            email: "force@test.com",
            name: "Force User",
            tenantSlugs: ["demo-a"],
            emailVerified: null,
          };
        }

        throw new Error("AUTHORIZE_RAN_BUT_CREDENTIALS_DID_NOT_MATCH");
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantSlugs = Array.isArray(user.tenantSlugs)
          ? user.tenantSlugs.map((value) => String(value))
          : [];
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
        ? token.tenantSlugs.map((value) => String(value))
        : [];

      return session;
    },
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
});
