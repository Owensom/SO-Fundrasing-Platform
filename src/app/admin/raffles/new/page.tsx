import Link from "next/link";
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
        margin: "40px auto",
        padding: "0 16px 48px",
      }}
    >
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
                <Link
          href="/admin/raffles"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 18px",
            borderRadius: 999,
            background: "#ffffff",
            color: "#0f172a",
            border: "1px solid #cbd5e1",
            textDecoration: "none",
            fontWeight: 950,
            boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
          }}
        >
          ← Back to raffles
        </Link>

        <Link
          href="/admin"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 18px",
            borderRadius: 999,
            background: "#0f172a",
            color: "#ffffff",
            border: "1px solid #0f172a",
            textDecoration: "none",
            fontWeight: 950,
            boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
          }}
        >
          Dashboard
        </Link>
      </section>

      <NewRaffleForm tenantSlug={tenantSlug} />
          </main>
  );
}
