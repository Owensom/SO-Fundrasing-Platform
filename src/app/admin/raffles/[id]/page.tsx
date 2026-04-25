import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";
import ImageUploadField from "@/components/ImageUploadField";

type PageProps = {
  params: {
    id: string;
  };
};

type WinnerRow = {
  id: string;
  raffle_id: string;
  prize_position: number;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
};

const PRESET_COLOURS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
  "Black",
  "White",
];

function colourToText(colour: any) {
  if (typeof colour === "string") return colour;
  if (colour?.name) return colour.name;
  if (colour?.hex) return colour.hex;
  return "";
}

function normaliseOfferForUI(offer: any, index: number) {
  const quantity = Number(offer?.quantity ?? offer?.tickets ?? 0);
  const price =
    offer?.price != null
      ? Number(offer.price)
      : offer?.price_cents != null
        ? Number(offer.price_cents) / 100
        : 0;

  return {
    id: offer?.id || `offer-${index + 1}`,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : "",
    price: Number.isFinite(price) && price > 0 ? price : "",
    is_active:
      offer?.is_active === false ||
      offer?.isActive === false ||
      offer?.active === false
        ? false
        : true,
  };
}

export default async function AdminRafflePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const raffle = await getRaffleById(params.id);
  if (!raffle) notFound();

  const config = (raffle.config_json as any) ?? {};
  const colours = Array.isArray(config.colours)
    ? config.colours.map(colourToText).filter(Boolean)
    : [];

  const offers = Array.isArray(config.offers)
    ? config.offers.map(normaliseOfferForUI)
    : [];

  const offerRows = [
    ...offers,
    ...Array.from({ length: Math.max(2, 5 - offers.length) }, (_, index) => ({
      id: `new-offer-${index + 1}`,
      quantity: "",
      price: "",
      is_active: true,
    })),
  ];

  const winners = await query<WinnerRow>(
    `
    select *
    from raffle_winners
    where raffle_id = $1
    order by prize_position asc
    `,
    [raffle.id],
  );

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <p>
        <Link href="/admin/raffles">← Back to raffles</Link>
      </p>

      <h1>{raffle.title}</h1>

      <p>
        <Link href={`/r/${raffle.slug}`} target="_blank">
          View public page
        </Link>
      </p>

      <RaffleAdminActions raffleId={raffle.id} status={raffle.status} />

      <section
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          background: "#fff",
        }}
      >
        <h2>Edit raffle</h2>

        <form
          action={`/api/admin/raffles/${raffle.id}`}
          method="post"
          style={{ display: "grid", gap: 18 }}
        >
          <label>
            Title
            <input
              name="title"
              defaultValue={raffle.title}
              required
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Slug
            <input
              name="slug"
              defaultValue={raffle.slug}
              required
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Description
            <textarea
              name="description"
              rows={4}
              defaultValue={raffle.description ?? ""}
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <ImageUploadField currentImageUrl={raffle.image_url ?? ""} />

          <label>
            Ticket price
            <input
              name="ticket_price"
              type="number"
              step="0.01"
              min={0}
              defaultValue={Number(raffle.ticket_price) > 0 ? raffle.ticket_price : ""}
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label>
              Start number
              <input
                name="startNumber"
                type="number"
                defaultValue={config.startNumber ?? 1}
                style={{ display: "block", width: "100%", padding: 10 }}
              />
            </label>

            <label>
              End number
              <input
                name="endNumber"
                type="number"
                defaultValue={config.endNumber ?? raffle.total_tickets}
                style={{ display: "block", width: "100%", padding: 10 }}
              />
            </label>
          </div>

          <section>
            <h3>Ticket colours</h3>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {PRESET_COLOURS.map((colour) => (
                <label
                  key={colour}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid #d1d5db",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    name="colour_preset"
                    value={colour}
                    defaultChecked={colours.includes(colour)}
                    style={{ marginRight: 6 }}
                  />
                  {colour}
                </label>
              ))}
            </div>

            <label style={{ display: "block", marginTop: 12 }}>
              Custom colours
              <input
                name="custom_colours"
                placeholder="Gold, Silver, #00ff00"
                defaultValue={colours
                  .filter((colour: string) => !PRESET_COLOURS.includes(colour))
                  .join(", ")}
                style={{ display: "block", width: "100%", padding: 10 }}
              />
            </label>
          </section>

          <section>
            <h3>Offers</h3>
            <p style={{ color: "#6b7280", fontSize: 13, marginTop: -6 }}>
              Optional bundle pricing. Example: enter <strong>3</strong> and{" "}
              <strong>12.00</strong> to create a public offer of 3 tickets for 12.00.
            </p>

            <input type="hidden" name="offer_count" value={offerRows.length} />

            <div style={{ display: "grid", gap: 10 }}>
              {offerRows.map((offer, index) => (
                <div
                  key={`${offer.id}-${index}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr auto",
                    gap: 10,
                    alignItems: "end",
                    padding: 12,
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    background: "#f9fafb",
                  }}
                >
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      Number of tickets
                    </span>
                    <input
                      name={`offer_quantity_${index}`}
                      type="number"
                      min={1}
                      defaultValue={offer.quantity}
                      placeholder="3"
                      style={{
                        height: 40,
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "0 10px",
                        fontSize: 15,
                      }}
                    />
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      Total offer price
                    </span>
                    <input
                      name={`offer_price_${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={offer.price}
                      placeholder="12.00"
                      style={{
                        height: 40,
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        padding: "0 10px",
                        fontSize: 15,
                      }}
                    />
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      height: 40,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      name={`offer_active_${index}`}
                      type="checkbox"
                      value="true"
                      defaultChecked={offer.is_active}
                    />
                    Use
                  </label>
                </div>
              ))}
            </div>

            <p style={{ color: "#6b7280", fontSize: 13 }}>
              Leave unused rows blank. Save the raffle to apply changes.
            </p>
          </section>

          <label>
            Currency
            <select
              name="currency"
              defaultValue={raffle.currency ?? "GBP"}
              style={{ display: "block", width: "100%", padding: 10 }}
            >
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label>
            Status
            <select
              name="status"
              defaultValue={raffle.status}
              style={{ display: "block", width: "100%", padding: 10 }}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
              <option value="drawn">Drawn</option>
            </select>
          </label>

          <button
            type="submit"
            style={{
              padding: 12,
              borderRadius: 8,
              border: "1px solid #111",
              cursor: "pointer",
            }}
          >
            Save raffle
          </button>
        </form>
      </section>

      <PrizeSettings raffleId={raffle.id} initialPrizes={config.prizes ?? []} />

      {raffle.status === "drawn" && (
        <section style={{ marginTop: 30 }}>
          <h2>Winners</h2>

          {winners.length ? (
            winners.map((winner) => (
              <div key={winner.id}>
                {winner.prize_position} — #{winner.ticket_number} —{" "}
                {winner.colour || "No colour"} — {winner.buyer_name || "—"} (
                {winner.buyer_email || "—"})
              </div>
            ))
          ) : (
            <div>No winners yet.</div>
          )}
        </section>
      )}
    </main>
  );
}
