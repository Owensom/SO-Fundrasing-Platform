import { headers } from "next/headers";

type ApiResponse = {
  ok: boolean;
  raffle?: {
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
  error?: string;
  debug?: unknown;
};

async function getRaffle(slug: string): Promise<ApiResponse> {
  const headerStore = headers();
  const host = headerStore.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/api/raffles/${slug}`;

  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as ApiResponse;
  return data;
}

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function PublicRafflePage({ params }: PageProps) {
  const data = await getRaffle(params.slug);

  if (!data.ok) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>Raffle not found</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </main>
    );
  }

  if (!data.raffle) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>No raffle payload returned</h1>
        <pre style={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      </main>
    );
  }

  const raffle = data.raffle;

  if (raffle.status !== "published") {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>This raffle is not published</h1>
        <p>{raffle.title}</p>
      </main>
    );
  }

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
        <strong>Tenant:</strong> {raffle.tenant_slug}
      </p>

      <p>
        <strong>Slug:</strong> {raffle.slug}
      </p>

      <p>
        <strong>Price:</strong> {raffle.ticket_price ?? 0} {raffle.currency}
      </p>

      <p>
        <strong>Total tickets:</strong> {raffle.total_tickets}
      </p>

      <p>
        <strong>Sold:</strong> {raffle.sold_tickets}
      </p>

      <p>
        <strong>Remaining:</strong> {raffle.remaining_tickets ?? 0}
      </p>
    </main>
  );
}
