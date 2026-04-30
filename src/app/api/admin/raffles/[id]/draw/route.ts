import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RaffleRow = {
  id: string;
  tenant_slug: string;
  config_json: any;
};

type TicketRow = {
  sale_id: string;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
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

    const prizePosition = parsePositiveInteger(formData.get("prize_position"));
    const ticketNumber = parsePositiveInteger(formData.get("ticket_number"));

    if (!prizePosition || !ticketNumber) {
      return NextResponse.json(
        { ok: false, error: "Prize number and ticket number are required" },
        { status: 400 },
      );
    }

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

    const existingPrizeWinner = await queryOne(
      `
      select *
      from raffle_winners
      where raffle_id = $1
        and prize_position = $2
      limit 1
      `,
      [raffle.id, prizePosition],
    );

    if (existingPrizeWinner) {
      return NextResponse.json(
        { ok: false, error: `Prize ${prizePosition} has already been drawn` },
        { status: 400 },
      );
    }

    const existingTicketWinner = await queryOne(
      `
      select *
      from raffle_winners
      where raffle_id = $1
        and ticket_number = $2
      limit 1
      `,
      [raffle.id, ticketNumber],
    );

    if (existingTicketWinner) {
      return NextResponse.json(
        { ok: false, error: `Ticket #${ticketNumber} has already won a prize` },
        { status: 400 },
      );
    }

    const soldTicket = await queryOne<TicketRow>(
      `
      select
        id as sale_id,
        ticket_number,
        colour,
        buyer_name,
        buyer_email
      from raffle_ticket_sales
      where raffle_id = $1
        and ticket_number = $2
      limit 1
      `,
      [raffle.id, ticketNumber],
    );

    if (!soldTicket) {
      return NextResponse.json(
        { ok: false, error: "That ticket has not been sold" },
        { status: 400 },
      );
    }

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
        soldTicket.ticket_number,
        soldTicket.colour,
        soldTicket.sale_id,
        soldTicket.buyer_name,
        soldTicket.buyer_email,
      ],
    );

    return NextResponse.json({ ok: true, winner });
  } catch (error) {
    console.error("Raffle dramatic draw failed", error);

    return NextResponse.json(
      { ok: false, error: "Draw failed" },
      { status: 500 },
    );
  }
}
