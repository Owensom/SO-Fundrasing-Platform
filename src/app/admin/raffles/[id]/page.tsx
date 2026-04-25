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

type RaffleDetails = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  currency: string | null;
  ticket_price: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets: number;
  status: "draft" | "published" | "closed" | "drawn";
  config_json?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export default async function AdminRafflePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const raffle = await getRaffleById(params.id);
  if (!raffle) notFound();

  const winners = await query<WinnerRow>(
    `select * from raffle_winners where raffle_id = $1 order by prize_position asc`,
    [raffle.id]
  );

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <Link href="/admin">← Back to admin</Link>

      <h1>{raffle.title}</h1>

      <Link href={`/r/${raffle.slug}`} target="_blank">
        View public page
      </Link>

      {/* ✅ ADMIN ACTIONS */}
      <RaffleAdminActions raffleId={raffle.id} status={raffle.status} />

      {/* ✅ PRIZE SETTINGS */}
      <PrizeSettings
        raffleId={raffle.id}
        initialPrizes={(raffle.config_json as any)?.prizes ?? []}
      />

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 20,
          marginTop: 20,
        }}
      >
        {/* LEFT */}
        <div style={{ border: "1px solid #eee", padding: 16 }}>
          <h2>Details</h2>

          <p>{raffle.description}</p>

          <p>
            <strong>Price:</strong> {raffle.ticket_price}
          </p>

          <p>
            <strong>Total:</strong> {raffle.total_tickets}
          </p>

          <p>
            <strong>Sold:</strong> {raffle.sold_tickets}
          </p>

          <p>
            <strong>Remaining:</strong> {raffle.remaining_tickets}
          </p>
        </div>

        {/* RIGHT */}
        <aside style={{ border: "1px solid #eee", padding: 16 }}>
          <h2>Image</h2>

          <form
            action={`/api/admin/raffles/${raffle.id}`}
            method="post"
            style={{ display: "grid", gap: 10 }}
          >
            <ImageUploadField currentImageUrl={raffle.image_url ?? ""} />

            {/* preserve existing fields */}
            <input type="hidden" name="title" value={raffle.title} />
            <input type="hidden" name="slug" value={raffle.slug} />
            <input
              type="hidden"
              name="description"
              value={raffle.description ?? ""}
            />
            <input
              type="hidden"
              name="ticket_price"
              value={raffle.ticket_price}
            />
            <input
              type="hidden"
              name="total_tickets"
              value={raffle.total_tickets}
            />
            <input type="hidden" name="status" value={raffle.status} />

            <button type="submit">Save image</button>
          </form>

          {/* preview */}
          {raffle.image_url && (
            <img
              src={raffle.image_url}
              style={{ width: "100%", marginTop: 12 }}
            />
          )}
        </aside>
      </section>

      {raffle.status === "drawn" && (
        <section style={{ marginTop: 30 }}>
          <h2>Winners</h2>

          {winners.length ? (
            winners.map((w) => (
              <div key={w.id}>
                {w.prize_position} — #{w.ticket_number} — {w.buyer_name || "—"} (
                {w.buyer_email || "—"})
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
