import { auth } from "@/auth";
import { sql } from "@/lib/db";

export async function requireAdminSession() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }

  return session;
}

export async function requireTenantAccess(tenantSlug: string) {
  const session = await requireAdminSession();

  const allowed = session.user.tenantSlugs.includes(tenantSlug);
  if (!allowed) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

export async function requireRaffleAdminAccess(raffleId: string) {
  const session = await requireAdminSession();

  const rows = await sql`
    select id, tenant_slug
    from raffles
    where id = ${raffleId}
    limit 1
  `;

  if (!rows.length) {
    throw new Error("NOT_FOUND");
  }

  const raffle = rows[0];
  const tenantSlug = String(raffle.tenant_slug);

  if (!session.user.tenantSlugs.includes(tenantSlug)) {
    throw new Error("FORBIDDEN");
  }

  return {
    session,
    raffle: {
      id: String(raffle.id),
      tenant_slug: tenantSlug,
    },
  };
}
