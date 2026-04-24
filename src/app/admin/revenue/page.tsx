import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type CurrencySummaryRow = {
  currency: string | null;
  payment_count: string | number;
  gross_amount_cents: string | number;
  platform_fee_cents: string | number;
  net_amount_cents: string | number;
  donor_fee_cents: string | number;
};

type TenantSummaryRow = {
  tenant_slug: string | null;
  currency: string | null;
  payment_count: string | number;
  gross_amount_cents: string | number;
  platform_fee_cents: string | number;
  net_amount_cents: string | number;
  donor_fee_cents: string | number;
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

function formatDate(value: string) {
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
      coalesce(sum(donor_fee_cents), 0)::int as donor_fee_cents
    from platform_payments
    where payment_status = 'paid'
    group by coalesce(currency, 'gbp')
    order by currency asc
    `
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
      coalesce(sum(donor_fee_cents), 0)::int as donor_fee_cents
    from platform_payments
    where payment_status = 'paid'
    group by tenant_slug, coalesce(currency, 'gbp')
    order by tenant_slug asc, currency asc
    `
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
      p.payment_status,
      p.customer_email,
      p.created_at,
      r.title as raffle_title
    from platform_payments p
    left join raffles r on r.id = p.raffle_id
    order by p.created_at desc
    limit 100
    `
  );

  const totalPayments = currencySummaries.reduce(
    (sum, row) => sum + Number(row.payment_count ?? 0),
    0
  );

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <Link href="/admin" style={styles.backLink}>
            ← Back to admin
          </Link>
          <h1 style={styles.title}>Revenue Dashboard</h1>
          <p style={styles.subtle}>
            Platform fee accounting from Stripe webhooks, grouped by currency.
          </p>
        </div>
      </div>

      <section style={styles.cards}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Total payments</div>
          <div style={styles.cardValue}>{totalPayments}</div>
        </div>

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
                    <div style={styles.miniLabel}>Net owed</div>
                    <div style={styles.miniValue}>
                      {money(row.net_amount_cents, currency)}
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
        <h2 style={styles.sectionTitle}>By tenant and currency</h2>

        {tenantSummaries.length ? (
          <div style={styles.tableWrap}>
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
                </tr>
              </thead>
              <tbody>
                {tenantSummaries.map((row) => {
                  const currency = row.currency || "gbp";

                  return (
                    <tr key={`${row.tenant_slug || "unknown"}-${currency}`}>
                      <td style={styles.td}>{row.tenant_slug || "—"}</td>
                      <td style={styles.td}>{currency.toUpperCase()}</td>
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
                        {money(row.net_amount_cents, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.empty}>No paid platform payments found yet.</div>
        )}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Latest payments</h2>

        {payments.length ? (
          <div style={styles.tableWrap}>
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
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const currency = payment.currency || "gbp";

                  return (
                    <tr key={payment.id}>
                      <td style={styles.td}>{formatDate(payment.created_at)}</td>
                      <td style={styles.td}>
                        {payment.raffle_title || payment.raffle_id}
                      </td>
                      <td style={styles.td}>{payment.tenant_slug || "—"}</td>
                      <td style={styles.td}>{payment.customer_email || "—"}</td>
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
                        {money(payment.net_amount_cents, currency)}
                      </td>
                      <td style={styles.td}>
                        {payment.donor_covered_fees ? "Yes" : "No"}
                      </td>
                      <td style={styles.td}>{payment.payment_status || "—"}</td>
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1200,
    margin: "40px auto",
    padding: "0 16px 48px",
    display: "grid",
    gap: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  backLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 600,
  },
  title: {
    margin: "12px 0 4px",
    fontSize: 34,
    lineHeight: 1.1,
    fontWeight: 900,
  },
  subtle: {
    margin: 0,
    color: "#64748b",
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
  },
  cardLabel: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 900,
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
    fontWeight: 900,
  },
  panel: {
    padding: 18,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 2px 10px rgba(15,23,42,0.05)",
  },
  sectionTitle: {
    margin: "0 0 14px",
    fontSize: 22,
    fontWeight: 900,
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
    padding: "10px 12px",
    borderBottom: "1px solid #e2e8f0",
    color: "#475569",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    whiteSpace: "nowrap",
  },
  empty: {
    padding: 16,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#64748b",
  },
};
