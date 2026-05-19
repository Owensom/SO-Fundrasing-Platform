import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getRaffleBySlug } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExistingTicketRow = {
  id: string;
};

function clean(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:]+$/g, "");
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function parseSelectedTickets(body: any) {
  if (Array.isArray(body.selectedTickets)) {
    return body.selectedTickets;
  }

  if (Array.isArray(body.tickets)) {
    return body.tickets;
  }

  if (Array.isArray(body.ticketNumbers)) {
    return body.ticketNumbers.map((ticketNumber: unknown) => ({
      ticket_number: ticketNumber,
      colour: "",
    }));
  }

  return [];
}

function ticketKey(ticketNumber: number, colour: string) {
  return `${ticketNumber}::${colour.trim().toLowerCase()}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    const tenantSlug = await getTenantSlugFromHeaders();

    if (!tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant not found" },
        { status: 404 },
      );
    }

    const submittedTenantSlug = cleanText(
      body.tenantSlug ?? body.tenant_slug ?? "",
    );

    if (submittedTenantSlug && submittedTenantSlug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    const raffle = await getRaffleBySlug(tenantSlug, slug);

    if (!raffle || raffle.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    if (raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Raffle is closed" },
        { status: 400 },
      );
    }

    const question = (raffle.config_json as any)?.question;

    if (question?.text && question?.answer) {
      const submittedAnswer = clean(
        body.answer ??
          body.entryAnswer ??
          body.entry_answer ??
          body.questionAnswer ??
          body.question_answer ??
          body.legalAnswer ??
          body.legal_answer,
      );

      const correctAnswer = clean(question.answer);

      if (!submittedAnswer || submittedAnswer !== correctAnswer) {
        return NextResponse.json(
          { ok: false, error: "Incorrect answer to entry question" },
          { status: 400 },
        );
      }
    }

    const buyerName = cleanText(body.buyerName ?? body.buyer_name ?? "");
    const buyerEmail = cleanEmail(body.buyerEmail ?? body.buyer_email ?? "");

    if (!buyerName) {
      return NextResponse.json(
        { ok: false, error: "Buyer name is required" },
        { status: 400 },
      );
    }

    if (!buyerEmail) {
      return NextResponse.json(
        { ok: false, error: "Buyer email is required" },
        { status: 400 },
      );
    }

    const rawSelectedTickets = parseSelectedTickets(body);

    if (!rawSelectedTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No tickets selected" },
        { status: 400 },
      );
    }

    const config = (raffle.config_json as any) ?? {};
    const startNumber = Number(config.startNumber ?? 1);
    const endNumber = Number(config.endNumber ?? raffle.total_tickets ?? 0);

    const selectedTickets = rawSelectedTickets
      .map((ticket: any) => {
        const ticketNumber = Number(ticket.ticket_number ?? ticket.number);
        const colour = cleanText(ticket.colour ?? "");

        if (!Number.isFinite(ticketNumber) || ticketNumber <= 0) {
          return null;
        }

        return {
          ticketNumber: Math.floor(ticketNumber),
          colour,
        };
      })
      .filter(Boolean) as Array<{
      ticketNumber: number;
      colour: string;
    }>;

    if (!selectedTickets.length) {
      return NextResponse.json(
        { ok: false, error: "No valid tickets selected" },
        { status: 400 },
      );
    }

    const uniqueTicketKeys = new Set<string>();

    for (const ticket of selectedTickets) {
      const key = ticketKey(ticket.ticketNumber, ticket.colour);

      if (uniqueTicketKeys.has(key)) {
        return NextResponse.json(
          { ok: false, error: "Duplicate ticket selection" },
          { status: 400 },
        );
      }

      uniqueTicketKeys.add(key);

      if (
        endNumber > 0 &&
        (ticket.ticketNumber < startNumber || ticket.ticketNumber > endNumber)
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: `Ticket number must be between ${startNumber} and ${endNumber}`,
          },
          { status: 400 },
        );
      }

      const existingSoldTicket = await queryOne<ExistingTicketRow>(
        `
          select id
          from raffle_ticket_sales
          where raffle_id = $1
            and ticket_number = $2
            and coalesce(colour, '') = $3
          limit 1
        `,
        [raffle.id, ticket.ticketNumber, ticket.colour],
      );

      if (existingSoldTicket) {
        return NextResponse.json(
          {
            ok: false,
            error: `Ticket #${ticket.ticketNumber} is already sold`,
          },
          { status: 409 },
        );
      }

      const existingReservedTicket = await queryOne<ExistingTicketRow>(
        `
          select id
          from raffle_ticket_reservations
          where raffle_id = $1
            and ticket_number = $2
            and coalesce(colour, '') = $3
            and status = 'reserved'
            and expires_at > now()
          limit 1
        `,
        [raffle.id, ticket.ticketNumber, ticket.colour],
      );

      if (existingReservedTicket) {
        return NextResponse.json(
          {
            ok: false,
            error: `Ticket #${ticket.ticketNumber} is already reserved`,
          },
          { status: 409 },
        );
      }
    }

    const reservationToken = crypto.randomUUID();
    const reservationGroupId = reservationToken;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    for (const ticket of selectedTickets) {
      await query(
        `
          insert into raffle_ticket_reservations (
            raffle_id,
            ticket_number,
            colour,
            buyer_name,
            buyer_email,
            status,
            reservation_token,
            reservation_group_id,
            expires_at,
            created_at
          )
          values ($1,$2,$3,$4,$5,'reserved',$6,$7,$8,now())
        `,
        [
          raffle.id,
          ticket.ticketNumber,
          ticket.colour,
          buyerName,
          buyerEmail,
          reservationToken,
          reservationGroupId,
          expiresAt,
        ],
      );
    }

    return NextResponse.json({
      ok: true,
      reservationToken,
      reservation_token: reservationToken,
      expiresAt: expiresAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error("reserve error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Reservation failed" },
      { status: 500 },
    );
  }
}
