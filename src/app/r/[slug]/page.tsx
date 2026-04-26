// src/app/r/[slug]/page.tsx
import type { SafeRaffle } from "@/lib/types";
import RaffleClient from "./RaffleClient";
import { getRaffleBySlug } from "@/lib/raffles";

type PageProps = {
  params: { slug: string };
};

export default async function Page({ params }: PageProps) {
  // Server-side fetch
  const raffle = await getRaffleBySlug(params.slug); // must accept tenantSlug internally
  if (!raffle) {
    return <div style={{ padding: 24 }}>Raffle not found.</div>;
  }

  // Convert to "safe" raffle for client
  const safeRaffle: SafeRaffle = {
    id: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    description: raffle.description ?? "",
    imageUrl: raffle.image_url ?? "",
    tenantSlug: raffle.tenant_slug,
    startNumber: raffle.config_json?.startNumber ?? 1,
    endNumber: raffle.config_json?.endNumber ?? raffle.total_tickets,
    currency: raffle.currency ?? "GBP",
    ticketPrice: raffle.ticket_price ?? 0,
    status: raffle.status ?? "draft",
    colours: raffle.config_json?.colours ?? [],
    offers: raffle.config_json?.offers ?? [],
    prizes: raffle.config_json?.prizes ?? [],
    reservedTickets: raffle.reservedTickets ?? [],
    soldTickets: raffle.soldTickets ?? [],
    winnerTicketNumber: raffle.winner_ticket_number ?? null,
    winnerColour: raffle.winner_colour ?? null,
    drawnAt: raffle.drawn_at ?? null,
    winners: raffle.winners ?? [],
  };

  return (
    <div style={{ padding: 24 }}>
      <RaffleClient raffle={safeRaffle} />
    </div>
  );
}
