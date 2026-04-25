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
  sale_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  drawn_at: string;
};

function normalizeOfferForUI(o: any, index: number) {
  const quantity = Number(o.quantity ?? o.tickets ?? 0);

  const price =
    o.price != null
      ? Number(o.price)
      : o.price_cents != null
        ? Number(o.price_cents) / 100
        : 0;

  const isActive =
    o.is_active === true ||
    o.isActive === true ||
    o.active === true;

  return {
    id: o.id || `offer-${index}`,
    label: o.label || `${quantity} tickets`,
    quantity,
    price,
    isActive,
  };
}

export default async function AdminRafflePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const raffle = await getRaffleById(params.id);
  if (!raffle) notFound();

  const config = (raffle.config_json as any) ?? {};
  const colours = Array.isArray(config.colours) ? config.colours : [];
  const offers = Array.isArray(config.offers) ? config.offers : [];

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

      {/* EDIT FORM */}
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
          style={{ display: "grid", gap: 16 }}
        >
          <input name="title" defaultValue={raffle.title} required />
          <input name="slug" defaultValue={raffle.slug} required />
          <textarea
            name="description"
            defaultValue={raffle.description ?? ""}
          />

          <ImageUploadField currentImageUrl={raffle.image_url ?? ""} />

          <input
            name="ticket_price"
            type="number"
            defaultValue={raffle.ticket_price}
          />

          <input
            name="startNumber"
            type="number"
            defaultValue={config.startNumber ?? 1}
          />

          <input
            name="endNumber"
            type="number"
            defaultValue={config.endNumber ?? raffle.total_tickets}
          />

          <input
            name="colours"
            defaultValue={colours.join(", ")}
            placeholder="Red, Blue, Green"
          />

          <textarea
            name="offers"
            rows={6}
            defaultValue={JSON.stringify(offers, null, 2)}
          />

          <button type="submit">Save raffle</button>
        </form>
      </section>

      {/* ✅ FIXED OFFERS DISPLAY */}
      {offers.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <h2>Offers</h2>

          {offers.map((raw: any, i: number) => {
            const offer = normalizeOfferForUI(raw, i);

            return (
              <div
                key={offer.id}
                style={{
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              >
                <strong>{offer.label}</strong>
                <div>
                  {offer.quantity} tickets for {offer.price}
                </div>
                <div style={{ color: offer.isActive ? "green" : "red" }}>
                  {offer.isActive ? "Active" : "Inactive"}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <PrizeSettings
        raffleId={raffle.id}
        initialPrizes={config.prizes ?? []}
      />

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
