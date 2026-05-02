import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import NewRaffleForm from "@/components/admin/NewRaffleForm";

export default async function NewRafflePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return (
    <main
      style={{
        maxWidth: 1040,
        margin: "0 auto",
        padding: "96px 16px 48px",
      }}
    >
      <NewRaffleForm tenantSlug={tenantSlug} />
    </main>
  );
}
