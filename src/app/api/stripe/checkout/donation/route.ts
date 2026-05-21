import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { query, queryOne } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const GIFT_AID_DECLARATION_TEXT =
  "I confirm that I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year, it is my responsibility to pay any difference.";

type TenantConnectStatus = {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_complete: boolean | null;
  stripe_connect_charges_enabled: boolean | null;
  stripe_connect_payouts_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

type CampaignLookup = {
  id: string;
  title: string;
  slug: string | null;
  currency: string | null;
};

type DonationRow = {
  id: string;
  tenant_slug: string;
  campaign_type: string | null;
  campaign_id: string | null;
  campaign_title: string | null;
  donor_name: string | null;
  donor_email: string | null;
  message: string | null;
  amount_cents: number;
  currency: string;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  paid_at: string | null;
  donor_covered_fees: boolean;
  donor_fee_cents: number;
  gross_amount_cents: number | null;
  platform_fee_cents: number;
  net_amount_cents: number | null;
};

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function cleanCampaignType(value: unknown) {
  const clean = cleanText(value).toLowerCase();

  if (
    clean === "raffle" ||
    clean === "squares" ||
    clean === "event" ||
    clean === "auction"
  ) {
    return clean;
  }

  return "general";
}

function boolValue(value: unknown) {
  const clean = String(value || "").trim().toLowerCase();

  return clean === "yes" || clean === "true" || clean === "1" || clean === "on";
}

function poundsToCents(value: unknown) {
  const raw = cleanText(value).replace(/[£,\s]/g, "");
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.round(amount * 100);
}

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function calculatePlatformCommissionCents(params: {
  amountCents: number;
  platformFeePercent: number;
}) {
  const amountCents = Math.max(0, Math.round(params.amountCents || 0));
  const platformFeePercent = safePercent(params.platformFeePercent);

  if (!amountCents || !platformFeePercent) {
    return 0;
  }

  return Math.max(0, Math.round(amountCents * (platformFeePercent / 100)));
}

function calculateDonationCoverFeeCents(params: {
  donationAmountCents: number;
  platformCommissionCents: number;
}) {
  const donationAmountCents = Math.max(
    0,
    Math.round(params.donationAmountCents || 0),
  );
  const platformCommissionCents = Math.max(
    0,
    Math.round(params.platformCommissionCents || 0),
  );

  if (!donationAmountCents) {
    return 0;
  }

  const estimatedStripeFeeCents = Math.max(
    30,
    Math.ceil(donationAmountCents * 0.015 + 20),
  );

  return Math.max(0, platformCommissionCents + estimatedStripeFeeCents);
}

function getBaseUrl(request: NextRequest) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    request.nextUrl.origin;

  return appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
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

function getUsableConnectAccountId(params: {
  settingsAccountId?: string | null;
  connectStatus?: TenantConnectStatus | null;
}) {
  const settingsAccountId = cleanText(params.settingsAccountId);
  const statusAccountId = cleanText(
    params.connectStatus?.stripe_connect_account_id,
  );

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

async function lookupCampaign(params: {
  tenantSlug: string;
  campaignType: string;
  campaignId: string;
}): Promise<CampaignLookup | null> {
  if (!params.campaignId || params.campaignType === "general") {
    return null;
  }

  if (params.campaignType === "raffle") {
    return queryOne<CampaignLookup>(
      `
        select id::text as id, title, slug, currency
        from raffles
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "squares") {
    return queryOne<CampaignLookup>(
      `
        select id::text as id, title, slug, currency
        from squares_games
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "event") {
    return queryOne<CampaignLookup>(
      `
        select id::text as id, title, slug, currency
        from events
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  if (params.campaignType === "auction") {
    return queryOne<CampaignLookup>(
      `
        select id::text as id, title, slug, currency
        from silent_auctions
        where id::text = $1
          and tenant_slug = $2
        limit 1
      `,
      [params.campaignId, params.tenantSlug],
    );
  }

  return null;
}

async function createDonation(input: {
  tenantSlug: string;
  campaignType: string;
  campaignId: string | null;
  campaignTitle: string | null;
  donorName: string | null;
  donorEmail: string | null;
  message: string | null;
  amountCents: number;
  currency: string;
  donorCoveredFees: boolean;
  donorFeeCents: number;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
  giftAidClaimed: boolean;
  giftAidFirstName: string | null;
  giftAidLastName: string | null;
  giftAidAddressLine1: string | null;
  giftAidAddressLine2: string | null;
  giftAidTownOrCity: string | null;
  giftAidPostcode: string | null;
  giftAidDeclarationText: string | null;
}) {
  return queryOne<DonationRow>(
    `
      insert into public_donations (
        tenant_slug,
        campaign_type,
        campaign_id,
        campaign_title,
        donor_name,
        donor_email,
        message,
        amount_cents,
        currency,
        payment_status,
        donor_covered_fees,
        donor_fee_cents,
        gross_amount_cents,
        platform_fee_cents,
        net_amount_cents,
        gift_aid_claimed,
        gift_aid_first_name,
        gift_aid_last_name,
        gift_aid_address_line_1,
        gift_aid_address_line_2,
        gift_aid_town_or_city,
        gift_aid_postcode,
        gift_aid_declaration_text,
        gift_aid_declaration_accepted_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      returning *
    `,
    [
      input.tenantSlug,
      input.campaignType,
      input.campaignId,
      input.campaignTitle,
      input.donorName,
      input.donorEmail,
      input.message,
      input.amountCents,
      input.currency,
      input.donorCoveredFees,
      input.donorFeeCents,
      input.grossAmountCents,
      input.platformFeeCents,
      input.netAmountCents,
      input.giftAidClaimed,
      input.giftAidFirstName,
      input.giftAidLastName,
      input.giftAidAddressLine1,
      input.giftAidAddressLine2,
      input.giftAidTownOrCity,
      input.giftAidPostcode,
      input.giftAidDeclarationText,
      input.giftAidClaimed ? new Date().toISOString() : null,
    ],
  );
}

async function markDonationCheckoutStarted(input: {
  donationId: string;
  stripeCheckoutSessionId: string;
}) {
  await query(
    `
      update public_donations
      set
        payment_status = 'checkout_started',
        stripe_checkout_session_id = $2
      where id = $1
        and payment_status <> 'paid'
    `,
    [input.donationId, input.stripeCheckoutSessionId],
  );
}

async function parseRequestBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return await request.json().catch(() => ({}));
  }

  const formData = await request.formData();
  const body: Record<string, FormDataEntryValue> = {};

  for (const [key, value] of formData.entries()) {
    body[key] = value;
  }

  return body;
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseRequestBody(request);

    const tenantSlug = cleanText(body.tenantSlug || body.tenant_slug);
    const campaignType = cleanCampaignType(
      body.campaignType || body.campaign_type,
    );
    const campaignId = cleanText(body.campaignId || body.campaign_id);
    const donorName = cleanText(body.donorName || body.donor_name) || null;
    const donorEmail = cleanEmail(body.donorEmail || body.donor_email);
    const message = cleanText(body.message) || null;
    const amountCents = poundsToCents(body.amount || body.amountPounds);
    const donorCoveredFees = boolValue(
      body.coverFees || body.cover_fees || body.donorCoveredFees,
    );

    const giftAidClaimed = boolValue(
      body.giftAidClaimed ||
        body.gift_aid_claimed ||
        body.giftAid ||
        body.gift_aid,
    );

    const giftAidFirstName = cleanText(
      body.giftAidFirstName || body.gift_aid_first_name,
    );

    const giftAidLastName = cleanText(
      body.giftAidLastName || body.gift_aid_last_name,
    );

    const giftAidAddressLine1 = cleanText(
      body.giftAidAddressLine1 || body.gift_aid_address_line_1,
    );

    const giftAidAddressLine2 = cleanText(
      body.giftAidAddressLine2 || body.gift_aid_address_line_2,
    );

    const giftAidTownOrCity = cleanText(
      body.giftAidTownOrCity || body.gift_aid_town_or_city,
    );

    const giftAidPostcode = cleanText(
      body.giftAidPostcode || body.gift_aid_postcode,
    );

    if (!tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant is required." },
        { status: 400 },
      );
    }

    if (!donorEmail || !donorEmail.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    if (amountCents < 100) {
      return NextResponse.json(
        { ok: false, error: "Minimum donation is £1.00." },
        { status: 400 },
      );
    }

    if (
      giftAidClaimed &&
      (!giftAidFirstName ||
        !giftAidLastName ||
        !giftAidAddressLine1 ||
        !giftAidTownOrCity ||
        !giftAidPostcode)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Please complete the Gift Aid name and address fields, or untick Gift Aid.",
        },
        { status: 400 },
      );
    }

    const campaign = await lookupCampaign({
      tenantSlug,
      campaignType,
      campaignId,
    });

    if (campaignType !== "general" && campaignId && !campaign) {
      return NextResponse.json(
        { ok: false, error: "Campaign not found for this tenant." },
        { status: 404 },
      );
    }

    const currency = cleanText(campaign?.currency || body.currency || "GBP")
      .toUpperCase()
      .slice(0, 3);

    const campaignTitle =
      cleanText(body.campaignTitle || body.campaign_title) ||
      campaign?.title ||
      "General donation";

    const tenantSettings = await getTenantSettings(tenantSlug);
    const connectStatus = await getTenantConnectStatus(tenantSlug);

    const platformCommissionCents = calculatePlatformCommissionCents({
      amountCents,
      platformFeePercent: tenantSettings?.platform_fee_percent ?? 0,
    });

    const donorFeeCents = donorCoveredFees
      ? calculateDonationCoverFeeCents({
          donationAmountCents: amountCents,
          platformCommissionCents,
        })
      : 0;

    const grossAmountCents = amountCents + donorFeeCents;
    const netAmountCents = amountCents;

    const donation = await createDonation({
      tenantSlug,
      campaignType,
      campaignId: campaign?.id || campaignId || null,
      campaignTitle,
      donorName,
      donorEmail,
      message,
      amountCents,
      currency,
      donorCoveredFees,
      donorFeeCents,
      grossAmountCents,
      platformFeeCents: platformCommissionCents,
      netAmountCents,
      giftAidClaimed,
      giftAidFirstName: giftAidClaimed ? giftAidFirstName : null,
      giftAidLastName: giftAidClaimed ? giftAidLastName : null,
      giftAidAddressLine1: giftAidClaimed ? giftAidAddressLine1 : null,
      giftAidAddressLine2: giftAidClaimed ? giftAidAddressLine2 || null : null,
      giftAidTownOrCity: giftAidClaimed ? giftAidTownOrCity : null,
      giftAidPostcode: giftAidClaimed ? giftAidPostcode : null,
      giftAidDeclarationText: giftAidClaimed ? GIFT_AID_DECLARATION_TEXT : null,
    });

    if (!donation) {
      return NextResponse.json(
        { ok: false, error: "Could not create donation." },
        { status: 500 },
      );
    }

    const connectAccountId = getUsableConnectAccountId({
      settingsAccountId: tenantSettings?.stripe_connect_account_id,
      connectStatus,
    });

    const shouldUseConnectRouting =
      Boolean(connectAccountId) && isConnectReady(connectStatus);

    const shouldApplyApplicationFee =
      shouldUseConnectRouting &&
      platformCommissionCents > 0 &&
      platformCommissionCents < grossAmountCents;

    const paymentIntentData = shouldUseConnectRouting
      ? {
          transfer_data: {
            destination: connectAccountId,
          },
          ...(shouldApplyApplicationFee
            ? {
                application_fee_amount: platformCommissionCents,
              }
            : {}),
        }
      : undefined;

    const baseUrl = getBaseUrl(request);
    const successUrl = `${baseUrl}/c/${encodeURIComponent(
      tenantSlug,
    )}/support?donation=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/c/${encodeURIComponent(
      tenantSlug,
    )}/support?donation=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: donorEmail,
      client_reference_id: donation.id,

      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name:
                campaignType === "general"
                  ? "Donation"
                  : `Donation · ${campaignTitle}`,
              description:
                donorFeeCents > 0
                  ? `Donation ${
                      campaignType === "general"
                        ? ""
                        : `supporting ${campaignTitle}`
                    } including a contribution towards platform/payment costs.`
                  : campaignType === "general"
                    ? `Donation to ${tenantSlug}`
                    : `Donation supporting ${campaignTitle}`,
            },
            unit_amount: grossAmountCents,
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
        type: "donation",
        kind: "donation",

        tenant_slug: tenantSlug,
        tenantSlug,

        donation_id: donation.id,
        donationId: donation.id,

        campaign_type: campaignType,
        campaignType,
        campaign_id: donation.campaign_id || "",
        campaignId: donation.campaign_id || "",
        campaign_title: campaignTitle,

        donor_name: donorName || "",
        donor_email: donorEmail,

        gift_aid_claimed: giftAidClaimed ? "true" : "false",

        base_amount_cents: String(amountCents),
        donation_amount_cents: String(amountCents),
        ticket_subtotal_cents: String(amountCents),
        tenant_target_amount_cents: String(amountCents),
        net_amount_cents: String(netAmountCents),

        gross_amount_cents: String(grossAmountCents),

        platform_commission_cents: String(platformCommissionCents),
        tier_platform_commission_cents: String(platformCommissionCents),
        platform_fee_cents: String(platformCommissionCents),

        donor_fee_cents: String(donorFeeCents),
        supporter_contribution_cents: String(donorFeeCents),
        buyer_fee_cents: String(donorFeeCents),
        donor_covered_fees: donorCoveredFees ? "true" : "false",

        application_fee_amount: shouldApplyApplicationFee
          ? String(platformCommissionCents)
          : "0",
        application_fee_amount_cents: shouldApplyApplicationFee
          ? String(platformCommissionCents)
          : "0",

        stripe_connect_routed: shouldUseConnectRouting ? "true" : "false",
        stripe_connect_account_id: shouldUseConnectRouting
          ? connectAccountId
          : "",
        platform_fee_percent: String(tenantSettings?.platform_fee_percent ?? ""),
      },

      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe did not return a checkout URL." },
        { status: 500 },
      );
    }

    await markDonationCheckoutStarted({
      donationId: donation.id,
      stripeCheckoutSessionId: session.id,
    });

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error: any) {
    console.error("POST donation checkout failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Donation checkout failed.",
      },
      { status: 500 },
    );
  }
}
