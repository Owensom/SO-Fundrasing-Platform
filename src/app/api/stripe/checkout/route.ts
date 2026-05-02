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

async function readBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await req.json();
  }

  const formData = await req.formData();

  return {
    raffle_id: formData.get("raffle_id"),
    raffleId: formData.get("raffleId"),
    quantity: formData.get("quantity"),
    name: formData.get("name"),
    buyerName: formData.get("buyerName"),
    buyer_name: formData.get("buyer_name"),
    email: formData.get("email"),
    buyerEmail: formData.get("buyerEmail"),
    buyer_email: formData.get("buyer_email"),
    answer: formData.get("answer"),
    entryAnswer: formData.get("entryAnswer"),
    entry_answer: formData.get("entry_answer"),
    questionAnswer: formData.get("questionAnswer"),
    question_answer: formData.get("question_answer"),
    legalAnswer: formData.get("legalAnswer"),
    legal_answer: formData.get("legal_answer"),
    reservationToken: formData.get("reservationToken"),
    reservation_token: formData.get("reservation_token"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);

    const raffleId = String(body.raffleId ?? body.raffle_id ?? "").trim();
    const quantity = Number(body.quantity ?? 0);

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
        raffleId,
        quantity: String(quantity),
        buyerName,
        buyerEmail,
        reservationToken,
      },

      success_url: `${baseUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/r/${raffle.slug}`,
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
