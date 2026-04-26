// src/app/r/[slug]/page.tsx
import RaffleClient from "./RaffleClient";
import { getRaffleBySlug } from "@/lib/raffles";
import type { SafeRaffle } from "@/lib/types";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  const raffle = await getRaffleBySlug(params.slug) as SafeRaffle | null;

  if (!raffle) {
    return <div style={{ padding: 24 }}>Raffle not found.</div>;
  }

  return <RaffleClient raffle={raffle} />;
}
