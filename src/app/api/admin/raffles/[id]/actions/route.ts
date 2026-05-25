import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { deleteRaffle, getRaffleById } from "@/lib/raffles";
import { query, queryOne } from "@/lib/db";
import { sendWinnerEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SoldTicketRow = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
};

type PrizeRow = {
  title?: string | null;
  name?: string | null;
  position?: number | string | null;
  isPublic?: boolean;
  is_public?: boolean;
};

type FiftyFiftyFinanceRow = {
  gross_paid_sales_cents: number | string | null;
};

type FiftyFiftyEntryCountRow = {
  paid_entry_count: number | string | null;
  postal_entry_count: number | string | null;
  total_entry_count: number | string | null;
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

function cleanEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function cleanName(value: string | null | undefined) {
  return String(value || "").trim() || "Supporter";
}

function normaliseRaffleSubtype(value: unknown) {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "fifty_fifty") {
    return "fifty_fifty";
  }

  return "standard";
}

function toSafeInteger(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function getPrizeTitle(prizes: PrizeRow[], index: number) {
  const prize = prizes[index];
  const title = String(prize?.title || prize?.name || "").trim();

  if (title) return title;

  return `Prize ${index + 1}`;
}

async function requireTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    session,
    tenantSlug,
  };
}

async function getFiftyFiftySnapshot(raffleId: string) {
  const finance = await queryOne<FiftyFiftyFinanceRow>(
    `
      select
        coalesce(
          sum(
            coalesce(
              ticket_subtotal_cents,
              gross_amount_cents,
              0
            )
          ),
          0
        )::int as gross_paid_sales_cents
      from platform_payments
      where raffle_id = $1
        and payment_type = 'raffle'
        and payment_status = 'paid'
    `,
    [raffleId],
  );

  const entryCounts = await queryOne<FiftyFiftyEntryCountRow>(
    `
      select
        count(*) filter (
          where ticket_number is not null
            and (
              stripe_checkout_session_id is not null
              or payment_id is not null
              or stripe_payment_intent_id is not null
            )
        )::int as paid_entry_count,
        count(*) filter (
          where ticket_number is not null
            and stripe_checkout_session_id is null
            and payment_id is null
            and stripe_payment_intent_id is null
        )::int as postal_entry_count,
        count(*) filter (
          where ticket_number is not null
        )::int as total_entry_count
      from raffle_ticket_sales
      where raffle_id = $1
    `,
    [raffleId],
  );

  const grossPaidSalesCents = toSafeInteger(finance?.gross_paid_sales_cents);
  const winnerPrizeCents = Math.floor(grossPaidSalesCents / 2);
  const causeShareCents = Math.max(
    grossPaidSalesCents - winnerPrizeCents,
    0,
  );

  return {
    grossPaidSalesCents,
    winnerPrizeCents,
    causeShareCents,
    paidEntryCount: toSafeInteger(entryCounts?.paid_entry_count),
    postalEntryCount: toSafeInteger(entryCounts?.postal_entry_count),
    totalEntryCount: toSafeInteger(entryCounts?.total_entry_count),
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const access = await requireTenantAccess();

    if (!access.ok) {
      return access.response;
    }

    const { session, tenantSlug } = access;

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

      const raffleSubtype = normaliseRaffleSubtype(raffle.raffle_subtype);
      const isFiftyFifty = raffleSubtype === "fifty_fifty";

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
            and ticket_number is not null
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

      const validSoldTickets = soldTickets.filter((ticket) =>
        Number.isFinite(Number(ticket.ticket_number)),
      );

      if (!validSoldTickets.length) {
        return NextResponse.json(
          { ok: false, error: "No valid sold tickets found" },
          { status: 400 },
        );
      }

      const config = (raffle.config_json as any) ?? {};
      const prizes: PrizeRow[] = Array.isArray(config.prizes)
        ? config.prizes.filter((prize: PrizeRow) => {
            const title = String(prize?.title ?? prize?.name ?? "").trim();
            const isPublic =
              prize?.isPublic !== false && prize?.is_public !== false;

            return title && isPublic;
          })
        : [];

      const winnerCount = isFiftyFifty ? 1 : Math.max(prizes.length || 1, 1);

      const winners = shuffle(validSoldTickets).slice(
        0,
        Math.min(winnerCount, validSoldTickets.length),
      );

      const fiftyFiftySnapshot = isFiftyFifty
        ? await getFiftyFiftySnapshot(raffle.id)
        : null;

      await query(
        `
          delete from raffle_winners
          where tenant_slug = $1
            and raffle_id = $2
        `,
        [tenantSlug, raffle.id],
      );

      for (let index = 0; index < winners.length; index += 1) {
        const winner = winners[index];
        const prizeTitle = isFiftyFifty
          ? "50/50 paid ticket pot"
          : getPrizeTitle(prizes, index);

        await query(
          `
            insert into raffle_winners (
              id,
              tenant_slug,
              raffle_id,
              prize_position,
              prize_title,
              ticket_number,
              colour,
              sale_id,
              buyer_name,
              buyer_email,
              drawn_at,
              raffle_subtype_snapshot,
              gross_paid_sales_cents,
              winner_prize_cents,
              cause_share_cents,
              paid_entry_count,
              postal_entry_count,
              total_entry_count,
              payout_status
            )
            values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(),
              $11, $12, $13, $14, $15, $16, $17, $18
            )
          `,
          [
            crypto.randomUUID(),
            tenantSlug,
            raffle.id,
            index + 1,
            prizeTitle,
            Number(winner.ticket_number),
            winner.colour,
            winner.sale_id,
            cleanName(winner.buyer_name),
            cleanEmail(winner.buyer_email) || null,
            isFiftyFifty ? raffleSubtype : null,
            fiftyFiftySnapshot?.grossPaidSalesCents ?? null,
            fiftyFiftySnapshot?.winnerPrizeCents ?? null,
            fiftyFiftySnapshot?.causeShareCents ?? null,
            fiftyFiftySnapshot?.paidEntryCount ?? null,
            fiftyFiftySnapshot?.postalEntryCount ?? null,
            fiftyFiftySnapshot?.totalEntryCount ?? null,
            isFiftyFifty ? "pending" : "not_required",
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
          Number(firstWinner.ticket_number),
          firstWinner.colour,
          firstWinner.sale_id,
          session.user.email ?? null,
        ],
      );

      let sentWinnerEmails = 0;
      let skippedWinnerEmails = 0;
      let failedWinnerEmails = 0;

      for (let index = 0; index < winners.length; index += 1) {
        const winner = winners[index];
        const winnerEmail = cleanEmail(winner.buyer_email);
        const prizeTitle = isFiftyFifty
          ? "50/50 paid ticket pot"
          : getPrizeTitle(prizes, index);

        if (!winnerEmail) {
          skippedWinnerEmails += 1;

          console.warn("Winner email skipped - missing buyer_email", {
            raffleId: raffle.id,
            ticketNumber: winner.ticket_number,
            colour: winner.colour,
            saleId: winner.sale_id,
            prizeTitle,
          });

          continue;
        }

        try {
          console.log("Sending raffle winner email", {
            to: winnerEmail,
            raffleId: raffle.id,
            raffleTitle: raffle.title,
            prizeTitle,
            ticketNumber: winner.ticket_number,
            colour: winner.colour,
            saleId: winner.sale_id,
          });

          await sendWinnerEmail({
            to: winnerEmail,
            name: cleanName(winner.buyer_name),
            raffleTitle: raffle.title,
            prizeTitle,
            ticketNumber: Number(winner.ticket_number),
            colour: winner.colour || null,
            raffleSubtype: raffle.raffle_subtype,
          });

          sentWinnerEmails += 1;

          console.log("Raffle winner email sent", {
            to: winnerEmail,
            raffleId: raffle.id,
            prizeTitle,
            ticketNumber: winner.ticket_number,
          });
        } catch (emailError: any) {
          failedWinnerEmails += 1;

          console.error("Raffle winner email failed", {
            to: winnerEmail,
            raffleId: raffle.id,
            prizeTitle,
            ticketNumber: winner.ticket_number,
            saleId: winner.sale_id,
            error: emailError?.message || emailError,
          });
        }
      }

      return NextResponse.json({
        ok: true,
        winnerEmails: {
          sent: sentWinnerEmails,
          skipped: skippedWinnerEmails,
          failed: failedWinnerEmails,
        },
      });
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
