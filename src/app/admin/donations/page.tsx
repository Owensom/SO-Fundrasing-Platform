import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DonationRow = {
  id: string;
  tenant_slug: string;
  campaign_type: string | null;
  campaign_id: string | null;
  campaign_title: string | null;
  donor_name: string | null;
  donor_email: string | null;
  message: string | null;
  amount_cents: number | string | null;
  currency: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string | null;
  paid_at: string | null;
  donor_covered_fees: boolean | null;
  donor_fee_cents: number | string | null;
  gross_amount_cents: number | string | null;
  platform_fee_cents: number | string | null;
  net_amount_cents: number | string | null;
  gift_aid_claimed: boolean | null;
  gift_aid_first_name: string | null;
  gift_aid_last_name: string | null;
  gift_aid_address_line_1: string | null;
  gift_aid_address_line_2: string | null;
  gift_aid_town_or_city: string | null;
  gift_aid_postcode: string | null;
  gift_aid_declaration_text: string | null;
  gift_aid_declaration_accepted_at: string | null;
};

type DonationSummary = {
  total_count: string | number;
  paid_count: string | number;
  pending_count: string | number;
  checkout_started_count: string | number;
  gift_aid_count: string | number;
  amount_cents: string | number | null;
  gross_amount_cents: string | number | null;
  donor_fee_cents: string | number | null;
  platform_fee_cents: string | number | null;
  net_amount_cents: string | number | null;
};

function toNumber(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return number;
}

