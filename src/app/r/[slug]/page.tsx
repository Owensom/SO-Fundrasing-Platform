import { getRaffleBySlug } from "@/lib/raffles";
import { notFound } from "next/navigation";

interface PageProps {
  params: { slug: string };
}

export default async function Page({ params }: PageProps) {
  // Determine tenant slug (replace "default" with your logic if dynamic)
  const tenantSlug = "default";

  // Server-side fetch
  const raffle = await getRaffleBySlug(tenantSlug, params.slug);

  if (!raffle) {
    return <div style={{ padding: 24 }}>Raffle not found.</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>
      <p>Tickets sold: {raffle.sold_tickets} / {raffle.total_tickets}</p>
    </div>
  );
}
