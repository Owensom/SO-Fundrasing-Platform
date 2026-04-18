import { headers } from "next/headers";

type Raffle = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  ticket_price_cents: number;
  total_tickets: number;
  sold_tickets: number;
  status: string;
  currency: string;
};

async function getRaffle(slug: string): Promise<Raffle | null> {
  const h = headers();
  const host = h.get("host");

  if (!host) {
    return null;
  }

  const protocol = host.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/api/raffles/${slug}`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.raffle ?? null;
}

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function PublicRafflePage({ params }: PageProps) {
  const raffle = await getRaffle(params.slug);

  if (!raffle) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>Raffle not found</h1>
      </main>
    );
  }

  if (raffle.status !== "published") {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>This raffle is not published</h1>
      </main>
    );
  }

  const remaining = Math.max(raffle.total_tickets - raffle.sold_tickets, 0);

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1>{raffle.title}</h1>

      {raffle.image_url ? (
        <img
          src={raffle.image_url}
          alt={raffle.title}
          style={{ width: "100%", height: "auto", marginBottom: 20 }}
        />
      ) : null}

      <p>{raffle.description}</p>

      <hr style={{ margin: "24px 0" }} />

      <p>
        <strong>Price:</strong>{" "}
        {(raffle.ticket_price_cents / 100).toFixed(2)} {raffle.currency}
      </p>

      <p>
        <strong>Total tickets:</strong> {raffle.total_tickets}
      </p>

      <p>
        <strong>Sold:</strong> {raffle.sold_tickets}
      </p>

      <p>
        <strong>Remaining:</strong> {remaining}
      </p>
    </main>
  );
}
