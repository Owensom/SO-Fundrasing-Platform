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

function calculateTierPlatformCommissionCents(params: {
  ticketSubtotalCents: number;
  platformFeePercent: number;
}) {
  const ticketSubtotalCents = Math.max(
    0,
    Math.round(params.ticketSubtotalCents),
  );

  const platformFeePercent = safePercent(params.platformFeePercent);

  if (!ticketSubtotalCents || !platformFeePercent) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(ticketSubtotalCents * (platformFeePercent / 100)),
  );
}

function calculateSupporterCoverFeeCents(params: {
  ticketSubtotalCents: number;
  tierPlatformCommissionCents: number;
}) {
  const ticketSubtotalCents = Math.max(
    0,
    Math.round(params.ticketSubtotalCents),
  );

  const tierPlatformCommissionCents = Math.max(
    0,
    Math.round(params.tierPlatformCommissionCents),
  );

  if (!ticketSubtotalCents && !tierPlatformCommissionCents) {
    return 0;
  }

  const grossAmountCents = Math.ceil(
    (ticketSubtotalCents +
      tierPlatformCommissionCents +
      STRIPE_STANDARD_UK_FIXED_CENTS) /
      (1 - STRIPE_STANDARD_UK_PERCENT),
  );

  return Math.max(grossAmountCents - ticketSubtotalCents, 0);
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
