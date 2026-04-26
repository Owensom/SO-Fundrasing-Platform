import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { deleteRaffle, getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SoldTicketRow = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
};

function shuffle<T>(items: T[]) {
  const copy = items.slice();

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }

  return copy;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tenantSlug = getTenantSlugFromHeaders();

    const raffle = await getRaffleById(id);
    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "close") {
      const updated = await query(
        `
        update raffles
        set
          status = 'closed',
          updated_at = now()
        where id = $1
          and tenant_slug = $2
          and status = 'published'
        returning id
        `,
        [raffle.id, tenantSlug],
      );

      if (!updated.length) {
        return NextResponse.json(
          { ok: false, error: "Unable to close raffle" },
          { status: 400 },
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "draw") {
      if (raffle.status !== "closed") {
        return NextResponse.json(
          { ok: false, error: "Raffle must be closed before drawing" },
          { status: 400 },
        );
      }

      const soldTickets = await query<SoldTicketRow>(
        `
        select
          id as sale_id,
          ticket_number,
          colour,
          buyer_name,
          buyer_email
        from raffle_ticket_sales
        where raffle_id = $1
        order by created_at asc
        `,
        [raffle.id],
      );

      if (!soldTickets.length) {
        return NextResponse.json(
          { ok: false, error: "No tickets sold" },
          { status: 400 },
        );
      }

      const config = (raffle.config_json as any) ?? {};
      const prizes = Array.isArray(config.prizes)
        ? config.prizes.filter((prize: any) => {
            const title = String(prize?.title ?? prize?.name ?? "").trim();
            const isPublic = prize?.isPublic !== false && prize?.is_public !== false;
            return title && isPublic;
          })
        : [];

      const winnerCount = Math.max(prizes.length || 1, 1);
      const winners = shuffle(soldTickets).slice(
        0,
        Math.min(winnerCount, soldTickets.length),
      );

      await query("delete from raffle_winners where raffle_id = $1", [raffle.id]);

      for (let index = 0; index < winners.length; index += 1) {
        const winner = winners[index];

        await query(
          `
          insert into raffle_winners (
            id,
            raffle_id,
            prize_position,
            ticket_number,
            colour,
            buyer_name,
            buyer_email,
            drawn_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, now())
          `,
          [
            crypto.randomUUID(),
            raffle.id,
            index + 1,
            winner.ticket_number,
            winner.colour,
            winner.buyer_name,
            winner.buyer_email,
          ],
        );
      }

      const firstWinner = winners[0];

      await query(
        `
        update raffles
        set
          status = 'drawn',
          winner_ticket_number = $3,
          winner_colour = $4,
          winner_sale_id = $5,
          drawn_at = now(),
          drawn_by = $6,
          updated_at = now()
        where id = $1
          and tenant_slug = $2
        `,
        [
          raffle.id,
          tenantSlug,
          firstWinner.ticket_number,
          firstWinner.colour,
          firstWinner.sale_id,
          session.user.email ?? null,
        ],
      );

      return NextResponse.json({ ok: true });
    }

    if (action === "delete") {
      if (raffle.status === "published") {
        return NextResponse.json(
          {
            ok: false,
            error: "Close this raffle before deleting it.",
          },
          { status: 400 },
        );
      }

      await deleteRaffle(raffle.id, tenantSlug);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (err: any) {
    console.error("raffle action error", err);

    return NextResponse.json(
      { ok: false, error: err?.message || "Action failed" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return POST(
    new NextRequest(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ action: "delete" }),
    }),
    { params: Promise.resolve({ id }) },
  );
}
