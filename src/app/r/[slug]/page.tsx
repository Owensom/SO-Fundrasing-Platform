import { headers } from "next/headers";
import RaffleClient from "./RaffleClient";

type TicketState = {
  ticket_number: number;
  colour: string;
};

type RaffleConfig = {
  startNumber?: number;
  endNumber?: number;
  colours?: string[];
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
  config_json?: RaffleConfig;
};

type ApiResponse = {
  ok: boolean;
  raffle?: Raffle;
  sold?: TicketState[];
  reserved?: TicketState[];
  error?: string;
};

async function getRaffle(slug: string): Promise<ApiResponse> {
  const headerStore = await headers();
  const host = headerStore.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";

  await fetch(`${protocol}://${host}/api/raffles/cleanup`, {
    method: "POST",
    cache: "no-store",
  }).catch(() => null);

  const res = await fetch(`${protocol}://${host}/api/raffles/${slug}`, {
    cache: "no-store",
  });

  return (await res.json()) as ApiResponse;
}

export default async function PublicRafflePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getRaffle(slug);

  if (!data.ok || !data.raffle) {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        <h1>Raffle not found</h1>
      </main>
    );
  }

  if (data.raffle.status !== "published") {
    return (
      <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
        <h1>This raffle is not published</h1>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1>{data.raffle.title}</h1>
      <RaffleClient
        raffle={data.raffle}
        sold={data.sold || []}
        reserved={data.reserved || []}
      />
    </main>
  );
}
