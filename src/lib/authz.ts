import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { getTenantSlugFromHeaders, getTenantSlugFromRequest } from "@/lib/tenant";

export async function requireAdminSession() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("UNAUTHENTICATED");
  }

  return session;
}

export async function requireCurrentTenantAccess() {
  const session = await requireAdminSession();
  const tenantSlug = await getTenantSlugFromHeaders();

  if (!session.user.tenantSlugs.includes(tenantSlug)) {
    throw new Error("FORBIDDEN");
  }

  return {
    session,
    tenantSlug,
  };
}

export async function requireTenantAccess(tenantSlug: string) {
  const session = await requireAdminSession();

  if (!session.user.tenantSlugs.includes(tenantSlug)) {
    throw new Error("FORBIDDEN");
  }

  return session;
}

export async function requireRaffleAdminAccess(
  raffleId: string,
  request?: Request,
) {
  const session = await requireAdminSession();

  const currentTenantSlug = request
    ? getTenantSlugFromRequest(request)
    : await getTenantSlugFromHeaders();

  if (!session.user.tenantSlugs.includes(currentTenantSlug)) {
    throw new Error("FORBIDDEN");
  }

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
  const raffleTenantSlug = String(raffle.tenant_slug);

  if (raffleTenantSlug !== currentTenantSlug) {
    throw new Error("FORBIDDEN");
  }

  return {
    session,
    tenantSlug: currentTenantSlug,
    raffle: {
      id: String(raffle.id),
      tenant_slug: raffleTenantSlug,
    },
  };
}