function formatMoney(value: unknown, currency = "GBP") {
  const cents = toNumber(value);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(cents / 100);
  } catch {
    return `£${(cents / 100).toFixed(2)}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function cleanText(value: unknown, fallback = "—") {
  const clean = String(value ?? "").trim();

  return clean || fallback;
}

function campaignTypeLabel(value?: string | null) {
  const clean = cleanText(value, "general").toLowerCase();

  if (clean === "raffle") return "Raffle";
  if (clean === "squares") return "Squares";
  if (clean === "event") return "Event";
  if (clean === "auction") return "Auction";
  if (clean === "general") return "General";

  return clean
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusLabel(value?: string | null) {
  const clean = cleanText(value, "pending").toLowerCase();

  if (clean === "paid") return "Paid";
  if (clean === "checkout_started") return "Checkout started";
  if (clean === "pending") return "Pending";
  if (clean === "failed") return "Failed";
  if (clean === "cancelled") return "Cancelled";

  return clean
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusStyle(value?: string | null): CSSProperties {
  const clean = cleanText(value, "pending").toLowerCase();

  if (clean === "paid") {
    return {
      ...styles.pill,
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#86efac",
    };
  }

  if (clean === "checkout_started") {
    return {
      ...styles.pill,
      background: "#dbeafe",
      color: "#1d4ed8",
      borderColor: "#93c5fd",
    };
  }

  if (clean === "failed" || clean === "cancelled") {
    return {
      ...styles.pill,
      background: "#fee2e2",
      color: "#991b1b",
      borderColor: "#fecaca",
    };
  }

  return {
    ...styles.pill,
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#cbd5e1",
  };
}

function getGiftAidStyle(claimed?: boolean | null): CSSProperties {
  if (claimed) {
    return {
      ...styles.pill,
      background: "#fffbeb",
      color: "#92400e",
      borderColor: "#fde68a",
    };
  }

  return {
    ...styles.pill,
    background: "#f8fafc",
    color: "#64748b",
    borderColor: "#e2e8f0",
  };
}

function getDonorName(row: DonationRow) {
  const name = cleanText(row.donor_name, "");

  if (name) return name;

  const giftAidName = [row.gift_aid_first_name, row.gift_aid_last_name]
    .map((value) => cleanText(value, ""))
    .filter(Boolean)
    .join(" ");

  return giftAidName || "Anonymous donor";
}

function getGiftAidAddress(row: DonationRow) {
  return [
    row.gift_aid_address_line_1,
    row.gift_aid_address_line_2,
    row.gift_aid_town_or_city,
    row.gift_aid_postcode,
  ]
    .map((value) => cleanText(value, ""))
    .filter(Boolean)
    .join(", ");
}

async function getDonationSummary(tenantSlug: string) {
  const rows = await query<DonationSummary>(
    `
      select
        count(*)::int as total_count,
        count(*) filter (where payment_status = 'paid')::int as paid_count,
        count(*) filter (where payment_status = 'pending')::int as pending_count,
        count(*) filter (where payment_status = 'checkout_started')::int as checkout_started_count,
        count(*) filter (where gift_aid_claimed = true)::int as gift_aid_count,
        coalesce(sum(amount_cents), 0)::int as amount_cents,
        coalesce(sum(coalesce(gross_amount_cents, amount_cents)), 0)::int as gross_amount_cents,
        coalesce(sum(donor_fee_cents), 0)::int as donor_fee_cents,
        coalesce(sum(platform_fee_cents), 0)::int as platform_fee_cents,
        coalesce(sum(coalesce(net_amount_cents, amount_cents)), 0)::int as net_amount_cents
      from public_donations
      where tenant_slug = $1
    `,
    [tenantSlug],
  );

  return rows[0] || null;
}

async function getDonations(tenantSlug: string) {
  return query<DonationRow>(
    `
      select
        id::text,
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
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        created_at::text,
        paid_at::text,
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
        gift_aid_declaration_accepted_at::text
      from public_donations
      where tenant_slug = $1
      order by created_at desc
      limit 250
    `,
    [tenantSlug],
  );
}

export default async function AdminDonationsPage() {
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

  const [summary, donations] = await Promise.all([
    getDonationSummary(tenantSlug),
    getDonations(tenantSlug),
  ]);

  const currency = donations[0]?.currency || "GBP";

  const totalCount = toNumber(summary?.total_count);
  const paidCount = toNumber(summary?.paid_count);
  const pendingCount = toNumber(summary?.pending_count);
  const checkoutStartedCount = toNumber(summary?.checkout_started_count);
  const giftAidCount = toNumber(summary?.gift_aid_count);

  return (
    <main className="admin-donations-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="donations-hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <Link href="/admin" style={styles.backLink}>
            ← Back to dashboard
          </Link>

          <div style={styles.badgeRow}>
            <span style={styles.badge}>Donations</span>
            <span style={styles.softBadge}>Gift Aid reporting</span>
          </div>

          <h1
            className="so-brand-heading donations-title"
            style={styles.title}
          >
            Donations & Gift Aid
          </h1>

          <p style={styles.subtitle}>
            Review pure donation payments, donor details, fee coverage and Gift
            Aid declarations for this tenant.
          </p>

          <p style={styles.tenant}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div className="donations-hero-stats" style={styles.heroStats}>
          <StatCard label="Total donations" value={totalCount} dark />
          <StatCard label="Paid" value={paidCount} dark />
          <StatCard label="Gift Aid" value={giftAidCount} dark />
        </div>
      </section>

      <section className="summary-grid" style={styles.summaryGrid}>
        <SummaryCard
          label="Donation amount"
          value={formatMoney(summary?.amount_cents, currency)}
          text="Pure donation amount before optional donor fee coverage."
        />

        <SummaryCard
          label="Gross collected"
          value={formatMoney(summary?.gross_amount_cents, currency)}
          text="Donation amount plus any donor-covered fees."
        />

        <SummaryCard
          label="Donor fee cover"
          value={formatMoney(summary?.donor_fee_cents, currency)}
          text="Optional supporter contribution towards platform/payment costs."
        />

        <SummaryCard
          label="Platform fee"
          value={formatMoney(summary?.platform_fee_cents, currency)}
          text="Platform commission recorded against donations."
        />

        <SummaryCard
          label="Net amount"
          value={formatMoney(summary?.net_amount_cents, currency)}
          text="Donation value recorded for the organisation."
        />
      </section>

      <section className="status-grid" style={styles.statusGrid}>
        <StatusCard label="Paid" value={paidCount} tone="success" />
        <StatusCard
          label="Checkout started"
          value={checkoutStartedCount}
          tone="info"
        />
        <StatusCard label="Pending" value={pendingCount} tone="neutral" />
        <StatusCard label="Gift Aid declarations" value={giftAidCount} tone="gold" />
      </section>

      <section style={styles.sectionHeader}>
        <div>
          <p style={styles.kicker}>Read-only report</p>

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            Donation records
          </h2>

          <p style={styles.sectionText}>
            Showing the latest 250 donation records for this tenant. CSV export
            can be added after the read-only view is confirmed.
          </p>
        </div>
      </section>

      {donations.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 style={styles.emptyTitle}>No donations yet</h2>

          <p style={styles.emptyText}>
            Pure donations will appear here once supporters complete the
            donation checkout.
          </p>

          <Link href={`/c/${tenantSlug}/support`} style={styles.emptyButton}>
            Open public donation page →
          </Link>
        </section>
      ) : (
        <section className="donations-list" style={styles.donationsList}>
          {donations.map((donation) => (
            <DonationCard key={donation.id} donation={donation} />
          ))}
        </section>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: ReactNode;
  dark?: boolean;
}) {
  return (
    <div style={dark ? styles.darkStatCard : styles.statCard}>
      <div style={dark ? styles.darkStatLabel : styles.statLabel}>{label}</div>
      <div style={dark ? styles.darkStatValue : styles.statValue}>{value}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  text,
}: {
  label: string;
  value: ReactNode;
  text: string;
}) {
  return (
    <article style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
      <p style={styles.summaryText}>{text}</p>
    </article>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone: "success" | "info" | "neutral" | "gold";
}) {
  const toneStyle =
    tone === "success"
      ? styles.statusSuccess
      : tone === "info"
        ? styles.statusInfo
        : tone === "gold"
          ? styles.statusGold
          : styles.statusNeutral;

  return (
    <article style={{ ...styles.statusCard, ...toneStyle }}>
      <div style={styles.statusLabel}>{label}</div>
      <div style={styles.statusValue}>{value}</div>
    </article>
  );
}

function DonationCard({ donation }: { donation: DonationRow }) {
  const currency = donation.currency || "GBP";
  const donorName = getDonorName(donation);
  const giftAidAddress = getGiftAidAddress(donation);

  return (
    <article className="donation-card" style={styles.donationCard}>
      <div className="donation-card-main" style={styles.donationMain}>
        <div style={styles.donationTopRow}>
          <div style={styles.donorIdentity}>
            <h3 style={styles.donorName}>{donorName}</h3>

            <p style={styles.donorEmail}>
              {cleanText(donation.donor_email, "No email recorded")}
            </p>
          </div>

          <div style={styles.pillRow}>
            <span style={getStatusStyle(donation.payment_status)}>
              {statusLabel(donation.payment_status)}
            </span>

            <span style={getGiftAidStyle(donation.gift_aid_claimed)}>
              {donation.gift_aid_claimed ? "Gift Aid" : "No Gift Aid"}
            </span>
          </div>
        </div>

        <div className="donation-money-grid" style={styles.moneyGrid}>
          <MoneyBlock
            label="Donation"
            value={formatMoney(donation.amount_cents, currency)}
          />

          <MoneyBlock
            label="Gross"
            value={formatMoney(
              donation.gross_amount_cents ?? donation.amount_cents,
              currency,
            )}
          />

          <MoneyBlock
            label="Fee cover"
            value={formatMoney(donation.donor_fee_cents, currency)}
          />

          <MoneyBlock
            label="Platform fee"
            value={formatMoney(donation.platform_fee_cents, currency)}
          />

          <MoneyBlock
            label="Net"
            value={formatMoney(
              donation.net_amount_cents ?? donation.amount_cents,
              currency,
            )}
          />
        </div>

        <div className="donation-details-grid" style={styles.detailsGrid}>
          <InfoBlock
            label="Campaign"
            value={
              <>
                <strong>{cleanText(donation.campaign_title, "General donation")}</strong>
                <span>{campaignTypeLabel(donation.campaign_type)}</span>
              </>
            }
          />

          <InfoBlock
            label="Created"
            value={
              <>
                <strong>{formatDate(donation.created_at)}</strong>
                <span>Paid: {formatDate(donation.paid_at)}</span>
              </>
            }
          />

          <InfoBlock
            label="Payment"
            value={
              <>
                <strong>
                  {donation.donor_covered_fees
                    ? "Donor covered fees"
                    : "No fee cover"}
                </strong>
                <span>
                  Session:{" "}
                  {cleanText(donation.stripe_checkout_session_id, "Not recorded")}
                </span>
              </>
            }
          />
        </div>

        {cleanText(donation.message, "") ? (
          <div style={styles.messageBox}>
            <div style={styles.messageLabel}>Donor message</div>
            <p style={styles.messageText}>{donation.message}</p>
          </div>
        ) : null}

        {donation.gift_aid_claimed ? (
          <div style={styles.giftAidPanel}>
            <div style={styles.giftAidHeader}>
              <div>
                <p style={styles.giftAidKicker}>Gift Aid declaration</p>
                <h4 style={styles.giftAidTitle}>
                  {cleanText(donation.gift_aid_first_name, "")}{" "}
                  {cleanText(donation.gift_aid_last_name, "")}
                </h4>
              </div>

              <span style={styles.giftAidDate}>
                {formatDate(donation.gift_aid_declaration_accepted_at)}
              </span>
            </div>

            <div style={styles.giftAidDetails}>
              <InfoBlock label="Address" value={giftAidAddress || "—"} />

              <InfoBlock
                label="Declaration"
                value={
                  cleanText(
                    donation.gift_aid_declaration_text,
                    "Gift Aid declaration text was not recorded.",
                  )
                }
              />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MoneyBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.moneyBlock}>
      <span style={styles.moneyLabel}>{label}</span>
      <strong style={styles.moneyValue}>{value}</strong>
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.infoBlock}>
      <span style={styles.infoLabel}>{label}</span>
      <div style={styles.infoValue}>{value}</div>
    </div>
  );
}

const responsiveStyles = `
.admin-donations-page,
.admin-donations-page * {
  box-sizing: border-box;
}

.admin-donations-page {
  overflow-x: hidden;
}

.admin-donations-page section,
.admin-donations-page article,
.admin-donations-page div,
.admin-donations-page a {
  min-width: 0;
}

@media (max-width: 1040px) {
  .admin-donations-page .donations-hero {
    grid-template-columns: 1fr !important;
  }

  .admin-donations-page .donations-hero-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .admin-donations-page .summary-grid,
  .admin-donations-page .donation-money-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .admin-donations-page .donation-details-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 760px) {
  .admin-donations-page {
    padding: 18px 12px 44px !important;
  }

  .admin-donations-page .donations-title {
    font-size: clamp(38px, 11vw, 58px) !important;
    line-height: 0.98 !important;
  }

  .admin-donations-page .donations-hero {
    padding: 22px !important;
    border-radius: 28px !important;
  }

  .admin-donations-page .summary-grid,
  .admin-donations-page .status-grid,
  .admin-donations-page .donation-money-grid,
  .admin-donations-page .donations-hero-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .admin-donations-page .donation-card-main {
    padding: 16px !important;
    border-radius: 22px !important;
  }
}

@media (max-width: 560px) {
  .admin-donations-page .summary-grid,
  .admin-donations-page .status-grid,
  .admin-donations-page .donation-money-grid,
  .admin-donations-page .donations-hero-stats {
    grid-template-columns: 1fr !important;
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
      "radial-gradient(circle at top left, rgba(251,191,36,0.10), transparent 30%), radial-gradient(circle at top right, rgba(37,99,235,0.08), transparent 34%), #f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  hero: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(300px, 0.8fr)",
    gap: 22,
    padding: 30,
    borderRadius: 34,
    background:
      "radial-gradient(circle at bottom right, rgba(251,191,36,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    overflow: "hidden",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  heroContent: {
    minWidth: 0,
  },

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    maxWidth: "100%",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 14,
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
    fontSize: "clamp(52px, 7vw, 82px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
    overflowWrap: "anywhere",
    textShadow: "0 18px 45px rgba(0,0,0,0.22)",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.6,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  tenant: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    alignContent: "start",
  },

  statCard: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  darkStatCard: {
    display: "grid",
    gap: 6,
    padding: 18,
    borderRadius: 22,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.26)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },

  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
  },

  darkStatLabel: {
    color: "#bfdbfe",
    fontSize: 13,
    fontWeight: 850,
  },

  statValue: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  darkStatValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  summaryCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  summaryValue: {
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
  },

  summaryText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 700,
  },

  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 20,
  },

  statusCard: {
    display: "grid",
    gap: 8,
    padding: 16,
    borderRadius: 22,
    border: "1px solid transparent",
  },

  statusSuccess: {
    background: "#ecfdf5",
    borderColor: "#bbf7d0",
  },

  statusInfo: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
  },

  statusNeutral: {
    background: "#ffffff",
    borderColor: "#e2e8f0",
  },

  statusGold: {
    background: "#fffbeb",
    borderColor: "#fde68a",
  },

  statusLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  statusValue: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },

  sectionHeader: {
    marginBottom: 16,
  },

  kicker: {
    margin: "0 0 7px",
    color: "#b45309",
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
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.6,
    maxWidth: 760,
    fontWeight: 700,
    overflowWrap: "anywhere",
  },

  emptyCard: {
    display: "grid",
    gap: 12,
    justifyItems: "start",
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    letterSpacing: "-0.04em",
  },

  emptyText: {
    margin: 0,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 700,
  },

  emptyButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 950,
  },

  donationsList: {
    display: "grid",
    gap: 14,
  },

  donationCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },

  donationMain: {
    display: "grid",
    gap: 16,
    padding: 20,
  },

  donationTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },

  donorIdentity: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },

  donorName: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  donorEmail: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },

  pillRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  pill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    whiteSpace: "nowrap",
  },

  moneyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
  },

  moneyBlock: {
    display: "grid",
    gap: 5,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  moneyLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  moneyValue: {
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  infoBlock: {
    display: "grid",
    gap: 6,
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    minWidth: 0,
  },

  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  infoValue: {
    display: "grid",
    gap: 4,
    color: "#334155",
    lineHeight: 1.45,
    fontSize: 13,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  messageBox: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
  },

  messageLabel: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  messageText: {
    margin: 0,
    color: "#1e3a8a",
    lineHeight: 1.55,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  giftAidPanel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 58%, #f8fafc 100%)",
    border: "1px solid #fde68a",
  },

  giftAidHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  giftAidKicker: {
    margin: "0 0 5px",
    color: "#b45309",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  giftAidTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  giftAidDate: {
    display: "inline-flex",
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
  },

  giftAidDetails: {
    display: "grid",
    gap: 10,
  },
};
