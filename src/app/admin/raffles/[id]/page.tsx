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
  const colours = config.colours || [];
  const offers = config.offers || [];
  const prizes = config.prizes || [];

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
      {/* ==========================
         HEADER (KEEP THIS)
      ========================== */}
      <div style={{
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 20,
        background: "#ffffff",
      }}>
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
          <div style={{
            height: 160,
            background: "#f1f5f9",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
            marginBottom: 16,
          }}>
            No image
          </div>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <input name="title" defaultValue={raffle.title || ""} />
          <textarea name="description" defaultValue={raffle.description || ""} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <input
              name="ticket_price"
              type="number"
              step="0.01"
              defaultValue={(raffle.ticket_price_cents || 0) / 100}
            />
            <input name="startNumber" type="number" defaultValue={config.startNumber || 1} />
            <input name="endNumber" type="number" defaultValue={config.endNumber || 100} />
          </div>

          <input name="image_url" defaultValue={raffle.image_url || ""} />
        </div>
      </div>

      {/* ==========================
         COLOURS (RESTORED)
      ========================== */}
      <div>
        <h3>Colours</h3>
        <input
          name="custom_colours"
          defaultValue={colours.map((c: any) => c.hex || c).join(",")}
          style={{ width: "100%" }}
        />
      </div>

      {/* ==========================
         OFFERS (RESTORED)
      ========================== */}
      <div>
        <h3>Offers</h3>

        <input type="hidden" name="offer_count" value={offers.length} />

        {offers.map((offer: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 10 }}>
            <input
              name={`offer_quantity_${i}`}
              defaultValue={offer.quantity}
              placeholder="Qty"
            />
            <input
              name={`offer_price_${i}`}
              defaultValue={offer.price}
              placeholder="Price"
            />
            <input
              type="hidden"
              name={`offer_active_${i}`}
              value={offer.isActive ? "true" : "false"}
            />
          </div>
        ))}
      </div>

      {/* ==========================
         PRIZES (RESTORED)
      ========================== */}
      <div>
        <h3>Prizes</h3>

        {prizes.map((prize: any, i: number) => (
          <div key={i}>
            <input
              name={`prize_title_${i}`}
              defaultValue={prize.title || ""}
            />
          </div>
        ))}
      </div>

      {/* ==========================
         HIDDEN FIELDS
      ========================== */}
      <input type="hidden" name="slug" defaultValue={raffle.slug || ""} />
      <input type="hidden" name="currency" defaultValue={raffle.currency || "GBP"} />
      <input type="hidden" name="status" defaultValue={raffle.status || "draft"} />

      {/* ==========================
         SAVE
      ========================== */}
      <button
        type="submit"
        style={{
          padding: "14px 20px",
          background: "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontWeight: 700,
        }}
      >
        Save Changes
      </button>
    </form>
  );
}
