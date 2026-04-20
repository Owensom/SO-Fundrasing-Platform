import { headers } from "next/headers";

type TicketState = {
  ticket_number: number;
  colour: string;
};

type Raffle = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string;
  image_url: string;
  currency: string;
  ticket_price?: number;
  total_tickets: number;
  sold_tickets: number;
  remaining_tickets?: number;
  status: string;
};

type ApiResponse = {
  ok: boolean;
  raffle?: Raffle;
  sold?: TicketState[];
  reserved?: TicketState[];
  error?: string;
};

async function getRaffle(slug: string): Promise<ApiResponse> {
  const headerStore = headers();
  const host = headerStore.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";

  const url = `${protocol}://${host}/api/raffles/${slug}`;

  const res = await fetch(url, { cache: "no-store" });
  return (await res.json()) as ApiResponse;
}

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function PublicRafflePage({ params }: PageProps) {
  const data = await getRaffle(params.slug);

  if (!data.ok || !data.raffle) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>Raffle not found</h1>
      </main>
    );
  }

  const raffle = data.raffle;

  if (raffle.status !== "published") {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>This raffle is not published</h1>
      </main>
    );
  }

  // 🔑 Build availability sets
  const soldSet = new Set(
    (data.sold || []).map((t) => `${t.colour}-${t.ticket_number}`)
  );

  const reservedSet = new Set(
    (data.reserved || []).map((t) => `${t.colour}-${t.ticket_number}`)
  );

  // simple number range (adjust later if using config_json)
  const numbers = Array.from(
    { length: raffle.total_tickets },
    (_, i) => i + 1
  );

  const colour = "default"; // simplify for now

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>{raffle.title}</h1>

      {raffle.image_url ? (
        <img
          src={raffle.image_url}
          alt={raffle.title}
          style={{ width: "100%", marginBottom: 20 }}
        />
      ) : null}

      <p>{raffle.description}</p>

      <hr style={{ margin: "24px 0" }} />

      <p>
        <strong>Price:</strong> {raffle.ticket_price ?? 0}{" "}
        {raffle.currency}
      </p>

      <p>
        <strong>Total tickets:</strong> {raffle.total_tickets}
      </p>

      <p>
        <strong>Sold:</strong> {raffle.sold_tickets}
      </p>

      <hr style={{ margin: "24px 0" }} />

      <h2>Select a ticket</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: 8,
          marginTop: 16,
        }}
      >
        {numbers.map((number) => {
          const key = `${colour}-${number}`;

          const isSold = soldSet.has(key);
          const isReserved = reservedSet.has(key);
          const isUnavailable = isSold || isReserved;

          return (
            <button
              key={number}
              disabled={isUnavailable}
              style={{
                padding: 10,
                border: "1px solid #ccc",
                borderRadius: 6,
                background: isSold
                  ? "#000"
                  : isReserved
                  ? "#999"
                  : "#fff",
                color: isUnavailable ? "#fff" : "#000",
                cursor: isUnavailable ? "not-allowed" : "pointer",
                opacity: isUnavailable ? 0.5 : 1,
              }}
            >
              {number}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <p>
          <strong>Legend:</strong>
        </p>
        <p>⬜ Available</p>
        <p>⬛ Sold</p>
        <p>⬜ Grey = Reserved</p>
      </div>
    </main>
  );
}
