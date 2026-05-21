        <aside style={styles.infoCard}>
          <div style={styles.sectionEyebrow}>What this is</div>
          <h2 style={styles.infoTitle}>A simple support payment</h2>

          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <strong>Separate from campaign entry</strong>
              <span>
                This does not issue tickets, seats, squares, bids or entries.
              </span>
            </div>

            <div style={styles.infoItem}>
              <strong>Secure checkout</strong>
              <span>Payment is processed through Stripe.</span>
            </div>

            <div style={styles.infoItem}>
              <strong>Cover fees option</strong>
              <span>
                Donors can choose to add a small contribution to help cover
                platform and payment costs.
              </span>
            </div>

            <div style={styles.infoItem}>
              <strong>Gift Aid later</strong>
              <span>
                Gift Aid can be added safely to this pure donation flow later.
              </span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

const responsiveStyles = `
.support-page,
.support-page * {
  box-sizing: border-box;
}

.support-page {
  overflow-x: hidden;
}

.support-page section,
.support-page div,
.support-page form,
.support-page label,
.support-page aside {
  min-width: 0;
}

@media (max-width: 860px) {
  .support-page .support-hero,
  .support-page .support-content-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 620px) {
  .support-page {
    width: 100% !important;
    max-width: 100% !important;
    padding: 16px 10px 44px !important;
  }

  .support-page .support-hero {
    padding: 18px !important;
    border-radius: 24px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.10), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    padding: 26,
    borderRadius: 30,
    background:
      "linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    marginBottom: 18,
    boxSizing: "border-box",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  backLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 14,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 13,
    boxSizing: "border-box",
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
    minWidth: 0,
  },

  badge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.32)",
    fontSize: 13,
    fontWeight: 950,
  },

  softBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#dbeafe",
    border: "1px solid rgba(191,219,254,0.26)",
    fontSize: 13,
    fontWeight: 950,
  },

  title: {
    margin: 0,
    fontSize: "clamp(38px, 7vw, 70px)",
    lineHeight: 0.96,
    letterSpacing: "-0.065em",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: "16px 0 0",
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 750,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },

  viewCampaignLink: {
    display: "inline-flex",
    width: "fit-content",
    maxWidth: "100%",
    marginTop: 18,
    padding: "11px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 950,
    boxSizing: "border-box",
  },

  heroPanel: {
    display: "grid",
    gap: 10,
    alignContent: "center",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    minWidth: 0,
  },

  panelEyebrow: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  panelTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 26,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  panelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  statusCard: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 18,
    border: "1px solid transparent",
    boxSizing: "border-box",
  },

  successCard: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#bbf7d0",
  },

  warningCard: {
    background: "#fff7ed",
    color: "#9a3412",
    borderColor: "#fed7aa",
  },

  statusTitle: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  statusText: {
    margin: "7px 0 0",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(280px, 0.9fr)",
    gap: 18,
    minWidth: 0,
  },

  formCard: {
    display: "grid",
    gap: 16,
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    boxSizing: "border-box",
  },

  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "11px 13px",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
    background: "#ffffff",
    color: "#0f172a",
  },

  textarea: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "11px 13px",
    fontSize: 16,
    fontFamily: "inherit",
    boxSizing: "border-box",
    minWidth: 0,
    background: "#ffffff",
    color: "#0f172a",
  },

  coverFeesBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    cursor: "pointer",
    minWidth: 0,
  },

  checkbox: {
    width: 18,
    height: 18,
    marginTop: 2,
    flex: "0 0 auto",
    accentColor: "#1683f8",
  },

  coverFeesText: {
    display: "grid",
    gap: 4,
    lineHeight: 1.45,
    fontSize: 14,
    fontWeight: 750,
    minWidth: 0,
  },

  primaryButton: {
    minHeight: 50,
    padding: "13px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.22)",
  },

  infoCard: {
    display: "grid",
    gap: 16,
    alignContent: "start",
    padding: 22,
    borderRadius: 26,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    minWidth: 0,
    boxSizing: "border-box",
  },

  infoTitle: {
    margin: 0,
    fontSize: 28,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
  },

  infoList: {
    display: "grid",
    gap: 12,
    minWidth: 0,
  },

  infoItem: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    lineHeight: 1.5,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
};
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
        net_amount_cents
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14)
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
                  ? `Donation ${campaignType === "general" ? "" : `supporting ${campaignTitle}`} including a contribution towards platform/payment costs.`
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
