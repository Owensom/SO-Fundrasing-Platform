import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getRaffleById } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
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

type ReservationRow = {
  id: string;
  ticket_number: number;
  colour: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
};

type NormalisedOffer = {
  id: string;
  label: string;
  quantity: number;
  priceCents: number;
  isActive: boolean;
  sortOrder: number;
};

type BestPriceResult = {
  quantity: number;
  standardTotalCents: number;
  checkoutTotalCents: number;
  savingsCents: number;
  appliedOffers: Array<{
    label: string;
    quantity: number;
    priceCents: number;
    times: number;
  }>;
};

const STRIPE_STANDARD_UK_PERCENT = 0.015;
const STRIPE_STANDARD_UK_FIXED_CENTS = 20;

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

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function safeMoneyCents(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(number));
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

function calculateSupporterCoverFeeCents(params: {
  baseAmountCents: number;
  platformCommissionCents: number;
}) {
  const baseAmountCents = Math.max(0, Math.round(params.baseAmountCents));
  const platformCommissionCents = Math.max(
    0,
    Math.round(params.platformCommissionCents),
  );

  if (!baseAmountCents && !platformCommissionCents) {
    return 0;
  }

  const grossAmountCents = Math.ceil(
    (baseAmountCents +
      platformCommissionCents +
      STRIPE_STANDARD_UK_FIXED_CENTS) /
      (1 - STRIPE_STANDARD_UK_PERCENT),
  );

  return Math.max(grossAmountCents - baseAmountCents, 0);
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

function ticketKey(ticketNumber: unknown, colour: unknown) {
  return `${Number(ticketNumber)}::${cleanText(colour).toLowerCase()}`;
}

function normaliseOfferPriceCents(offer: any) {
  const explicitCents = Number(
    offer?.price_cents ?? offer?.priceCents ?? offer?.amount_cents,
  );

  if (Number.isFinite(explicitCents) && explicitCents > 0) {
    return Math.round(explicitCents);
  }

  const price = Number(offer?.price ?? offer?.amount ?? 0);

  if (!Number.isFinite(price) || price <= 0) {
    return 0;
  }

  return Math.round(price * 100);
}

function normaliseOffers(rawOffers: unknown): NormalisedOffer[] {
  if (!Array.isArray(rawOffers)) return [];

  return rawOffers
    .map((offer: any, index) => {
      const quantity = Number(offer?.quantity ?? offer?.tickets ?? 0);
      const priceCents = normaliseOfferPriceCents(offer);
      const isActive = Boolean(offer?.isActive ?? offer?.is_active ?? true);

      return {
        id: cleanText(offer?.id || `offer-${index + 1}`),
        label: cleanText(offer?.label || `Offer ${index + 1}`),
        quantity:
          Number.isFinite(quantity) && quantity > 0
            ? Math.floor(quantity)
            : 0,
        priceCents,
        isActive,
        sortOrder: Number.isFinite(Number(offer?.sortOrder ?? offer?.sort_order))
          ? Number(offer?.sortOrder ?? offer?.sort_order)
          : index,
      };
    })
    .filter(
      (offer) => offer.isActive && offer.quantity > 0 && offer.priceCents > 0,
    )
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.quantity - b.quantity;
    });
}

function calculateBestRafflePrice(params: {
  quantity: number;
  ticketPriceCents: number;
  rawOffers: unknown;
}): BestPriceResult {
  const quantity = Math.max(0, Math.floor(Number(params.quantity) || 0));
  const ticketPriceCents = safeMoneyCents(params.ticketPriceCents);
  const standardTotalCents = quantity * ticketPriceCents;
  const offers = normaliseOffers(params.rawOffers);

  if (!quantity || !ticketPriceCents || !offers.length) {
    return {
      quantity,
      standardTotalCents,
      checkoutTotalCents: standardTotalCents,
      savingsCents: 0,
      appliedOffers: [],
    };
  }

  const dp: Array<{
    total: number;
    appliedOffers: Array<{
      label: string;
      quantity: number;
      priceCents: number;
      times: number;
    }>;
  }> = Array.from({ length: quantity + 1 }, () => ({
    total: Number.POSITIVE_INFINITY,
    appliedOffers: [],
  }));

  dp[0] = {
    total: 0,
    appliedOffers: [],
  };

  for (let index = 1; index <= quantity; index += 1) {
    dp[index] = {
      total: dp[index - 1].total + ticketPriceCents,
      appliedOffers: [...dp[index - 1].appliedOffers],
    };

    for (const offer of offers) {
      if (index < offer.quantity) continue;

      const previous = dp[index - offer.quantity];
      const candidateTotal = previous.total + offer.priceCents;

      if (candidateTotal < dp[index].total) {
        const existing = previous.appliedOffers.find(
          (item) => item.label === offer.label,
        );

        dp[index] = {
          total: candidateTotal,
          appliedOffers: existing
            ? previous.appliedOffers.map((item) =>
                item.label === offer.label
                  ? {
                      ...item,
                      times: item.times + 1,
                    }
                  : item,
              )
            : [
                ...previous.appliedOffers,
                {
                  label: offer.label,
                  quantity: offer.quantity,
                  priceCents: offer.priceCents,
                  times: 1,
                },
              ],
        };
      }
    }
  }

  const bestTotal = Number.isFinite(dp[quantity]?.total)
    ? Math.max(0, Math.round(dp[quantity].total))
    : standardTotalCents;

  const checkoutTotalCents = Math.min(bestTotal, standardTotalCents);
  const savingsCents = Math.max(standardTotalCents - checkoutTotalCents, 0);

  return {
    quantity,
    standardTotalCents,
    checkoutTotalCents,
    savingsCents,
    appliedOffers: dp[quantity]?.appliedOffers ?? [],
  };
}

