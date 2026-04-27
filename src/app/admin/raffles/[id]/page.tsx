import { notFound } from "next/navigation";
import { getRaffleById } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

type Props = {
  params: { id: string };
};

export default async function AdminRafflePage({ params }: Props) {
  const tenantSlug = getTenantSlugFromHeaders();
  const raffle = await getRaffleById(params.id);

  if (!raffle || raffle.tenant_slug !== tenantSlug) {
    return notFound();
  }

  const config = (raffle.config_json as any) || {};

  return (
    <form
      action={`/api/admin/raffles/${raffle.id}`}
      method="POST"
      style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}
    >
      {/* --------------------------
         PUBLIC-STYLE HEADER PREVIEW
      -------------------------- */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 20,
          marginBottom: 24,
          background: "#ffffff",
        }}
      >
        {raffle.image_url ? (
          <img
            src={raffle.image_url}
            alt={raffle.title}
            style={{
              width: "100%",
              maxHeight: 260,
              objectFit: "cover",
              borderRadius: 12,
              marginBottom: 16,
            }}
          />
        ) : (
          <div
            style={{
              height: 160,
              background: "#f1f5f9",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              marginBottom: 16,
            }}
          >
            No image
          </div>
        )}

        <input
          name="title"
          defaultValue={raffle.title}
          placeholder="Raffle title"
          style={{
            width: "100%",
            fontSize: 24,
            fontWeight: 700,
            border: "none",
            marginBottom: 8,
          }}
        />

        <textarea
          name="description"
          defaultValue={raffle.description}
          placeholder="Description"
          style={{
            width: "100%",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            padding: 10,
            marginBottom: 12,
          }}
        />

        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <input
            name="ticket_price"
            defaultValue={(raffle.ticket_price_cents || 0) / 100}
            placeholder="Price"
            type="number"
            step="0.01"
            style={{
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />

          <input
            name="startNumber"
            defaultValue={config.startNumber || 1}
            placeholder="Start"
            type="number"
            style={{
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />

          <input
            name="endNumber"
            defaultValue={config.endNumber || 100}
            placeholder="End"
            type="number"
            style={{
              padding: 8,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          />
        </div>

        <input
          name="image_url"
          defaultValue={raffle.image_url}
          placeholder="Image URL"
          style={{
            width: "100%",
            padding: 8,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        />
      </div>

      {/* --------------------------
         KEEP EXISTING ADMIN LOGIC
      -------------------------- */}

      {/* Hidden fields (important) */}
      <input type="hidden" name="slug" defaultValue={raffle.slug} />
      <input type="hidden" name="currency" defaultValue={raffle.currency} />
      <input type="hidden" name="status" defaultValue={raffle.status} />

      {/* Submit */}
      <button
        type="submit"
        style={{
          marginTop: 20,
          padding: "12px 20px",
          background: "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 10,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Save Changes
      </button>
    </form>
  );
}
