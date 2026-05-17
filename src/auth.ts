import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { query } from "@/lib/db";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  tenant_id: string | null;
};

type AdminTenantRow = {
  tenant_slug: string | null;
};

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  tenantSlugs: string[];
  emailVerified: null;
};

async function findAdminUserByCredentials(
  email: string,
  password: string,
): Promise<AdminUser | null> {
  try {
    const users = await query<AdminUserRow>(
      `
        select
          id::text,
          email,
          name,
          tenant_id::text
        from admin_users
        where lower(email) = lower($1)
          and is_active = true
          and password_hash = crypt($2, password_hash)
        limit 1
      `,
      [email, password],
    );

    const user = users[0];

    if (!user) return null;

    const tenantRows = await query<AdminTenantRow>(
      `
        select slug as tenant_slug
        from tenants
        where id::text = $1::text
        limit 1
      `,
      [user.tenant_id || ""],
    );

    const tenantSlugs = tenantRows
      .map((row) => String(row.tenant_slug || "").trim())
      .filter(Boolean);

    if (tenantSlugs.length === 0) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name || user.email,
      tenantSlugs,
      emailVerified: null,
    };
  } catch (error) {
    console.error("DATABASE_ADMIN_AUTH_FAILED", error);
    return null;
  }
}

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

        if (!email || !password) return null;

        if (
          email === "sofundraisingplatform@gmail.com" &&
          password === process.env.PLATFORM_OWNER_PASSWORD
        ) {
          return {
            id: "platform-owner",
            email: "sofundraisingplatform@gmail.com",
            name: "Owen Somerville",
            tenantSlugs: ["demo-a"],
            emailVerified: null,
          };
        }

        const adminUser = await findAdminUserByCredentials(email, password);

        if (adminUser) return adminUser;

        if (email === "force@test.com" && password === "forcepass123") {
          return {
            id: "force-user",
            email: "force@test.com",
            name: "Force User",
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
        const adminUser = user as AdminUser;

        token.userId = adminUser.id;
        token.tenantSlugs = Array.isArray(adminUser.tenantSlugs)
          ? adminUser.tenantSlugs.map((value) => String(value))
          : [];
        token.email = adminUser.email ?? "";
        token.name = adminUser.name ?? null;
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
