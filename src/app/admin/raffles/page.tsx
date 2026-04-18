import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { sql } from "@/lib/db";
import { normalizeStatus } from "@/lib/raffles";

type RaffleRow = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
};

export default async function AdminRafflesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlugs = session.user.tenantSlugs;

  if (tenantSlugs.length === 0) {
    return (
      <div style={{ maxWidth: 960, margin: "40px auto", padding: 24 }}>
        <h1>Raffles</h1>
        <p>No tenant access found for this account.</p>
      </div>
    );
  }

  const rows = (await sql`
    select
      id,
      tenant_slug,
      slug,
      title,
      status,
      updated_at
    from raffles
    where tenant_slug = any(${tenantSlugs}::text[])
    order by updated_at desc
  `) as RaffleRow[];

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: 24 }}>
      <h1>Raffles</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {rows.map((raffle) => (
          <div
            key={raffle.id}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div>
              <strong>{raffle.title}</strong>
            </div>
            <div>Tenant: {raffle.tenant_slug}</div>
            <div>Slug: {raffle.slug}</div>
            <div>Status: {normalizeStatus(raffle.status)}</div>
            <div>
              <Link href={`/admin/raffles/${raffle.id}/edit`}>Edit</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