function formatAppliedOffers(
  appliedOffers: BestPriceResult["appliedOffers"],
) {
  if (!appliedOffers.length) return "";

  return appliedOffers
    .map((offer) => {
      return `${offer.label}${offer.times > 1 ? ` × ${offer.times}` : ""}`;
    })
    .join(", ");
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

async function getActiveReservations(input: {
  raffleId: string;
  reservationToken: string;
}) {
  return query<ReservationRow>(
    `
      select
        id,
        ticket_number,
        colour,
        buyer_name,
        buyer_email
      from raffle_ticket_reservations
      where raffle_id = $1
        and reservation_token = $2
        and status = 'reserved'
        and expires_at > now()
      order by ticket_number asc, colour asc nulls last
    `,
    [input.raffleId, input.reservationToken],
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

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
        { ok: false, error: "Raffle not available" },
        { status: 404 },
      );
    }

    const raffleId = cleanText(body.raffleId ?? body.raffle_id ?? "");
    const reservationToken = cleanText(
      body.reservationToken ?? body.reservation_token ?? "",
    );

    const selectedTickets = parseSelectedTickets(body);

    const buyerName = cleanText(
      body.buyerName ?? body.buyer_name ?? body.name ?? "",
    );

    const buyerEmail = cleanEmail(
      body.buyerEmail ?? body.buyer_email ?? body.email ?? "",
    );

    const submittedAnswer = clean(
      body.answer ??
        body.entryAnswer ??
        body.entry_answer ??
        body.questionAnswer ??
        body.question_answer ??
        body.legalAnswer ??
        body.legal_answer,
    );

    if (!raffleId || !reservationToken || selectedTickets.length <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid request" },
        { status: 400 },
      );
    }

    if (!buyerName || !buyerEmail) {
      return NextResponse.json(
        { ok: false, error: "Buyer name and email are required" },
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

    const raffleTenantSlug = cleanText((raffle as any).tenant_slug);

    if (!raffleTenantSlug || raffleTenantSlug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Raffle not available" },
        { status: 404 },
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

    const reservations = await getActiveReservations({
      raffleId,
      reservationToken,
    });

    if (reservations.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Reservation not found or expired" },
        { status: 409 },
      );
    }

    if (reservations.length !== selectedTickets.length) {
      return NextResponse.json(
        { ok: false, error: "Reservation does not match selected tickets" },
        { status: 409 },
      );
    }

    const selectedTicketKeys = new Set(
      selectedTickets.map((ticket: any) =>
        ticketKey(ticket.ticket_number ?? ticket.number, ticket.colour ?? ""),
      ),
    );

    const reservationTicketKeys = new Set(
      reservations.map((reservation) =>
        ticketKey(reservation.ticket_number, reservation.colour ?? ""),
      ),
    );

    if (selectedTicketKeys.size !== reservationTicketKeys.size) {
      return NextResponse.json(
        { ok: false, error: "Reservation contains duplicate ticket data" },
        { status: 409 },
      );
    }

    for (const key of reservationTicketKeys) {
      if (!selectedTicketKeys.has(key)) {
        return NextResponse.json(
          { ok: false, error: "Reservation does not match selected tickets" },
          { status: 409 },
        );
      }
    }

    const reservationBuyerEmail = cleanEmail(reservations[0]?.buyer_email);

    if (reservationBuyerEmail && reservationBuyerEmail !== buyerEmail) {
      return NextResponse.json(
        { ok: false, error: "Reservation buyer does not match checkout buyer" },
        { status: 409 },
      );
    }

    const ticketPriceCents = Number(raffle.ticket_price_cents || 0);

    if (!ticketPriceCents || ticketPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid ticket price" },
        { status: 400 },
      );
    }

    const quantity = reservations.length;
    const config = (raffle.config_json as any) ?? {};

    const pricing = calculateBestRafflePrice({
      quantity,
      ticketPriceCents,
      rawOffers: config.offers,
    });

    const baseAmountCents = pricing.checkoutTotalCents;

    if (!baseAmountCents || baseAmountCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid checkout total" },
        { status: 400 },
      );
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      req.nextUrl.origin;

    const baseUrl = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;

    const publicRafflePath = `/c/${tenantSlug}`;

    const tenantSettings = await getTenantSettings(tenantSlug);
    const connectStatus = await getTenantConnectStatus(tenantSlug);

    const buyerFeeContributionsEnabled = Boolean(
      tenantSettings?.buyer_fee_contributions_enabled,
    );

    const requestedCoverFees = Boolean(
      body.coverFees ??
        body.cover_fees ??
        body.donorCoveredFees ??
        body.donor_covered_fees ??
        body.buyerCoversFees ??
        body.buyer_covers_fees,
    );

    const platformCommissionCents = calculateApplicationFeeAmount({
      totalAmountCents: baseAmountCents,
      platformFeePercent: tenantSettings?.platform_fee_percent ?? 0,
    });

    const supporterContributionCents =
      requestedCoverFees && buyerFeeContributionsEnabled
        ? calculateSupporterCoverFeeCents({
            baseAmountCents,
            platformCommissionCents,
          })
        : 0;

    const checkoutTotalCents = baseAmountCents + supporterContributionCents;

    const platformFeeCents =
      supporterContributionCents > 0
        ? supporterContributionCents
        : platformCommissionCents;

    const netAmountCents = Math.max(checkoutTotalCents - platformFeeCents, 0);

    const connectAccountId = getUsableConnectAccountId({
      settingsAccountId: tenantSettings?.stripe_connect_account_id,
      connectStatus,
    });

    const shouldUseConnectRouting =
      Boolean(connectAccountId) && isConnectReady(connectStatus);

    const shouldApplyApplicationFee =
      shouldUseConnectRouting &&
      platformFeeCents > 0 &&
      platformFeeCents < checkoutTotalCents;

    const paymentIntentData = shouldUseConnectRouting
      ? {
          transfer_data: {
            destination: connectAccountId,
          },
          ...(shouldApplyApplicationFee
            ? {
                application_fee_amount: platformFeeCents,
              }
            : {}),
        }
      : undefined;

    const appliedOfferSummary = formatAppliedOffers(pricing.appliedOffers);

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
              description:
                pricing.savingsCents > 0 && appliedOfferSummary
                  ? `${quantity} raffle tickets · ${appliedOfferSummary}`
                  : `${quantity} raffle ticket${quantity === 1 ? "" : "s"}`,
            },
            unit_amount: checkoutTotalCents,
          },
          quantity: 1,
        },
      ],

      ...(paymentIntentData
        ? {
            payment_intent_data: paymentIntentData,
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

        ticket_price_cents: String(ticketPriceCents),
        standard_total_cents: String(pricing.standardTotalCents),
        checkout_total_cents: String(checkoutTotalCents),
        offer_total_cents: String(baseAmountCents),
        offer_savings_cents: String(pricing.savingsCents),
        applied_offers: appliedOfferSummary,

        base_amount_cents: String(baseAmountCents),
        platform_commission_cents: String(platformCommissionCents),
        supporter_contribution_cents: String(supporterContributionCents),
        donor_fee_cents: String(supporterContributionCents),
        buyer_fee_cents: String(supporterContributionCents),
        buyer_fee_contributions_enabled: buyerFeeContributionsEnabled
          ? "true"
          : "false",
        buyer_requested_cover_fees: requestedCoverFees ? "true" : "false",
        donor_covered_fees: supporterContributionCents > 0 ? "true" : "false",
        platform_fee_cents: String(platformFeeCents),
        net_amount_cents: String(netAmountCents),
        stripe_fee_estimate_model: "uk_standard_card_1_5_percent_plus_20p",

        stripe_connect_routed: shouldUseConnectRouting ? "true" : "false",
        stripe_connect_account_id: shouldUseConnectRouting
          ? connectAccountId
          : "",
        platform_fee_percent: String(
          tenantSettings?.platform_fee_percent ?? "",
        ),
        application_fee_amount: shouldApplyApplicationFee
          ? String(platformFeeCents)
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
