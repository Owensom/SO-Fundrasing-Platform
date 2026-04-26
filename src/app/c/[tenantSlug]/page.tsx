// src/app/c/[tenantSlug]/page.tsx
import Link from "next/link";
import { getAllCampaignsForTenant } from "@/lib/campaigns";

type Params = {
  params: {
    tenantSlug: string;
  };
};

export default async function CampaignsPage({ params }: Params) {
  const tenantSlug = params.tenantSlug;

  const campaigns = await getAllCampaignsForTenant(tenantSlug);

  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Campaigns for {tenantSlug}</h1>

      {campaigns.length === 0 ? (
        <p>No active campaigns.</p>
      ) : (
        <ul>
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${tenantSlug}/${c.slug}`}>{c.title}</Link> — {c.type}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
