import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RaffleRow = {
  id: string;
  tenant_slug: string;
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
      select id, tenant_slug, config_json
      from raffles
      where id = $1
      limit 1
      `,
      [params.id],
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
      where raffle_id = $1
      `,
      [raffle.id],
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
      where raffle_id = $1
      order by created_at asc
      `,
      [raffle.id],
    );

    const availableTickets = shuffle(
      soldTickets.filter(
        (ticket) => !usedTicketNumbers.has(Number(ticket.ticket_number)),
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
          raffle.tenant_slug,
          raffle.id,
          prizePosition,
          getPrizeTitle(raffle.config_json, prizePosition),
          Number(ticket.ticket_number),
          ticket.colour,
          ticket.sale_id,
          ticket.buyer_name,
          ticket.buyer_email,
        ],
      );

      if (winner) {
        createdWinners.push(winner);
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
