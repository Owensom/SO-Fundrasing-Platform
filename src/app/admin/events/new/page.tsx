import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import NewEventForm from "@/components/admin/NewEventForm";

export default async function NewEventPage() {
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
        margin: "40px auto",
        padding: "0 16px 48px",
      }}
    >
      <NewEventForm tenantSlug={tenantSlug} />
    </main>
  );
}
