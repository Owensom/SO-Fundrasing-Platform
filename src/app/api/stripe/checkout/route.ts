import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";
import { getTenantSettings } from "@/lib/tenant-settings";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type TenantConnectStatus = {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
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

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function calculateApplicationFeeAmount(params: {
  totalAmountCents: number;
  platformFeePercent: number;
}) {
  const totalAmountCents = Math.max(0, Math.round(params.totalAmountCents));
  const platformFeePercent = safePercent(params.platformFeePercent);

  if (!totalAmountCents || !platformFeePercent) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(totalAmountCents * (platformFeePercent / 100)),
  );
}

function getUsableConnectAccountId(params: {
  settingsAccountId?: string | null;
  connectStatus?: TenantConnectStatus | null;
}) {
  const settingsAccountId = String(params.settingsAccountId || "").trim();
  const statusAccountId = String(
    params.connectStatus?.stripe_connect_account_id || "",
  ).trim();

  const accountId = settingsAccountId || statusAccountId;

  if (!accountId || !accountId.startsWith("acct_")) {
    return "";
  }

  return accountId;
}

function isConnectReady(connectStatus: TenantConnectStatus | null) {
  if (!connectStatus?.stripe_connect_account_id) {
    return false;
  }

  return Boolean(
    connectStatus.stripe_connect_onboarding_complete &&
      connectStatus.stripe_connect_charges_enabled &&
      connectStatus.stripe_connect_payouts_enabled &&
      connectStatus.stripe_connect_details_submitted,
  );
}

async function getTenantConnectStatus(
  tenantSlug: string,
): Promise<TenantConnectStatus | null> {
  const rows = await query<TenantConnectStatus>(
    `
      select
        stripe_connect_account_id,
        stripe_connect_onboarding_complete,
        stripe_connect_charges_enabled,
        stripe_connect_payouts_enabled,
        stripe_connect_details_submitted
      from tenants
      where slug = $1
      limit 1
    `,
    [tenantSlug],
  );

  return rows[0] || null;
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

    const tenantSettings = tenantSlug
      ? await getTenantSettings(tenantSlug)
      : null;

    const connectStatus = tenantSlug
      ? await getTenantConnectStatus(tenantSlug)
      : null;

    const connectAccountId = getUsableConnectAccountId({
      settingsAccountId: tenantSettings?.stripe_connect_account_id,
      connectStatus,
    });

    const totalAmountCents = ticketPriceCents * quantity;

    const applicationFeeAmount = calculateApplicationFeeAmount({
      totalAmountCents,
      platformFeePercent: tenantSettings?.platform_fee_percent ?? 0,
    });

    const shouldUseConnectRouting =
      Boolean(connectAccountId) &&
      isConnectReady(connectStatus) &&
      applicationFeeAmount > 0 &&
      applicationFeeAmount < totalAmountCents;

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

      ...(shouldUseConnectRouting
        ? {
            payment_intent_data: {
              application_fee_amount: applicationFeeAmount,
              transfer_data: {
                destination: connectAccountId,
              },
            },
          }
        : {}),

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

        stripe_connect_routed: shouldUseConnectRouting ? "true" : "false",
        stripe_connect_account_id: shouldUseConnectRouting
          ? connectAccountId
          : "",
        platform_fee_percent: String(
          tenantSettings?.platform_fee_percent ?? "",
        ),
        application_fee_amount: shouldUseConnectRouting
          ? String(applicationFeeAmount)
          : "0",
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
