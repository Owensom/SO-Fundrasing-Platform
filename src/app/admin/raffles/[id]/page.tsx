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

function colourToText(colour: any) {
  if (typeof colour === "string") return colour;
  if (colour?.name) return colour.name;
  if (colour?.hex) return colour.hex;
  return "";
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
              min={0}
              step="0.01"
              defaultValue={raffle.ticket_price}
              required
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Start number
            <input
              name="startNumber"
              type="number"
              defaultValue={Number(config.startNumber ?? 1)}
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <label>
            End number
            <input
              name="endNumber"
              type="number"
              defaultValue={Number(config.endNumber ?? raffle.total_tickets)}
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Colours
            <input
              name="colours"
              defaultValue={colours.map(colourToText).filter(Boolean).join(", ")}
              placeholder="Red, Blue, Green"
              style={{ display: "block", width: "100%", padding: 10 }}
            />
          </label>

          <label>
            Offers JSON
            <textarea
              name="offers"
              rows={8}
              defaultValue={JSON.stringify(offers, null, 2)}
              style={{
                display: "block",
                width: "100%",
                padding: 10,
                fontFamily: "monospace",
              }}
            />
          </label>

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
