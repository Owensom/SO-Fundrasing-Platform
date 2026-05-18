import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { sendWinnerEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RaffleRow = {
  id: string;
  tenant_slug: string;
  title: string;
  config_json: any;
};

type SoldTicketRow = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
};

type WinnerRow = {
  prize_position: number;
  ticket_number: number;
};

function parsePositiveInteger(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function cleanEmail(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function cleanName(value: string | null | undefined) {
  return String(value || "").trim() || "Supporter";
}

function ordinal(value: number) {
  const mod10 = value % 10;
  const mod100 = value % 100;

  if (mod10 === 1 && mod100 !== 11) return "st";
  if (mod10 === 2 && mod100 !== 12) return "nd";
  if (mod10 === 3 && mod100 !== 13) return "rd";

  return "th";
}

function getPrizeTitle(config: any, prizePosition: number) {
  const prizes = Array.isArray(config?.prizes) ? config.prizes : [];

  const prize = prizes.find(
    (item: any, index: number) =>
      Number(item?.position ?? index + 1) === prizePosition,
  );

  return (
    String(prize?.title || prize?.name || "").trim() ||
    `${prizePosition}${ordinal(prizePosition)} Prize`
  );
}

function shuffle<T>(items: T[]) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];

    copy[index] = copy[randomIndex];
    copy[randomIndex] = current;
  }

  return copy;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const tenantSlug = await getTenantSlugFromHeaders();

    const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
      ? session.user.tenantSlugs.map((value) => String(value))
      : [];

    if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const fromPrize =
      parsePositiveInteger(formData.get("from_prize")) ||
      parsePositiveInteger(formData.get("auto_draw_from_prize")) ||
      1;

    const toPrize =
      parsePositiveInteger(formData.get("to_prize")) ||
      parsePositiveInteger(formData.get("auto_draw_to_prize")) ||
      fromPrize;

    const startPrize = Math.min(fromPrize, toPrize);
    const endPrize = Math.max(fromPrize, toPrize);

    const raffle = await queryOne<RaffleRow>(
      `
        select id, tenant_slug, title, config_json
        from raffles
        where id = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.id, tenantSlug],
    );

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const existingWinners = await query<WinnerRow>(
      `
        select prize_position, ticket_number
        from raffle_winners
        where tenant_slug = $1
          and raffle_id = $2
      `,
      [tenantSlug, raffle.id],
    );

    const usedPrizePositions = new Set(
      existingWinners.map((winner) => Number(winner.prize_position)),
    );

    const usedTicketNumbers = new Set(
      existingWinners.map((winner) => Number(winner.ticket_number)),
    );

    const availablePrizePositions: number[] = [];

    for (let prize = startPrize; prize <= endPrize; prize += 1) {
      if (!usedPrizePositions.has(prize)) {
        availablePrizePositions.push(prize);
      }
    }

    if (!availablePrizePositions.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No undrawn prizes found in that range",
        },
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
        where tenant_slug = $1
          and raffle_id = $2
          and ticket_number is not null
        order by created_at asc
      `,
      [tenantSlug, raffle.id],
    );

    const availableTickets = shuffle(
      soldTickets.filter(
        (ticket) =>
          Number.isFinite(Number(ticket.ticket_number)) &&
          !usedTicketNumbers.has(Number(ticket.ticket_number)),
      ),
    );

    if (!availableTickets.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No sold tickets are available to draw",
        },
        { status: 400 },
      );
    }

    const drawCount = Math.min(
      availablePrizePositions.length,
      availableTickets.length,
    );

    const createdWinners = [];

    for (let index = 0; index < drawCount; index += 1) {
      const prizePosition = availablePrizePositions[index];
      const ticket = availableTickets[index];
      const winnerEmail = cleanEmail(ticket.buyer_email);
      const winnerName = cleanName(ticket.buyer_name);
      const prizeTitle = getPrizeTitle(raffle.config_json, prizePosition);

      const winner = await queryOne(
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
            buyer_email
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          returning *
        `,
        [
          crypto.randomUUID(),
          tenantSlug,
          raffle.id,
          prizePosition,
          prizeTitle,
          Number(ticket.ticket_number),
          ticket.colour,
          ticket.sale_id,
          winnerName,
          winnerEmail || null,
        ],
      );

      if (winner) {
        createdWinners.push(winner);
      }

      if (!winnerEmail) {
        console.warn("Auto draw winner email skipped - missing email", {
          raffleId: raffle.id,
          prizePosition,
          ticketNumber: ticket.ticket_number,
          saleId: ticket.sale_id,
        });
        continue;
      }

      try {
        await sendWinnerEmail({
          to: winnerEmail,
          name: winnerName,
          raffleTitle: raffle.title,
          prizeTitle,
          ticketNumber: Number(ticket.ticket_number),
          colour: ticket.colour,
        });

        console.log("Auto draw winner email sent", {
          to: winnerEmail,
          raffleId: raffle.id,
          prizePosition,
          ticketNumber: ticket.ticket_number,
        });
      } catch (emailError: any) {
        console.error("Auto draw winner email failed", {
          to: winnerEmail,
          raffleId: raffle.id,
          prizePosition,
          ticketNumber: ticket.ticket_number,
          saleId: ticket.sale_id,
          error: emailError?.message || emailError,
        });
      }
    }

    return NextResponse.redirect(
      new URL(`/admin/raffles/${raffle.id}`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("Raffle auto draw failed", error);

    return NextResponse.json(
      { ok: false, error: "Auto draw failed" },
      { status: 500 },
    );
  }
}
