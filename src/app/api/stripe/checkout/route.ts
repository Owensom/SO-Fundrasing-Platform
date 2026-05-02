import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function clean(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:]+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const raffleId = String(body.raffleId ?? body.raffle_id ?? "").trim();

    const selectedTickets = Array.isArray(body.selectedTickets)
      ? body.selectedTickets
      : Array.isArray(body.tickets)
        ? body.tickets
        : Array.isArray(body.ticketNumbers)
          ? body.ticketNumbers
          : [];

    const quantity = selectedTickets.length;

    const buyerName = String(
      body.buyerName ?? body.buyer_name ?? body.name ?? "",
    ).trim();

    const buyerEmail = String(
      body.buyerEmail ?? body.buyer_email ?? body.email ?? "",
    ).trim();

    const reservationToken = String(
      body.reservationToken ?? body.reservation_token ?? "",
    ).trim();

    const submittedAnswer = clean(
      body.answer ??
        body.entryAnswer ??
        body.entry_answer ??
        body.questionAnswer ??
        body.question_answer ??
        body.legalAnswer ??
        body.legal_answer,
    );

    if (!raffleId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid request" },
        { status: 400 },
      );
    }

    const raffle = await getRaffleById(raffleId);

    if (!raffle || raffle.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Raffle not available" },
        { status: 400 },
      );
    }

    const question = (raffle.config_json as any)?.question;

    if (question?.text && question?.answer) {
      const correctAnswer = clean(question.answer);

      if (!submittedAnswer || submittedAnswer !== correctAnswer) {
        return NextResponse.json(
          { ok: false, error: "Incorrect answer to entry question" },
          { status: 400 },
        );
      }
    }

    const ticketPriceCents = Number(raffle.ticket_price_cents || 0);

    if (!ticketPriceCents || ticketPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price" },
        { status: 400 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      req.nextUrl.origin;

    const baseUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

    const tenantSlug = String((raffle as any).tenant_slug ?? "").trim();

    const publicRafflePath = tenantSlug ? `/c/${tenantSlug}` : "/";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: buyerEmail || undefined,

      line_items: [
        {
          price_data: {
            currency: String(raffle.currency || "GBP").toLowerCase(),
            product_data: {
              name: raffle.title,
            },
            unit_amount: ticketPriceCents,
          },
          quantity,
        },
      ],

      metadata: {
        type: "raffle",

        raffleId,
        raffle_id: raffleId,

        raffleSlug: raffle.slug,
        raffle_slug: raffle.slug,

        tenantSlug,
        tenant_slug: tenantSlug,

        quantity: String(quantity),
        buyerName,
        buyerEmail,

        reservationToken,
        reservation_token: reservationToken,

        raffle_title: raffle.title,
      },

      success_url: `${baseUrl}${publicRafflePath}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${publicRafflePath}`,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error: any) {
    console.error("checkout error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Checkout failed" },
      { status: 500 },
    );
  }
}
