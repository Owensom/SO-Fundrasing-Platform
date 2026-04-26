// src/app/r/[slug]/page.tsx
import type { SafeRaffle } from "@/lib/types";
import { getRaffleBySlug } from "@/lib/raffles";
import RaffleClient from "./RaffleClient";
import { headers } from "next/headers";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function Page({ params }: PageProps) {
  // Determine tenantSlug from headers (multi-tenant safe)
  const host = headers().get("host") || "";
  const tenantSlug = host.split(".")[0]; // Adjust if your subdomain logic differs

  const raffle = (await getRaffleBySlug(params.slug, tenantSlug)) as SafeRaffle | null;

  if (!raffle) {
    return <div style={{ padding: 24 }}>Raffle not found.</div>;
  }

  return <RaffleClient raffle={raffle} />;
}
