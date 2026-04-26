// src/app/r/[slug]/page.tsx
import { notFound } from "next/navigation";
import RafflePublicClient from "./RafflePublicClient";
import { getRaffleBySlug } from "@/lib/raffles";

type Params = {
  slug: string;
};

export default async function PublicRafflePage({ params }: { params: Params }) {
  const raffle = await getRaffleBySlug(params.slug);

  if (!raffle) notFound();

  return <RafflePublicClient raffle={raffle} />;
}
