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
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/raffles/${slug}`,
    { cache: "no-store" }
  );

  if (!res.ok) return null;

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
      <main style={{ padding: 40 }}>
        <h1>Raffle not found</h1>
      </main>
    );
  }

  if (raffle.status !== "published") {
    return (
      <main style={{ padding: 40 }}>
        <h1>This raffle is not published</h1>
      </main>
    );
  }

  const remaining = raffle.total_tickets - raffle.sold_tickets;

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1>{raffle.title}</h1>

      {raffle.image_url && (
        <img
          src={raffle.image_url}
          alt={raffle.title}
          style={{ width: "100%", marginBottom: 20 }}
        />
      )}

      <p>{raffle.description}</p>

      <hr />

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
