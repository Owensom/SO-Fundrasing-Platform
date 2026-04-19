import { getTenantSlugFromHeaders, getTenantSlugFromRequest } from "@/lib/tenant";

type Session = {
  user: {
    id: string;
    email: string;
    tenantSlugs: string[];
  };
};

export async function requireTenantAccess(
  session: Session | null,
  request?: Request | { headers: Headers },
): Promise<string> {
  if (!session || !session.user) {
    throw new Error("UNAUTHENTICATED");
  }

  const currentTenantSlug =
    (request
      ? getTenantSlugFromRequest(request)
      : getTenantSlugFromHeaders()) || "";

  if (!currentTenantSlug) {
    throw new Error("NO_TENANT");
  }

  if (!session.user.tenantSlugs.includes(currentTenantSlug)) {
    throw new Error("FORBIDDEN");
  }

  return currentTenantSlug;
}
