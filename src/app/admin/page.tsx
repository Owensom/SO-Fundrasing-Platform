import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export default async function AdminHomePage() {
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
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Admin</h1>

      <p>
        Tenant: <strong>{tenantSlug}</strong>
      </p>

      <p>
        Signed in as <strong>{session.user.email}</strong>
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <Link href="/admin/raffles">Manage raffles</Link>
        <Link href="/admin/raffles/new">Create raffle</Link>
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/admin/login" });
        }}
        style={{ marginTop: 24 }}
      >
        <button type="submit">Sign out</button>
      </form>
    </div>
  );
}
