import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";

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

        if (!email || !password) {
          return null;
        }

        const users = await sql`
          select
            u.id,
            u.email,
            u.name,
            u.password_hash,
            u.is_active,
            coalesce(
              json_agg(aut.tenant_slug) filter (where aut.tenant_slug is not null),
              '[]'::json
            ) as tenant_slugs
          from admin_users u
          left join admin_user_tenants aut
            on aut.admin_user_id = u.id
          where lower(u.email) = ${email}
          group by u.id, u.email, u.name, u.password_hash, u.is_active
          limit 1
        `;

        if (!users.length) {
          return null;
        }

        const user = users[0];

        if (!user.is_active) {
          return null;
        }

        const isValid = await bcrypt.compare(password, String(user.password_hash));

        if (!isValid) {
          return null;
        }

        const tenantSlugs = Array.isArray(user.tenant_slugs)
          ? user.tenant_slugs.map((value: unknown) => String(value))
          : [];

        if (tenantSlugs.length === 0) {
          return null;
        }

        return {
          id: String(user.id),
          email: String(user.email),
          name: user.name ? String(user.name) : null,
          tenantSlugs,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.tenantSlugs = user.tenantSlugs;
        token.email = user.email ?? "";
        token.name = user.name ?? null;
      }

      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: String(token.userId ?? ""),
        email: String(token.email ?? ""),
        name: token.name ? String(token.name) : null,
        tenantSlugs: Array.isArray(token.tenantSlugs)
          ? token.tenantSlugs.map((value) => String(value))
          : [],
      };

      return session;
    },
  },
  trustHost: true,
});
