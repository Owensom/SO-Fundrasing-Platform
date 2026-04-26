// src/app/admin/raffles/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById, Raffle } from "@/lib/raffles";

type PageProps = {
  params: { id: string };
};

export default async function AdminRafflePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const tenantSlug = session.user.tenant_slug;
  const raffle: Raffle | null = await getRaffleById(tenantSlug, params.id);
  if (!raffle) notFound();

  return (
    <main style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>
      <p>Status: {raffle.status}</p>
      <p>Tickets sold: {raffle.sold_tickets ?? 0}</p>
      <p>Ticket price: £{raffle.ticket_price}</p>
      <p>Total tickets: {raffle.total_tickets}</p>
      <p>Start number: {raffle.config_json.startNumber ?? 1}</p>
      <p>End number: {raffle.config_json.endNumber ?? raffle.total_tickets}</p>
      <p>Colours: {raffle.config_json.colours?.map(c => c.name).join(", ") ?? "None"}</p>
      <p>Offers: {raffle.config_json.offers?.map(o => o.label).join(", ") ?? "None"}</p>
      <p>Prizes: {raffle.config_json.prizes?.map(p => p.title).join(", ") ?? "None"}</p>
    </main>
  );
}
