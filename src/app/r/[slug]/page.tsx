// src/app/r/[slug]/page.tsx

import { notFound } from "next/navigation";
import { getRaffleBySlug } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

type Props = {
  params: { slug: string };
};

export default async function PublicRafflePage({ params }: Props) {
  const tenantSlug = getTenantSlugFromHeaders();
  const raffle = await getRaffleBySlug(tenantSlug, params.slug);

  if (!raffle) return notFound();

  const config = (raffle.config_json as any) || {};
  const imagePosition = config.image_position || "center";

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      
      {/* IMAGE */}
      {raffle.image_url ? (
        <div
          style={{
            width: "100%",
            height: 260,
            overflow: "hidden",
            borderRadius: 16,
            marginBottom: 20,
            background: "#f1f5f9",
          }}
        >
          <img
            src={raffle.image_url}
            alt={raffle.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: imagePosition, // ✅ KEY FEATURE
            }}
          />
        </div>
      ) : null}

      {/* TITLE */}
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>
        {raffle.title}
      </h1>

      {/* DESCRIPTION */}
      {raffle.description && (
        <p style={{ marginTop: 10, color: "#475569" }}>
          {raffle.description}
        </p>
      )}

      {/* PRIZES */}
      {config.prizes?.length ? (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Prizes</h2>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            {config.prizes
              .filter((p: any) => p.isPublic !== false)
              .map((prize: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {i + 1}. {prize.title || prize.name}
                  </div>
                  {prize.description && (
                    <div style={{ color: "#64748b", marginTop: 4 }}>
                      {prize.description}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
