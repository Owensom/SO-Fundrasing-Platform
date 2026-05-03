import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const FORCE_ADMIN_EMAIL = "force@test.com";
const FORCE_ADMIN_PASSWORD = "forcepass123";
const FORCE_ADMIN_TENANT_SLUGS = ["demo-a"];

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

        if (email === FORCE_ADMIN_EMAIL && password === FORCE_ADMIN_PASSWORD) {
          return {
            id: "force-user",
            email: FORCE_ADMIN_EMAIL,
            name: "Force User",
            tenantSlugs: FORCE_ADMIN_TENANT_SLUGS,
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
        token.email = user.email ?? "";
        token.name = user.name ?? null;
        token.tenantSlugs = Array.isArray(user.tenantSlugs)
          ? user.tenantSlugs.map((value) => String(value))
          : [];
      }

      const tokenEmail = String(token.email ?? "").trim().toLowerCase();

      if (tokenEmail === FORCE_ADMIN_EMAIL) {
        token.userId = String(token.userId ?? "force-user");
        token.email = FORCE_ADMIN_EMAIL;
        token.name = token.name ? String(token.name) : "Force User";
        token.tenantSlugs = FORCE_ADMIN_TENANT_SLUGS;
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
