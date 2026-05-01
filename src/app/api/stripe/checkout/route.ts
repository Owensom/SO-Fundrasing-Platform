import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function clean(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const raffleId = String(formData.get("raffle_id") || "").trim();
    const quantity = Number(formData.get("quantity") || 0);
    const buyerName = String(formData.get("name") || "").trim();
    const buyerEmail = String(formData.get("email") || "").trim();
    const answer = clean(formData.get("answer"));

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

      if (!answer || answer !== correctAnswer) {
        return NextResponse.json(
          { ok: false, error: "Incorrect answer to entry question" },
          { status: 400 },
        );
      }
    }

    const ticketPrice = Number(raffle.ticket_price || 0);
    const totalAmount = Math.round(ticketPrice * 100 * quantity);

    if (totalAmount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price" },
        { status: 400 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      req.nextUrl.origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: buyerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: raffle.currency.toLowerCase(),
            product_data: {
              name: raffle.title,
            },
            unit_amount: Math.round(ticketPrice * 100),
          },
          quantity,
        },
      ],
      metadata: {
        raffleId,
        quantity: String(quantity),
        buyerName,
        buyerEmail,
        entryQuestionAnswered: question?.text ? "yes" : "not_required",
      },
      success_url: `${appUrl}/api/stripe/success`,
      cancel_url: `${appUrl}/r/${raffle.slug}`,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error: any) {
    console.error("checkout error", error);

    return NextResponse.json(
      { ok: false, error: "Checkout failed" },
      { status: 500 },
    );
  }
}
