import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";
import ImageUploadField from "@/components/ImageUploadField";

type PageProps = {
  params: { id: string };
};

export default async function AdminRafflePage({ params }: PageProps) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const raffle = await getRaffleById(params.id);
  if (!raffle) notFound();

  const config = (raffle.config_json as any) || {};
  const colours = config.colours || [];
  const offers = config.offers || [];

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <Link href="/admin">← Back</Link>

      <h1>{raffle.title}</h1>

      <Link href={`/r/${raffle.slug}`} target="_blank">
        View public page
      </Link>

      <RaffleAdminActions raffleId={raffle.id} status={raffle.status} />

      {/* 🎯 MAIN EDIT FORM */}
      <form
        action={`/api/admin/raffles/${raffle.id}`}
        method="post"
        style={{ display: "grid", gap: 16, marginTop: 20 }}
      >
        <h2>Edit raffle</h2>

        <input name="title" defaultValue={raffle.title} placeholder="Title" />
        <textarea
          name="description"
          defaultValue={raffle.description ?? ""}
          placeholder="Description"
        />

        <input
          name="ticket_price"
          defaultValue={raffle.ticket_price}
          type="number"
          step="0.01"
        />

        <input
          name="total_tickets"
          defaultValue={raffle.total_tickets}
          type="number"
        />

        <input name="slug" defaultValue={raffle.slug} />

        <input type="hidden" name="status" value={raffle.status} />

        <button type="submit">Save raffle</button>
      </form>

      {/* 🎨 COLOURS */}
      <section style={{ marginTop: 30 }}>
        <h2>Colours</h2>

        {colours.map((c: any, i: number) => (
          <div key={i}>
            {c.name} ({c.hex})
          </div>
        ))}

        <p style={{ color: "#666" }}>
          (Colours exist — UI editing can be added next)
        </p>
      </section>

      {/* 💰 OFFERS */}
      <section style={{ marginTop: 30 }}>
        <h2>Offers</h2>

        {offers.map((o: any, i: number) => (
          <div key={i}>
            {o.label} — £{o.price} ({o.quantity} tickets)
          </div>
        ))}

        <p style={{ color: "#666" }}>
          (Offers exist — UI editing can be added next)
        </p>
      </section>

      {/* 🏆 PRIZES */}
      <PrizeSettings
        raffleId={raffle.id}
        initialPrizes={config.prizes ?? []}
      />

      {/* 🖼 IMAGE */}
      <section style={{ marginTop: 30 }}>
        <h2>Image</h2>

        <form
          action={`/api/admin/raffles/${raffle.id}`}
          method="post"
          style={{ display: "grid", gap: 10 }}
        >
          <ImageUploadField currentImageUrl={raffle.image_url ?? ""} />

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

        {raffle.image_url && (
          <img
            src={raffle.image_url}
            style={{ width: "100%", marginTop: 12 }}
          />
        )}
      </section>
    </main>
  );
}
