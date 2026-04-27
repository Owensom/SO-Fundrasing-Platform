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
      style={{
        maxWidth: 1000,
        margin: "40px auto",
        padding: 16,
        display: "grid",
        gap: 24,
      }}
    >
      {/* --------------------------
         HEADER (PUBLIC STYLE)
      -------------------------- */}
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 20,
          background: "#ffffff",
        }}
      >
        {raffle.image_url ? (
          <img
            src={raffle.image_url}
            alt={raffle.title || ""}
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

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Title</label>
            <input
              name="title"
              defaultValue={raffle.title || ""}
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 18,
                fontWeight: 600,
              }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Description</label>
            <textarea
              name="description"
              defaultValue={raffle.description || ""}
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Ticket price</label>
              <input
                name="ticket_price"
                type="number"
                step="0.01"
                defaultValue={(raffle.ticket_price_cents || 0) / 100}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>Start number</label>
              <input
                name="startNumber"
                type="number"
                defaultValue={config.startNumber || 1}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontWeight: 600 }}>End number</label>
              <input
                name="endNumber"
                type="number"
                defaultValue={config.endNumber || 100}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Image URL</label>
            <input
              name="image_url"
              defaultValue={raffle.image_url || ""}
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            />
          </div>
        </div>
      </div>

      {/* --------------------------
         HIDDEN FIELDS
      -------------------------- */}
      <input type="hidden" name="slug" defaultValue={raffle.slug || ""} />
      <input type="hidden" name="currency" defaultValue={raffle.currency || "GBP"} />
      <input type="hidden" name="status" defaultValue={raffle.status || "draft"} />

      {/* --------------------------
         SAVE BUTTON
      -------------------------- */}
      <button
        type="submit"
        style={{
          padding: "14px 20px",
          background: "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontWeight: 700,
          fontSize: 16,
          cursor: "pointer",
        }}
      >
        Save Changes
      </button>
    </form>
  );
}
