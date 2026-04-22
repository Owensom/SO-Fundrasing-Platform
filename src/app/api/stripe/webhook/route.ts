import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query } from "@/lib/db";
import { sendReceiptEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationRow = {
  id: string;
  raffle_id: string;
  reservation_token: string;
  ticket_number: number;
  colour: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  unit_price_cents: number;
  status: string;
  tenant_slug: string;
  raffle_title: string;
  raffle_config_json: {
    colours?: Array<
      | string
      | {
          id?: string;
          value?: string;
          name?: string;
          label?: string;
          hex?: string;
        }
    >;
  } | null;
};

type ExistingPaymentRow = {
  id: string;
};

type ExistingSaleRow = {
  reservation_id: string | null;
};

type NormalisedColour = {
  value: string;
  label: string;
  hex?: string;
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

function titleCase(input: string) {
  return input
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
    });
}

function looksLikeHexColour(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normaliseColours(colours: unknown): NormalisedColour[] {
  if (!Array.isArray(colours)) return [];

  return colours
    .map((colour) => {
      if (typeof colour === "string") {
        const trimmed = colour.trim();
        if (!trimmed) return null;

        return {
          value: trimmed.toLowerCase(),
          label: looksLikeHexColour(trimmed)
            ? trimmed.toUpperCase()
            : titleCase(trimmed),
          hex: looksLikeHexColour(trimmed) ? trimmed.toLowerCase() : undefined,
        };
      }

      if (!colour || typeof colour !== "object") return null;

      const row = colour as Record<string, unknown>;

      const rawValue =
        row.value ||
        row.id ||
        row.name ||
        row.label ||
        row.hex ||
        "default";

      const value = String(rawValue).trim().toLowerCase();
      if (!value) return null;

      const labelSource =
        row.name ||
        row.label ||
        (looksLikeHexColour(value) ? value.toUpperCase() : titleCase(value));

      const hex =
        typeof row.hex === "string" && looksLikeHexColour(row.hex)
          ? row.hex.toLowerCase()
          : looksLikeHexColour(value)
            ? value.toLowerCase()
            : undefined;

      return {
        value,
        label: String(labelSource).trim() || "Default",
        hex,
      };
    })
    .filter(Boolean) as NormalisedColour[];
}

function buildColourLookup(colours: NormalisedColour[]) {
  const lookup = new Map<string, string>();

  for (const colour of colours) {
    lookup.set(colour.value.toLowerCase(), colour.label);
    if (colour.hex) lookup.set(colour.hex.toLowerCase(), colour.label);
  }

  return lookup;
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { ok: false, error: "Missing stripe signature" },
        { status: 400 },
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Missing STRIPE_WEBHOOK_SECRET" },
        { status: 500 },
      );
    }

    const rawBody = await request.text();

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded"
    ) {
      return NextResponse.json({ ok: true });
    }

    const session = event.data.object as Stripe.Checkout.Session;

    const reservationToken = session.metadata?.reservation_token;
    const raffleId = session.metadata?.raffle_id;

    if (!reservationToken || !raffleId) {
      return NextResponse.json(
        { ok: false, error: "Missing reservation metadata" },
        { status: 400 },
      );
    }

    const reservations = await query<ReservationRow>(
      `
      select
        r.id,
        r.raffle_id,
        r.reservation_token,
        r.ticket_number,
        r.colour,
        r.buyer_email,
        r.buyer_name,
        r.unit_price_cents,
        r.status,
        ra.tenant_slug,
        ra.title as raffle_title,
        ra.config_json as raffle_config_json
      from raffle_ticket_reservations r
      join raffles ra on ra.id = r.raffle_id
      where r.raffle_id = $1
        and r.reservation_token = $2
      order by r.ticket_number asc
      `,
      [raffleId, reservationToken],
    );

    if (!reservations.length) {
      return NextResponse.json({ ok: true });
    }

    const customerEmail =
      session.customer_details?.email ||
      session.customer_email ||
      reservations[0].buyer_email ||
      null;

    const customerName =
      session.customer_details?.name ||
      reservations[0].buyer_name ||
      null;

    const total = reservations.reduce(
      (sum, row) => sum + Number(row.unit_price_cents || 0),
      0,
    );

    const feePercent = Number(process.env.PLATFORM_FEE_PERCENT || "10");
    const platformFee = Math.round(total * (feePercent / 100));

    const existingPayment = await query<ExistingPaymentRow>(
      `
      select id
      from raffle_payments
      where stripe_checkout_session_id = $1
      limit 1
      `,
      [session.id],
    );

    const paymentId = existingPayment[0]?.id ?? crypto.randomUUID();

    if (!existingPayment.length) {
      await query(
        `
        insert into raffle_payments (
          id,
          tenant_slug,
          raffle_id,
          reservation_token,
          stripe_checkout_session_id,
          stripe_payment_intent_id,
          payment_status,
          currency,
          gross_amount_cents,
          platform_fee_cents,
          net_amount_cents,
          customer_email,
          customer_name,
          metadata_json
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
        )
        `,
        [
          paymentId,
          reservations[0].tenant_slug,
          raffleId,
          reservationToken,
          session.id,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null,
          session.payment_status || "paid",
          (session.currency || "gbp").toUpperCase(),
          total,
          platformFee,
          total - platformFee,
          customerEmail,
          customerName,
          JSON.stringify(session.metadata || {}),
        ],
      );
    }

    // Keep reservation records in sync with actual Stripe buyer details
    await query(
      `
      update raffle_ticket_reservations
      set
        buyer_email = coalesce($3, buyer_email),
        buyer_name = coalesce($4, buyer_name)
      where raffle_id = $1
        and reservation_token = $2
      `,
      [raffleId, reservationToken, customerEmail, customerName],
    );

    for (const r of reservations) {
      const reservationIdText = r.id;

      const existingSale = await query<ExistingSaleRow>(
        `
        select reservation_id
        from raffle_ticket_sales
        where reservation_id = $1
        limit 1
        `,
        [reservationIdText],
      );

      if (!existingSale.length) {
        const saleId = crypto.randomUUID();
        const colourValue = r.colour || "default";

        await query(
          `
          insert into raffle_ticket_sales (
            id,
            raffle_id,
            reservation_group_id,
            purchase_reference,
            colour,
            ticket_number,
            buyer_name,
            buyer_email,
            created_at,
            reservation_id,
            payment_id,
            stripe_checkout_session_id,
            stripe_payment_intent_id,
            amount_cents,
            currency,
            colour_id,
            sold_at
          ) values (
            $1::uuid,
            $2,
            null,
            null,
            $3,
            $4,
            $5,
            $6,
            now(),
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            now()
          )
          `,
          [
            saleId,
            r.raffle_id,
            colourValue,
            r.ticket_number,
            customerName,
            customerEmail,
            reservationIdText,
            paymentId,
            session.id,
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
            r.unit_price_cents,
            (session.currency || "gbp").toUpperCase(),
            colourValue,
          ],
        );
      }
    }

    await query(
      `
      update raffle_ticket_reservations
      set status = 'sold', payment_id = $3
      where raffle_id = $1
        and reservation_token = $2
      `,
      [raffleId, reservationToken, paymentId],
    );

    await query(
      `
      update raffles
      set sold_tickets = (
        select count(*)
        from raffle_ticket_sales
        where raffle_id = $1
      )
      where id = $1
      `,
      [raffleId],
    );

    try {
      if (customerEmail) {
        const colourLookup = buildColourLookup(
          normaliseColours(reservations[0].raffle_config_json?.colours),
        );

        await sendReceiptEmail({
          to: customerEmail,
          name: customerName,
          raffleTitle: reservations[0].raffle_title,
          tickets: reservations.map((r) => {
            const rawColour = (r.colour || "default").toLowerCase();
            return {
              ticket_number: r.ticket_number,
              colour: colourLookup.get(rawColour) || r.colour || "Default",
            };
          }),
          amountCents: total,
          currency: (session.currency || "gbp").toUpperCase(),
          reservationToken,
        });
      }
    } catch (emailError) {
      console.error("receipt email send failed", emailError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("stripe webhook error", error);

    return NextResponse.json(
      { ok: false, error: "Webhook failed" },
      { status: 500 },
    );
  }
}
