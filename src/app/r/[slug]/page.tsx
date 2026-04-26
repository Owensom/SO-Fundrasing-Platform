import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getRaffleBySlug } from "@/lib/raffles";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
  }).format(amount);
}

function colourToText(colour: any) {
  if (typeof colour === "string") return colour;
  if (colour?.name) return colour.name;
  if (colour?.hex) return colour.hex;
  return "";
}

export default async function PublicRafflePage({ params }: PageProps) {
  const { slug } = await params;
  const tenantSlug = getTenantSlugFromHeaders();

  if (!tenantSlug) notFound();

  const raffle = await getRaffleBySlug(tenantSlug, slug);
  if (!raffle) notFound();

  const config = (raffle.config_json as any) ?? {};

  const colours = Array.isArray(config.colours)
    ? config.colours.map(colourToText).filter(Boolean)
    : [];

  const offers = Array.isArray(config.offers) ? config.offers : [];

  const ticketPrice = Number(raffle.ticket_price_cents || 0) / 100;
  const remainingTickets = Math.max(
    Number(raffle.total_tickets || 0) - Number(raffle.sold_tickets || 0),
    0,
  );

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <section
        style={{
          padding: 24,
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "#fff",
        }}
      >
        {raffle.image_url ? (
          <img
            src={raffle.image_url}
            alt={raffle.title}
            style={{
              width: "100%",
              maxHeight: 420,
              objectFit: "cover",
              borderRadius: 16,
              marginBottom: 24,
            }}
          />
        ) : null}

        <h1 style={{ marginTop: 0 }}>{raffle.title}</h1>

        {raffle.description ? (
          <p style={{ fontSize: 17, lineHeight: 1.6 }}>{raffle.description}</p>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 20,
            padding: 16,
            borderRadius: 14,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <div>
            <strong>Status:</strong> {raffle.status}
          </div>
          <div>
            <strong>Single ticket price:</strong>{" "}
            {formatMoney(ticketPrice, raffle.currency)}
          </div>
          <div>
            <strong>Total tickets:</strong> {raffle.total_tickets}
          </div>
          <div>
            <strong>Remaining tickets:</strong> {remainingTickets}
          </div>
        </div>

        {raffle.status !== "published" ? (
          <div
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: 12,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              fontWeight: 600,
            }}
          >
            This raffle is not currently open for ticket purchases.
          </div>
        ) : null}

        {colours.length ? (
          <section style={{ marginTop: 28 }}>
            <h2>Ticket colours</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {colours.map((colour: string) => (
                <span
                  key={colour}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    background: "#e2e8f0",
                    fontWeight: 600,
                  }}
                >
                  {colour}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {offers.length ? (
          <section style={{ marginTop: 28 }}>
            <h2>Offers</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {offers.map((offer: any, index: number) => {
                const quantity = Number(offer.quantity ?? offer.tickets ?? 0);
                const price = Number(offer.price ?? 0);

                if (!quantity || !price) return null;

                return (
                  <div
                    key={offer.id || index}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                    }}
                  >
                    <strong>
                      {quantity} tickets for{" "}
                      {formatMoney(price, raffle.currency)}
                    </strong>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
