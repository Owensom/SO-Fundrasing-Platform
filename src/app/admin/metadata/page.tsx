import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import PayoutButton from "./PayoutButton";

export const dynamic = "force-dynamic";

type CurrencySummaryRow = {
  currency: string | null;
  payment_count: string | number;
  gross_amount_cents: string | number;
  platform_fee_cents: string | number;
  net_amount_cents: string | number;
  donor_fee_cents: string | number;
  pending_net_amount_cents: string | number;
  paid_net_amount_cents: string | number;
};

type TenantSummaryRow = {
  tenant_slug: string | null;
  currency: string | null;
  payment_count: string | number;
  gross_amount_cents: string | number;
  platform_fee_cents: string | number;
  net_amount_cents: string | number;
  donor_fee_cents: string | number;
  pending_net_amount_cents: string | number;
  paid_net_amount_cents: string | number;
  pending_payment_count: string | number;
};

type PaymentRow = {
  id: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  raffle_id: string | null;
  squares_game_id: string | null;
  reservation_token: string | null;
  tenant_slug: string | null;
  currency: string | null;
  gross_amount_cents: number;
  platform_fee_cents: number;
  net_amount_cents: number;
  donor_fee_cents: number;
  donor_covered_fees: boolean;
  payout_status: string | null;
  payout_reference: string | null;
  paid_out_at: string | null;
  payout_reconciled_at: string | null;
  payment_status: string | null;
  payment_type: string | null;
  customer_email: string | null;
  created_at: string;
  campaign_title: string | null;
};

