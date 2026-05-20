import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { query } from "@/lib/db";

type AdminUserRow = {
  id: string;
  email: string;
  name: string | null;
  tenant_id: string | null;
  password_matches: boolean;
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
  isPlatformOwner?: boolean;
};

function getPlatformOwnerEmail() {
  return String(
    process.env.PLATFORM_OWNER_EMAIL || "sofundraisingplatform@gmail.com",
  )
    .trim()
    .toLowerCase();
}

function isPlatformOwnerEmail(value: string) {
  return value.trim().toLowerCase() === getPlatformOwnerEmail();
}

function maskEmail(value: string) {
  const [name, domain] = value.split("@");

  if (!name || !domain) return value;

  return `${name.slice(0, 3)}***@${domain}`;
}

function uniqueTenantSlugs(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

async function getTenantSlugsForAdminUser(params: {
  adminUserId: string;
  fallbackTenantId?: string | null;
}) {
  const linkedTenantRows = await query<AdminTenantRow>(
    `
      select tenant_slug
      from admin_user_tenants
      where admin_user_id = $1
      order by
        case
          when role = 'platform_owner' then 0
          when role = 'owner' then 1
          else 2
        end,
        tenant_slug asc
    `,
    [params.adminUserId],
  );

  const linkedTenantSlugs = uniqueTenantSlugs(
    linkedTenantRows.map((row) => row.tenant_slug),
  );

  if (linkedTenantSlugs.length > 0) {
    return linkedTenantSlugs;
  }

  const fallbackTenantRows = await query<AdminTenantRow>(
    `
      select slug as tenant_slug
      from tenants
      where id::text = $1::text
      limit 1
    `,
    [params.fallbackTenantId || ""],
  );

  return uniqueTenantSlugs(fallbackTenantRows.map((row) => row.tenant_slug));
}

async function getPlatformOwnerTenantSlugs() {
  const ownerEmail = getPlatformOwnerEmail();

  const rows = await query<AdminTenantRow>(
    `
      select distinct aut.tenant_slug
      from admin_users au
      join admin_user_tenants aut
        on aut.admin_user_id = au.id
      where lower(au.email) = lower($1)
        and au.is_active = true
      order by aut.tenant_slug asc
    `,
    [ownerEmail],
  );

  const tenantSlugs = uniqueTenantSlugs(rows.map((row) => row.tenant_slug));

  if (tenantSlugs.length > 0) {
    return tenantSlugs;
  }

  return ["demo-a"];
}

async function findAdminUserByCredentials(
  email: string,
  password: string,
): Promise<AdminUser | null> {
  try {
    console.log("ADMIN_AUTH_DB_LOOKUP_START", {
      email: maskEmail(email),
      hasPassword: Boolean(password),
    });

    const users = await query<AdminUserRow>(
      `
        select
          id::text,
          email,
          coalesce(name, full_name, email) as name,
          tenant_id::text,
          password_hash = crypt($2, password_hash) as password_matches
        from admin_users
        where lower(email) = lower($1)
          and is_active = true
        limit 1
      `,
      [email, password],
    );

    const user = users[0];

    if (!user) {
      console.log("ADMIN_AUTH_DB_NO_ACTIVE_USER", {
        email: maskEmail(email),
      });

      return null;
    }

    console.log("ADMIN_AUTH_DB_USER_FOUND", {
      id: user.id,
      email: maskEmail(user.email),
      tenantId: user.tenant_id,
      passwordMatches: Boolean(user.password_matches),
    });

    if (!user.password_matches) {
      return null;
    }

    const tenantSlugs = await getTenantSlugsForAdminUser({
      adminUserId: user.id,
      fallbackTenantId: user.tenant_id,
    });

    console.log("ADMIN_AUTH_DB_TENANTS_RESOLVED", {
      email: maskEmail(user.email),
      tenantSlugs,
    });

    if (tenantSlugs.length === 0) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name || user.email,
      tenantSlugs,
      emailVerified: null,
      isPlatformOwner: isPlatformOwnerEmail(user.email),
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

        const isOwnerEmail = isPlatformOwnerEmail(email);

        console.log("ADMIN_AUTH_AUTHORIZE_START", {
          email: maskEmail(email),
          hasEmail: Boolean(email),
          hasPassword: Boolean(password),
          isOwnerEmail,
          isForceEmail: email === "force@test.com",
          hasPlatformOwnerPasswordEnv: Boolean(
            process.env.PLATFORM_OWNER_PASSWORD,
          ),
        });

        if (!email || !password) {
          console.log("ADMIN_AUTH_MISSING_CREDENTIALS", {
            hasEmail: Boolean(email),
            hasPassword: Boolean(password),
          });

          return null;
        }

        if (
          isOwnerEmail &&
          process.env.PLATFORM_OWNER_PASSWORD &&
          password === process.env.PLATFORM_OWNER_PASSWORD
        ) {
          const tenantSlugs = await getPlatformOwnerTenantSlugs();

          console.log("ADMIN_AUTH_PLATFORM_OWNER_ENV_SUCCESS", {
            tenantSlugs,
          });

          return {
            id: "platform-owner",
            email: getPlatformOwnerEmail(),
            name: "Owen Somerville",
            tenantSlugs,
            emailVerified: null,
            isPlatformOwner: true,
          };
        }

        console.log("ADMIN_AUTH_BEFORE_DB_LOOKUP", {
          email: maskEmail(email),
        });

        const adminUser = await findAdminUserByCredentials(email, password);

        if (adminUser) {
          console.log("ADMIN_AUTH_DB_SUCCESS", {
            email: maskEmail(adminUser.email),
            tenantSlugs: adminUser.tenantSlugs,
            isPlatformOwner: Boolean(adminUser.isPlatformOwner),
          });

          return adminUser;
        }

        console.log("ADMIN_AUTH_BEFORE_FORCE_FALLBACK", {
          email: maskEmail(email),
        });

        if (email === "force@test.com" && password === "forcepass123") {
          console.log("ADMIN_AUTH_FORCE_FALLBACK_SUCCESS");

          return {
            id: "force-user",
            email: "force@test.com",
            name: "Force User",
            tenantSlugs: ["demo-a"],
            emailVerified: null,
            isPlatformOwner: false,
          };
        }

        console.log("ADMIN_AUTH_RETURNING_NULL", {
          email: maskEmail(email),
        });

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
          ? uniqueTenantSlugs(adminUser.tenantSlugs)
          : [];
        token.email = adminUser.email ?? "";
        token.name = adminUser.name ?? null;
        (token as any).isPlatformOwner = Boolean(
          adminUser.isPlatformOwner || isPlatformOwnerEmail(adminUser.email),
        );
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = String(token.userId ?? "");
      session.user.email = String(token.email ?? "");
      session.user.name = token.name ? String(token.name) : null;
      session.user.tenantSlugs = Array.isArray(token.tenantSlugs)
        ? uniqueTenantSlugs(token.tenantSlugs.map((value) => String(value)))
        : [];
      (session.user as any).isPlatformOwner = Boolean(
        (token as any).isPlatformOwner,
      );

      return session;
    },
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
});
