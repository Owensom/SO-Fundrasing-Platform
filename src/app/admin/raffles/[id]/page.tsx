// src/app/admin/raffles/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

type PageProps = {
  params: { id: string };
};

export default async function AdminRafflePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const tenantSlug = await getTenantSlugFromHeaders();
  if (!tenantSlug) redirect("/admin/login");

  const raffle = await getRaffleById(params.id, tenantSlug);
  if (!raffle) notFound();

  return (
    <main style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>
      <p>Status: {raffle.status}</p>
      <p>Tickets sold: {raffle.sold_tickets ?? 0}</p>
      {/* Add rest of admin UI here */}
    </main>
  );
}
