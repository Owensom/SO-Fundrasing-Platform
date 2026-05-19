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
  stripe_checkout_session_id: string;
  raffle_id: string | null;
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
  payment_status: string | null;
  customer_email: string | null;
  created_at: string;
  raffle_title: string | null;
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
        p.raffle_id,
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
        p.payment_status,
        p.customer_email,
        p.created_at,
        r.title as raffle_title
      from platform_payments p
      left join raffles r
        on r.id = p.raffle_id
       and r.tenant_slug = p.tenant_slug
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

  const totalPendingPayoutCents = currencySummaries.reduce(
    (sum, row) => sum + Number(row.pending_net_amount_cents ?? 0),
    0,
  );

  const primaryCurrency = currencySummaries[0]?.currency || "gbp";

  return (
    <main className="revenue-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="revenue-hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Finance operations</div>

          <h1 className="so-brand-heading revenue-title" style={styles.title}>
            Revenue dashboard
          </h1>

          <p style={styles.subtitle}>
            Platform fee accounting, donor-covered fees, payout tracking and
            financial oversight for this tenant.
          </p>

          <div className="revenue-hero-stats" style={styles.heroStats}>
            <HeroStat label="Payments" value={totalPayments} />
            <HeroStat label="Currencies" value={currencySummaries.length} />
            <HeroStat label="Tenant rows" value={tenantSummaries.length} />
            <HeroStat label="Latest rows" value={payments.length} />
          </div>
        </div>

        <aside className="revenue-hero-panel" style={styles.heroPanel}>
          <div style={styles.heroPanelTitle}>Finance overview</div>

          <p style={styles.heroPanelText}>
            Review gross revenue, platform fees, donor-covered fees and payout
            obligations for the current tenant only.
          </p>

          <div className="revenue-hero-panel-grid" style={styles.heroPanelGrid}>
            <MiniMetric
              label="Gross"
              value={money(totalGrossCents, primaryCurrency)}
            />

            <MiniMetric
              label="Platform fees"
              value={money(totalPlatformFeeCents, primaryCurrency)}
            />

            <MiniMetric
              label="Pending payouts"
              value={money(totalPendingPayoutCents, primaryCurrency)}
            />
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
              className="revenue-primary-button"
              style={styles.primaryButton}
            >
              Orders →
            </Link>
          </div>
        </aside>
      </section>

      <section className="revenue-summary-grid" style={styles.summaryGrid}>
        <SummaryCard label="Total payments" value={totalPayments} />
        <SummaryCard label="Currencies" value={currencySummaries.length} />
        <SummaryCard label="Tenant" value={tenantSlug} />
        <SummaryCard label="Latest payment rows" value={payments.length} />
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
                    label="Platform fees"
                    value={money(row.platform_fee_cents, currency)}
                  />

                  <MetricBlock
                    label="Donor-covered fees"
                    value={money(row.donor_fee_cents, currency)}
                  />

                  <MetricBlock
                    label="Pending payouts"
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
              Track platform fees, donor contributions, pending payouts and
              completed payout batches for the verified current tenant.
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
              Review recent checkout activity, donor fee coverage and payout
              tracking for this tenant.
            </p>
          </div>

          <div style={styles.countPill}>{payments.length} rows</div>
        </div>

        {payments.length ? (
          <div
            className="revenue-table-wrap revenue-latest-table-wrap"
            style={styles.tableWrap}
          >
            <table style={styles.latestTable}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Campaign</th>
                  <th style={styles.th}>Tenant</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Gross</th>
                  <th style={styles.th}>Fee</th>
                  <th style={styles.th}>Donor fee</th>
                  <th style={styles.th}>Net</th>
                  <th style={styles.th}>Covered?</th>
                  <th style={styles.th}>Payout</th>
                  <th style={styles.th}>Reference</th>
                  <th style={styles.th}>Paid at</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => {
                  const currency = payment.currency || "gbp";
                  const payoutStatus = payment.payout_status || "pending";

                  return (
                    <tr key={payment.id}>
                      <td style={styles.td}>{formatDate(payment.created_at)}</td>

                      <td style={styles.td}>
                        <strong style={styles.primaryText}>
                          {payment.raffle_title ||
                            payment.raffle_id ||
                            "Payment"}
                        </strong>
                      </td>

                      <td style={styles.td}>{payment.tenant_slug || "—"}</td>

                      <td style={styles.td}>
                        {payment.customer_email || "—"}
                      </td>

                      <td style={styles.td}>
                        {money(payment.gross_amount_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        {money(payment.platform_fee_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        {money(payment.donor_fee_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        <strong style={styles.primaryText}>
                          {money(payment.net_amount_cents, currency)}
                        </strong>
                      </td>

                      <td style={styles.td}>
                        {payment.donor_covered_fees ? "Yes" : "No"}
                      </td>

                      <td style={styles.td}>
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
                      </td>

                      <td style={styles.td}>
                        {payment.payout_reference || "—"}
                      </td>

                      <td style={styles.td}>
                        {formatDate(payment.paid_out_at)}
                      </td>

                      <td style={styles.td}>
                        {payment.payment_status || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
  tone?: "default" | "green" | "orange";
}) {
  const valueStyle =
    tone === "green"
      ? styles.greenText
      : tone === "orange"
        ? styles.pendingText
        : styles.metricValue;

  return (
    <div style={styles.metricBlock}>
      <div style={styles.metricLabel}>{label}</div>

      <div style={valueStyle}>{value}</div>
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

.revenue-page .revenue-latest-table-wrap {
  border-radius: 20px;
}

@media (max-width: 1180px) {
  .revenue-page .revenue-hero {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-summary-grid {
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
  .revenue-page .revenue-hero-panel-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
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
  .revenue-page .revenue-hero-panel-grid {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .revenue-top-actions {
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
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
    gap: 24,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(37,99,235,0.20), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
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
    minWidth: 0,
  },

  eyebrow: {
    display: "inline-flex",
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
    marginBottom: 16,
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
  },

  title: {
    margin: 0,
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 24,
  },

  heroStat: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 20,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  heroStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 850,
  },

  heroStatValue: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  heroPanel: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 18,
    alignContent: "start",
    padding: 22,
    borderRadius: 28,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
    minWidth: 0,
  },

  heroPanelTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.6,
    fontWeight: 700,
  },

  heroPanelGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },

  miniMetric: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid rgba(217,119,6,0.20)",
  },

  miniMetricLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },

  miniMetricValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  topActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
    border: "1px solid #1683f8",
    boxShadow: "0 14px 28px rgba(22,131,248,0.28)",
    whiteSpace: "nowrap",
    textAlign: "center",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    border: "1px solid rgba(148,163,184,0.52)",
    backdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
    textAlign: "center",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  summaryCard: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  currencyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 16,
    marginBottom: 18,
  },

  currencyCard: {
    display: "grid",
    gap: 18,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  currencyHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  currencyKicker: {
    margin: "0 0 7px",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  currencyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.05em",
  },

  currencyBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
  },

  currencyMetrics: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  metricBlock: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  metricLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },

  metricValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  greenText: {
    color: "#166534",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  pendingText: {
    color: "#c2410c",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  panel: {
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    marginBottom: 18,
    minWidth: 0,
    overflow: "hidden",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  kicker: {
    margin: "0 0 7px",
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
    letterSpacing: "-0.05em",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 760,
    fontWeight: 700,
  },

  countPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
  },

  tableWrap: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    overflowY: "visible",
    WebkitOverflowScrolling: "touch",
    paddingBottom: 8,
  },

  table: {
    width: "max-content",
    minWidth: 1120,
    borderCollapse: "separate",
    borderSpacing: "0 10px",
  },

  latestTable: {
    width: "max-content",
    minWidth: 1720,
    borderCollapse: "separate",
    borderSpacing: "0 10px",
  },

  th: {
    padding: "8px 10px",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 10px",
    background: "#f8fafc",
    borderTop: "1px solid #e2e8f0",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },

  currencyPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
  },

  primaryText: {
    color: "#0f172a",
    fontWeight: 950,
  },

  secondaryText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    textTransform: "capitalize",
  },

  badgePending: {
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fed7aa",
  },

  badgePaid: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #a7f3d0",
  },

  emptyCard: {
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  emptyTitle: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 950,
    marginBottom: 10,
  },

  emptyText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 700,
  },

  emptyState: {
    padding: 18,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 850,
    textAlign: "center",
  },
};
