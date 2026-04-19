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

  const hasAccess = sessionTenantSlugs.includes(tenantSlug);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>Admin</h1>

      <p>
        Tenant from host: <strong>{tenantSlug || "(empty)"}</strong>
      </p>

      <p>
        Signed in as: <strong>{session.user.email}</strong>
      </p>

      <p>
        Session tenant slugs:{" "}
        <strong>
          {sessionTenantSlugs.length > 0
            ? sessionTenantSlugs.join(", ")
            : "(none)"}
        </strong>
      </p>

      <p>
        Access check: <strong>{hasAccess ? "allowed" : "denied"}</strong>
      </p>

      {hasAccess ? (
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <Link href="/admin/raffles">Manage raffles</Link>
        </div>
      ) : (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fff7ed",
          }}
        >
          <p style={{ margin: 0 }}>
            Tenant membership is not matching yet.
          </p>
        </div>
      )}

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
