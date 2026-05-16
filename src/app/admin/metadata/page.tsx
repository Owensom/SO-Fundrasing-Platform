import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
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
  raffle_id: string;
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

  if (!session) {
    redirect("/admin/login");
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
    group by coalesce(currency, 'gbp')
    order by currency asc
    `,
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
    group by tenant_slug, coalesce(currency, 'gbp')
    order by tenant_slug asc, currency asc
    `,
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
    left join raffles r on r.id = p.raffle_id
    order by p.created_at desc
    limit 100
    `,
  );

  const totalPayments = currencySummaries.reduce(
    (sum, row) => sum + Number(row.payment_count ?? 0),
    0,
  );

  return (
    <main className="revenue-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroGlow} />

        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Finance operations</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            Revenue dashboard
          </h1>

          <p style={styles.subtitle}>
            Platform fee accounting, donor-covered fees, payout tracking and
            financial oversight across your fundraising platform.
          </p>

          <div className="heroStats" style={styles.heroStats}>
            <HeroStat label="Payments" value={totalPayments} />

            <HeroStat
              label="Currencies"
              value={currencySummaries.length}
            />

            <HeroStat
              label="Tenants"
              value={tenantSummaries.length}
            />

            <HeroStat
              label="Latest rows"
              value={payments.length}
            />
          </div>
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.heroPanelTitle}>Finance overview</div>

          <p style={styles.heroPanelText}>
            Review gross revenue, platform fees, donor-covered fees and payout
            obligations from one operational dashboard.
          </p>

          <div className="heroPanelGrid" style={styles.heroPanelGrid}>
            {currencySummaries.map((row) => {
              const currency = row.currency || "gbp";

              return (
                <MiniMetric
                  key={currency}
                  label={currency.toUpperCase()}
                  value={money(row.gross_amount_cents, currency)}
                />
              );
            })}
          </div>

          <div className="topActions" style={styles.topActions}>
            <Link
              href="/admin"
              className="secondaryButton"
              style={styles.secondaryButton}
            >
              ← Back to dashboard
            </Link>

            <Link
              href="/admin/orders"
              className="primaryButton"
              style={styles.primaryButton}
            >
              Orders dashboard →
            </Link>
          </div>
        </div>
      </section>

      <section className="summaryGrid" style={styles.summaryGrid}>
        <SummaryCard label="Total payments" value={totalPayments} />

        <SummaryCard
          label="Currencies"
          value={currencySummaries.length}
        />

        <SummaryCard
          label="Tenants"
          value={tenantSummaries.length}
        />

        <SummaryCard
          label="Latest payment rows"
          value={payments.length}
        />
      </section>
            <section className="cards" style={styles.cards}>
        {currencySummaries.length ? (
          currencySummaries.map((row) => {
            const currency = row.currency || "gbp";

            return (
              <div key={currency} style={styles.card}>
                <div style={styles.cardLabel}>
                  {currency.toUpperCase()} totals
                </div>

                <div style={styles.currencyGrid}>
                  <div>
                    <div style={styles.miniLabel}>Gross</div>

                    <div style={styles.miniValue}>
                      {money(row.gross_amount_cents, currency)}
                    </div>
                  </div>

                  <div>
                    <div style={styles.miniLabel}>Platform fees</div>

                    <div style={styles.miniValue}>
                      {money(row.platform_fee_cents, currency)}
                    </div>
                  </div>

                  <div>
                    <div style={styles.miniLabel}>Donor-covered fees</div>

                    <div style={styles.miniValue}>
                      {money(row.donor_fee_cents, currency)}
                    </div>
                  </div>

                  <div>
                    <div style={styles.miniLabel}>Pending payouts</div>

                    <div style={styles.pendingValue}>
                      {money(row.pending_net_amount_cents, currency)}
                    </div>
                  </div>

                  <div>
                    <div style={styles.miniLabel}>Paid out</div>

                    <div style={styles.paidValue}>
                      {money(row.paid_net_amount_cents, currency)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={styles.card}>
            <div style={styles.cardLabel}>No payments yet</div>

            <div style={styles.cardValue}>—</div>
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Tenant payouts</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Payouts by tenant and currency
            </h2>

            <p style={styles.sectionText}>
              Review pending payouts, donor-covered fees and completed payout
              activity by tenant.
            </p>
          </div>

          <span style={styles.countPill}>
            {tenantSummaries.length} payout groups
          </span>
        </div>

        {tenantSummaries.length ? (
          <div className="tableWrap" style={styles.tableWrap}>
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
                  const tenantSlug = row.tenant_slug || "";
                  const pendingAmount = Number(
                    row.pending_net_amount_cents ?? 0,
                  );
                  const pendingCount = Number(
                    row.pending_payment_count ?? 0,
                  );

                  return (
                    <tr key={`${tenantSlug || "unknown"}-${currency}`}>
                      <td style={styles.td}>{tenantSlug || "—"}</td>

                      <td style={styles.td}>
                        {currency.toUpperCase()}
                      </td>

                      <td style={styles.td}>
                        {Number(row.payment_count)}
                      </td>

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
                        {money(row.net_amount_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          {money(pendingAmount, currency)}
                        </strong>

                        <div style={styles.smallMuted}>
                          {pendingCount} payment
                          {pendingCount === 1 ? "" : "s"}
                        </div>
                      </td>

                      <td style={styles.td}>
                        {money(row.paid_net_amount_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        {tenantSlug ? (
                          <PayoutButton
                            tenantSlug={tenantSlug}
                            currency={currency}
                            disabled={pendingAmount <= 0}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.empty}>
            No paid platform payments found yet.
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.kicker}>Latest finance activity</p>

            <h2 className="so-brand-card-title" style={styles.sectionTitle}>
              Latest payments
            </h2>

            <p style={styles.sectionText}>
              Recent revenue activity, payout tracking and donor fee coverage.
            </p>
          </div>

          <span style={styles.countPill}>
            {payments.length} latest rows
          </span>
        </div>

        {payments.length ? (
          <div className="tableWrap" style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Raffle</th>
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
                  const payoutStatus =
                    payment.payout_status || "pending";

                  return (
                    <tr key={payment.id}>
                      <td style={styles.td}>
                        {formatDate(payment.created_at)}
                      </td>

                      <td style={styles.td}>
                        {payment.raffle_title || payment.raffle_id}
                      </td>

                      <td style={styles.td}>
                        {payment.tenant_slug || "—"}
                      </td>

                      <td style={styles.td}>
                        {payment.customer_email || "—"}
                      </td>

                      <td style={styles.td}>
                        {money(
                          payment.gross_amount_cents,
                          currency,
                        )}
                      </td>

                      <td style={styles.td}>
                        {money(
                          payment.platform_fee_cents,
                          currency,
                        )}
                      </td>

                      <td style={styles.td}>
                        {money(payment.donor_fee_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        {money(payment.net_amount_cents, currency)}
                      </td>

                      <td style={styles.td}>
                        {payment.donor_covered_fees
                          ? "Yes"
                          : "No"}
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
          <div style={styles.empty}>No payments yet.</div>
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
      <span>{label}</span>
      <strong>{value}</strong>
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
      <span>{label}</span>
      <strong>{value}</strong>
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
      <span>{label}</span>
      <strong>{value}</strong>
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

.revenue-page .tableWrap {
  overflow-x: auto;
}

@media (max-width: 980px) {
  .revenue-page .hero {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .heroStats,
  .revenue-page .summaryGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 620px) {
  .revenue-page {
    padding: 14px 10px 42px !important;
  }

  .revenue-page .hero {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .revenue-page .title {
    font-size: clamp(34px, 12vw, 48px) !important;
  }

  .revenue-page .heroStats,
  .revenue-page .summaryGrid,
  .revenue-page .heroPanelGrid {
    grid-template-columns: 1fr !important;
  }

  .revenue-page .panel,
  .revenue-page .card {
    padding: 14px !important;
    border-radius: 20px !important;
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
    display: "grid",
    gap: 18,
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
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
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
  },

  title: {
    margin: 0,
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
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
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
  },

  heroPanel: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 14,
    alignContent: "start",
    padding: 20,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    backdropFilter: "blur(12px)",
  },

  heroPanelTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroPanelText: {
    margin: 0,
    color: "#dbeafe",
    lineHeight: 1.55,
    fontWeight: 700,
  },

  heroPanelGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  miniMetric: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid rgba(217,119,6,0.34)",
    color: "#0f172a",
  },

  topActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
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

  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },

  card: {
    padding: 18,
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
  },

  cardLabel: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 8,
  },

  cardValue: {
    fontSize: 28,
    fontWeight: 950,
    color: "#111827",
  },

  currencyGrid: {
    display: "grid",
    gap: 10,
  },

  miniLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },

  miniValue: {
    color: "#111827",
    fontSize: 20,
    fontWeight: 950,
  },

  pendingValue: {
    color: "#c2410c",
    fontSize: 20,
    fontWeight: 950,
  },

  paidValue: {
    color: "#166534",
    fontSize: 20,
    fontWeight: 950,
  },

  panel: {
    padding: 20,
    borderRadius: 28,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
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
    fontSize: 28,
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
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },

  th: {
    textAlign: "left",
    padding: "12px 12px",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    whiteSpace: "nowrap",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  td: {
    padding: "12px 12px",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
    verticalAlign: "top",
  },

  smallMuted: {
    marginTop: 3,
    color: "#64748b",
    fontSize: 12,
  },

  badge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
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

  empty: {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#64748b",
  },
};