function money(cents: number | string | null | undefined, currency = "GBP") {
  const amount = Number(cents ?? 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-GB");
}

function shortReference(value?: string | null) {
  const clean = String(value || "").trim();

  if (!clean) return "—";
  if (clean.length <= 24) return clean;

  return `${clean.slice(0, 12)}…${clean.slice(-8)}`;
}

function paymentReference(payment: PaymentRow) {
  return (
    payment.payout_reference ||
    payment.reservation_token ||
    payment.stripe_checkout_session_id ||
    payment.stripe_payment_intent_id ||
    payment.id ||
    ""
  );
}

function paymentPaidAt(payment: PaymentRow) {
  return (
    payment.payout_reconciled_at ||
    payment.paid_out_at ||
    payment.created_at ||
    null
  );
}

function paymentCampaignName(payment: PaymentRow) {
  if (payment.campaign_title) return payment.campaign_title;

  if (payment.payment_type === "raffle" && payment.raffle_id) {
    return payment.raffle_id;
  }

  if (payment.payment_type === "squares" && payment.squares_game_id) {
    return payment.squares_game_id;
  }

  if (payment.payment_type === "donation") {
    return "Donation";
  }

  return "Payment";
}

function paymentTypeLabel(value?: string | null) {
  const clean = String(value || "payment").trim().toLowerCase();

  if (clean === "raffle") return "Raffle";
  if (clean === "squares") return "Squares";
  if (clean === "event") return "Event";
  if (clean === "auction") return "Auction";
  if (clean === "donation") return "Donation";

  return "Payment";
}

export default async function AdminRevenuePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const currencySummaries = await query<CurrencySummaryRow>(
    `
      select
        coalesce(currency, 'gbp') as currency,
        count(*)::int as payment_count,
        coalesce(sum(gross_amount_cents), 0)::int as gross_amount_cents,
        coalesce(sum(platform_fee_cents), 0)::int as platform_fee_cents,
        coalesce(sum(net_amount_cents), 0)::int as net_amount_cents,
        coalesce(sum(donor_fee_cents), 0)::int as donor_fee_cents,
        coalesce(sum(case when payout_status = 'pending' then net_amount_cents else 0 end), 0)::int as pending_net_amount_cents,
        coalesce(sum(case when payout_status = 'paid' then net_amount_cents else 0 end), 0)::int as paid_net_amount_cents
      from platform_payments
      where payment_status = 'paid'
        and tenant_slug = $1
      group by coalesce(currency, 'gbp')
      order by currency asc
    `,
    [tenantSlug],
  );

  const tenantSummaries = await query<TenantSummaryRow>(
    `
      select
        tenant_slug,
        coalesce(currency, 'gbp') as currency,
        count(*)::int as payment_count,
        coalesce(sum(gross_amount_cents), 0)::int as gross_amount_cents,
        coalesce(sum(platform_fee_cents), 0)::int as platform_fee_cents,
        coalesce(sum(net_amount_cents), 0)::int as net_amount_cents,
        coalesce(sum(donor_fee_cents), 0)::int as donor_fee_cents,
        coalesce(sum(case when payout_status = 'pending' then net_amount_cents else 0 end), 0)::int as pending_net_amount_cents,
        coalesce(sum(case when payout_status = 'paid' then net_amount_cents else 0 end), 0)::int as paid_net_amount_cents,
        coalesce(sum(case when payout_status = 'pending' then 1 else 0 end), 0)::int as pending_payment_count
      from platform_payments
      where payment_status = 'paid'
        and tenant_slug = $1
      group by tenant_slug, coalesce(currency, 'gbp')
      order by tenant_slug asc, currency asc
    `,
    [tenantSlug],
  );
    const payments = await query<PaymentRow>(
    `
      select
        p.id::text,
        p.stripe_checkout_session_id,
        p.stripe_payment_intent_id,
        p.raffle_id,
        p.squares_game_id,
        p.reservation_token,
        p.tenant_slug,
        p.currency,
        p.gross_amount_cents,
        p.platform_fee_cents,
        p.net_amount_cents,
        coalesce(p.donor_fee_cents, 0)::int as donor_fee_cents,
        coalesce(p.donor_covered_fees, false)::boolean as donor_covered_fees,
        coalesce(p.payout_status, 'pending') as payout_status,
        p.payout_reference,
        p.paid_out_at,
        p.payout_reconciled_at,
        p.payment_status,
        p.payment_type,
        p.customer_email,
        p.created_at,
        coalesce(r.title, sg.title, e.title) as campaign_title
      from platform_payments p
      left join raffles r
        on r.id::text = p.raffle_id::text
       and r.tenant_slug = p.tenant_slug
      left join squares_games sg
        on sg.id::text = p.squares_game_id::text
       and sg.tenant_slug = p.tenant_slug
      left join event_orders eo
        on eo.id::text = p.reservation_token::text
       and eo.tenant_slug = p.tenant_slug
      left join events e
        on e.id = eo.event_id
       and e.tenant_slug = eo.tenant_slug
      where p.tenant_slug = $1
      order by p.created_at desc
      limit 100
    `,
    [tenantSlug],
  );

  const totalPayments = currencySummaries.reduce(
    (sum, row) => sum + Number(row.payment_count ?? 0),
    0,
  );

  const totalGrossCents = currencySummaries.reduce(
    (sum, row) => sum + Number(row.gross_amount_cents ?? 0),
    0,
  );

  const totalPlatformFeeCents = currencySummaries.reduce(
    (sum, row) => sum + Number(row.platform_fee_cents ?? 0),
    0,
  );

  const totalDonorFeeCents = currencySummaries.reduce(
    (sum, row) => sum + Number(row.donor_fee_cents ?? 0),
    0,
  );

  const totalNetCents = currencySummaries.reduce(
    (sum, row) => sum + Number(row.net_amount_cents ?? 0),
    0,
  );

  const totalPendingPayoutCents = currencySummaries.reduce(
    (sum, row) => sum + Number(row.pending_net_amount_cents ?? 0),
    0,
  );

  const totalPaidOutCents = currencySummaries.reduce(
    (sum, row) => sum + Number(row.paid_net_amount_cents ?? 0),
    0,
  );

  const totalPendingPaymentCount = tenantSummaries.reduce(
    (sum, row) => sum + Number(row.pending_payment_count ?? 0),
    0,
  );

  const donorCoveredCount = payments.filter(
    (payment) => payment.donor_covered_fees,
  ).length;

  const primaryCurrency = currencySummaries[0]?.currency || "gbp";

  return (
    <main className="revenue-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="revenue-hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div className="revenue-hero-main" style={styles.heroMain}>
          <div style={styles.heroContent}>
            <div style={styles.eyebrow}>Finance operations</div>

            <h1 className="so-brand-heading revenue-title" style={styles.title}>
              Revenue dashboard
            </h1>

            <p style={styles.subtitle}>
              Gross revenue, platform fee accounting, donor-covered fees, net
              owed and manual payout tracking for this tenant.
            </p>

            <div className="revenue-hero-stats" style={styles.heroStats}>
              <HeroStat label="Paid payments" value={totalPayments} />

              <HeroStat
                label="Gross"
                value={money(totalGrossCents, primaryCurrency)}
              />

              <HeroStat
                label="Net owed"
                value={money(totalNetCents, primaryCurrency)}
              />

              <HeroStat label="Tenant" value={tenantSlug} />
            </div>
          </div>

          <aside className="revenue-hero-panel" style={styles.heroPanel}>
            <div style={styles.heroPanelTitle}>Finance overview</div>

            <p style={styles.heroPanelText}>
              Review the tenant’s paid platform payments and manually mark
              payout batches as paid once reconciled.
            </p>

            <div
              className="revenue-hero-panel-grid"
              style={styles.heroPanelGrid}
            >
              <MiniMetric
                label="Platform fee"
                value={money(totalPlatformFeeCents, primaryCurrency)}
              />

              <MiniMetric
                label="Donor-covered fees"
                value={money(totalDonorFeeCents, primaryCurrency)}
              />

              <MiniMetric
                label="Pending payouts"
                value={money(totalPendingPayoutCents, primaryCurrency)}
              />

              <MiniMetric
                label="Paid out"
                value={money(totalPaidOutCents, primaryCurrency)}
              />
            </div>
          </aside>
        </div>

        <div className="revenue-top-actions" style={styles.topActions}>
          <Link
            href="/admin"
            className="revenue-secondary-button"
            style={styles.secondaryButton}
          >
            ← Back to dashboard
          </Link>

          <Link
            href="/admin/orders"
            className="revenue-secondary-button"
            style={styles.secondaryButton}
          >
            Orders dashboard
          </Link>

          <Link
            href="/admin/customers"
            className="revenue-secondary-button"
            style={styles.secondaryButton}
          >
            Customers dashboard
          </Link>

          <Link
            href="/admin/donations"
            className="revenue-primary-button"
            style={styles.primaryButton}
          >
            Donations report
          </Link>
        </div>
      </section>

      <section className="revenue-summary-grid" style={styles.summaryGrid}>
        <SummaryCard label="Total payments" value={totalPayments} />
        <SummaryCard label="Pending payouts" value={totalPendingPaymentCount} />
        <SummaryCard label="Currencies" value={currencySummaries.length} />
        <SummaryCard label="Latest rows" value={payments.length} />
        <SummaryCard
          label="Platform fees"
          value={money(totalPlatformFeeCents, primaryCurrency)}
        />
        <SummaryCard
          label="Donor-covered"
          value={money(totalDonorFeeCents, primaryCurrency)}
        />
        <SummaryCard
          label="Pending net"
          value={money(totalPendingPayoutCents, primaryCurrency)}
        />
        <SummaryCard
          label="Paid out"
          value={money(totalPaidOutCents, primaryCurrency)}
        />
      </section>
            <section className="revenue-currency-grid" style={styles.currencyGrid}>
        {currencySummaries.length ? (
          currencySummaries.map((row) => {
            const currency = row.currency || "gbp";

            return (
              <article
                key={currency}
                className="revenue-currency-card"
                style={styles.currencyCard}
              >
                <div style={styles.currencyHeader}>
                  <div>
                    <p style={styles.currencyKicker}>
                      {currency.toUpperCase()} totals
                    </p>

                    <h2
                      className="so-brand-card-title"
                      style={styles.currencyTitle}
                    >
                      Finance snapshot
                    </h2>
                  </div>

                  <div style={styles.currencyBadge}>
                    {Number(row.payment_count)} payments
                  </div>
                </div>

                <div style={styles.currencyMetrics}>
                  <MetricBlock
                    label="Gross"
                    value={money(row.gross_amount_cents, currency)}
                  />

                  <MetricBlock
                    label="Platform fee"
                    value={money(row.platform_fee_cents, currency)}
                  />

                  <MetricBlock
                    label="Donor-covered fees"
                    value={money(row.donor_fee_cents, currency)}
                  />

                  <MetricBlock
                    label="Net owed"
                    value={money(row.net_amount_cents, currency)}
                    tone="blue"
                  />

                  <MetricBlock
                    label="Pending payout"
                    value={money(row.pending_net_amount_cents, currency)}
                    tone="orange"
                  />

                  <MetricBlock
                    label="Paid out"
                    value={money(row.paid_net_amount_cents, currency)}
                    tone="green"
                  />
                </div>
              </article>
            );
          })
        ) : (
          <div style={styles.emptyCard}>
            <div style={styles.emptyTitle}>No payments yet</div>

            <p style={styles.emptyText}>
              Revenue activity will appear here once successful payments are
              processed through the platform.
            </p>
          </div>
        )}
      </section>

      <section className="revenue-panel" style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Tenant payout</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Payouts for this tenant
            </h2>

            <p style={styles.sectionText}>
              Track platform fees, donor-covered fee contributions, pending
              tenant payouts and completed payout batches for the verified
              current tenant.
            </p>
          </div>

          <div style={styles.countPill}>
            {tenantSummaries.length} currency row
            {tenantSummaries.length === 1 ? "" : "s"}
          </div>
        </div>

        {tenantSummaries.length ? (
          <div className="revenue-table-wrap" style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tenant</th>
                  <th style={styles.th}>Currency</th>
                  <th style={styles.th}>Payments</th>
                  <th style={styles.th}>Gross</th>
                  <th style={styles.th}>Platform fee</th>
                  <th style={styles.th}>Donor fees</th>
                  <th style={styles.th}>Net owed</th>
                  <th style={styles.th}>Pending</th>
                  <th style={styles.th}>Paid out</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {tenantSummaries.map((row) => {
                  const currency = row.currency || "gbp";
                  const rowTenantSlug = row.tenant_slug || tenantSlug;
                  const pendingAmount = Number(
                    row.pending_net_amount_cents ?? 0,
                  );
                  const pendingCount = Number(row.pending_payment_count ?? 0);

                  return (
                    <tr key={`${rowTenantSlug}-${currency}`}>
                      <td style={styles.td}>
                        <strong style={styles.primaryText}>
                          {rowTenantSlug}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.currencyPill}>
                          {currency.toUpperCase()}
                        </span>
                      </td>

                      <td style={styles.td}>{Number(row.payment_count)}</td>

                      <td style={styles.td}>
                        {money(row.gross_amount_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        {money(row.platform_fee_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        {money(row.donor_fee_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        <strong style={styles.primaryText}>
                          {money(row.net_amount_cents, currency)}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <strong style={styles.pendingText}>
                          {money(pendingAmount, currency)}
                        </strong>

                        <div style={styles.secondaryText}>
                          {pendingCount} payment
                          {pendingCount === 1 ? "" : "s"}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <strong style={styles.greenText}>
                          {money(row.paid_net_amount_cents, currency)}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        <PayoutButton
                          tenantSlug={tenantSlug}
                          currency={currency}
                          disabled={pendingAmount <= 0}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.emptyState}>
            No paid platform payments found yet.
          </div>
        )}
      </section>

      <section className="revenue-panel" style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Latest activity</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Latest payments
            </h2>

            <p style={styles.sectionText}>
              Review recent checkout activity, donor fee coverage, gross value,
              platform fee, net owed and payout tracking for this tenant.
            </p>
          </div>

          <div style={styles.countPill}>{payments.length} rows</div>
        </div>

        {payments.length ? (
          <div className="revenue-payment-list" style={styles.paymentList}>
            {payments.map((payment) => {
              const currency = payment.currency || "gbp";
              const payoutStatus = payment.payout_status || "pending";
              const campaignName = paymentCampaignName(payment);
              const reference = paymentReference(payment);
              const paidAt = paymentPaidAt(payment);

              return (
                <article key={payment.id} style={styles.paymentCard}>
                  <div
                    className="revenue-payment-card-top"
                    style={styles.paymentCardTop}
                  >
                    <div style={styles.paymentTitleBlock}>
                      <div style={styles.paymentDate}>
                        {formatDate(payment.created_at)}
                      </div>

                      <div style={styles.paymentTypePill}>
                        {paymentTypeLabel(payment.payment_type)}
                      </div>

                      <h3 style={styles.paymentTitle}>{campaignName}</h3>

                      <div style={styles.paymentCustomer}>
                        {payment.customer_email || "No customer email"}
                      </div>
                    </div>

                    <div
                      className="revenue-payment-net-block"
                      style={styles.paymentNetBlock}
                    >
                      <span style={styles.paymentLabel}>Net owed</span>

                      <strong style={styles.paymentNet}>
                        {money(payment.net_amount_cents, currency)}
                      </strong>
                    </div>
                  </div>

                  <div
                    className="revenue-payment-metrics-grid"
                    style={styles.paymentMetricsGrid}
                  >
                    <PaymentMini
                      label="Tenant"
                      value={payment.tenant_slug || "—"}
                    />

                    <PaymentMini
                      label="Gross"
                      value={money(payment.gross_amount_cents, currency)}
                    />

                    <PaymentMini
                      label="Platform fee"
                      value={money(payment.platform_fee_cents, currency)}
                    />

                    <PaymentMini
                      label="Donor fee"
                      value={money(payment.donor_fee_cents, currency)}
                    />

                    <PaymentMini
                      label="Covered?"
                      value={payment.donor_covered_fees ? "Yes" : "No"}
                    />

                    <PaymentMini
                      label="Payout"
                      value={
                        <span
                          style={{
                            ...styles.badge,
                            ...(payoutStatus === "paid"
                              ? styles.badgePaid
                              : styles.badgePending),
                          }}
                        >
                          {payoutStatus}
                        </span>
                      }
                    />

                    <PaymentMini
                      label="Reference"
                      value={
                        <span title={reference || undefined}>
                          {shortReference(reference)}
                        </span>
                      }
                    />

                    <PaymentMini label="Paid at" value={formatDate(paidAt)} />

                    <PaymentMini
                      label="Status"
                      value={payment.payment_status || "—"}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div style={styles.emptyState}>No payments yet.</div>
        )}
      </section>
    </main>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.heroStat}>
      <span style={styles.heroStatLabel}>{label}</span>

      <strong style={styles.heroStatValue}>{value}</strong>
    </div>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.miniMetric}>
      <span style={styles.miniMetricLabel}>{label}</span>

      <strong style={styles.miniMetricValue}>{value}</strong>
    </div>
  );
}
function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>

      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "blue" | "green" | "orange";
}) {
  const valueStyle =
    tone === "green"
      ? styles.greenText
      : tone === "orange"
        ? styles.pendingText
        : tone === "blue"
          ? styles.blueText
          : styles.metricValue;

  return (
    <div style={styles.metricBlock}>
      <div style={styles.metricLabel}>{label}</div>

      <div style={valueStyle}>{value}</div>
    </div>
  );
}

function PaymentMini({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.paymentMini}>
      <div style={styles.paymentMiniLabel}>{label}</div>

      <div style={styles.paymentMiniValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
.revenue-page,
.revenue-page * {
  box-sizing: border-box;
}

.revenue-page {
  overflow-x: hidden;
}

.revenue-page section,
.revenue-page article,
.revenue-page div {
  min-width: 0;
}

.revenue-page .revenue-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto !important;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  padding-bottom: 8px;
}

.revenue-page .revenue-table-wrap table {
  width: max-content !important;
}

@media (max-width: 1180px) {
  .revenue-page .revenue-hero-main {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }

  .revenue-page .revenue-top-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 900px) {
  .revenue-page {
    padding: 18px 12px 48px !important;
  }

  .revenue-page .revenue-hero {
    padding: 22px !important;
    border-radius: 28px !important;
  }

  .revenue-page .revenue-title {
    font-size: clamp(38px, 11vw, 56px) !important;
    line-height: 0.98 !important;
  }

  .revenue-page .revenue-hero-stats,
  .revenue-page .revenue-summary-grid,
  .revenue-page .revenue-hero-panel-grid,
  .revenue-page .revenue-payment-metrics-grid,
  .revenue-page .currencyMetrics {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .revenue-page .revenue-payment-card-top {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-payment-net-block {
    align-items: flex-start !important;
    text-align: left !important;
  }
}

@media (max-width: 620px) {
  .revenue-page {
    padding: 14px 10px 42px !important;
  }

  .revenue-page .revenue-hero,
  .revenue-page .revenue-panel,
  .revenue-page .revenue-currency-card {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .revenue-page .revenue-title {
    font-size: clamp(34px, 12vw, 46px) !important;
  }

  .revenue-page .revenue-hero-stats,
  .revenue-page .revenue-summary-grid,
  .revenue-page .revenue-hero-panel-grid,
  .revenue-page .revenue-payment-metrics-grid,
  .revenue-page .revenue-top-actions,
  .revenue-page .currencyMetrics {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-primary-button,
  .revenue-page .revenue-secondary-button {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gap: 18,
    padding: 28,
    borderRadius: 30,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroMain: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(300px, 0.82fr)",
    gap: 22,
    alignItems: "stretch",
    minWidth: 0,
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.07), transparent 28%)",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    alignContent: "start",
    minWidth: 0,
  },

  eyebrow: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(44px, 7vw, 68px)",
    lineHeight: 0.95,
    letterSpacing: "-0.07em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "14px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 22,
  },

  heroStat: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 16,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(148,163,184,0.25)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },

  heroStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 850,
  },

  heroStatValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  heroPanel: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 13,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    minWidth: 0,
  },

  heroPanelTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },

  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.45,
    fontWeight: 700,
  },
  function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>

      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "blue" | "green" | "orange";
}) {
  const valueStyle =
    tone === "green"
      ? styles.greenText
      : tone === "orange"
        ? styles.pendingText
        : tone === "blue"
          ? styles.blueText
          : styles.metricValue;

  return (
    <div style={styles.metricBlock}>
      <div style={styles.metricLabel}>{label}</div>

      <div style={valueStyle}>{value}</div>
    </div>
  );
}

function PaymentMini({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.paymentMini}>
      <div style={styles.paymentMiniLabel}>{label}</div>

      <div style={styles.paymentMiniValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
.revenue-page,
.revenue-page * {
  box-sizing: border-box;
}

.revenue-page {
  overflow-x: hidden;
}

.revenue-page section,
.revenue-page article,
.revenue-page div {
  min-width: 0;
}

.revenue-page .revenue-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow-x: auto !important;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  padding-bottom: 8px;
}

.revenue-page .revenue-table-wrap table {
  width: max-content !important;
}

@media (max-width: 1180px) {
  .revenue-page .revenue-hero-main {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
  }

  .revenue-page .revenue-top-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 900px) {
  .revenue-page {
    padding: 18px 12px 48px !important;
  }

  .revenue-page .revenue-hero {
    padding: 22px !important;
    border-radius: 28px !important;
  }

  .revenue-page .revenue-title {
    font-size: clamp(38px, 11vw, 56px) !important;
    line-height: 0.98 !important;
  }

  .revenue-page .revenue-hero-stats,
  .revenue-page .revenue-summary-grid,
  .revenue-page .revenue-hero-panel-grid,
  .revenue-page .revenue-payment-metrics-grid,
  .revenue-page .currencyMetrics {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .revenue-page .revenue-payment-card-top {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-payment-net-block {
    align-items: flex-start !important;
    text-align: left !important;
  }
}

@media (max-width: 620px) {
  .revenue-page {
    padding: 14px 10px 42px !important;
  }

  .revenue-page .revenue-hero,
  .revenue-page .revenue-panel,
  .revenue-page .revenue-currency-card {
    padding: 16px !important;
    border-radius: 22px !important;
  }

  .revenue-page .revenue-title {
    font-size: clamp(34px, 12vw, 46px) !important;
  }

  .revenue-page .revenue-hero-stats,
  .revenue-page .revenue-summary-grid,
  .revenue-page .revenue-hero-panel-grid,
  .revenue-page .revenue-payment-metrics-grid,
  .revenue-page .revenue-top-actions,
  .revenue-page .currencyMetrics {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-primary-button,
  .revenue-page .revenue-secondary-button {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1320,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(15,23,42,0.05), transparent 34%), #f8fafc",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gap: 18,
    padding: 28,
    borderRadius: 30,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 24px 60px rgba(15,23,42,0.20)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroMain: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.18fr) minmax(300px, 0.82fr)",
    gap: 22,
    alignItems: "stretch",
    minWidth: 0,
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.07), transparent 28%)",
  },

  heroContent: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    alignContent: "start",
    minWidth: 0,
  },

  eyebrow: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 12,
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(44px, 7vw, 68px)",
    lineHeight: 0.95,
    letterSpacing: "-0.07em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "14px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.5,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    marginTop: 22,
  },

  heroStat: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 16,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(148,163,184,0.25)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },

  heroStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 850,
  },

  heroStatValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  heroPanel: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 13,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    minWidth: 0,
  },

  heroPanelTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.035em",
  },

  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.45,
    fontWeight: 700,
  },
