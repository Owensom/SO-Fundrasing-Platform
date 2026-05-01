import type { CSSProperties } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    tenantSlug: string;
  }>;
};

function formatTenantName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function TenantTermsPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const organiserName = formatTenantName(tenantSlug);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
          ← Back to campaigns
        </Link>

        <div style={styles.badge}>Organiser terms</div>

        <h1 style={styles.title}>Terms of Use</h1>

        <p style={styles.intro}>
          These terms apply to campaigns run by <strong>{organiserName}</strong>{" "}
          through the SO Fundraising Platform.
        </p>

        <h2 style={styles.heading}>1. Platform role</h2>
        <p style={styles.text}>
          SO Fundraising Platform provides software tools that allow organisers
          to create and manage fundraising campaigns, raffles, prize draws,
          squares games, events, ticket sales, and similar activities.
        </p>
        <p style={styles.text}>
          The platform does not operate, manage, or run campaigns itself. Each
          campaign is created and operated independently by the organiser.
        </p>

        <h2 style={styles.heading}>2. Organiser responsibility</h2>
        <p style={styles.text}>
          The organiser is responsible for ensuring that each campaign:
        </p>
        <ul style={styles.list}>
          <li>Complies with all applicable laws and regulations</li>
          <li>Is run fairly and transparently</li>
          <li>Clearly describes prizes, tickets, entries, events, and rules</li>
          <li>Delivers prizes, tickets, or services as advertised</li>
          <li>Handles participant communications appropriately</li>
        </ul>

        <h2 style={styles.heading}>3. No platform operation of lotteries</h2>
        <p style={styles.text}>
          SO Fundraising Platform does not operate lotteries, gambling services,
          or prize competitions. Any campaign involving paid entry and prizes is
          the sole responsibility of the organiser.
        </p>

        <h2 style={styles.heading}>4. Participation</h2>
        <p style={styles.text}>
          By participating in a campaign, you acknowledge that you are entering
          or purchasing from an activity run by the organiser, not by SO
          Fundraising Platform.
        </p>
        <p style={styles.text}>
          You are responsible for ensuring that the information you provide is
          accurate and that you meet any eligibility requirements set by the
          organiser.
        </p>

        <h2 style={styles.heading}>5. Payments</h2>
        <p style={styles.text}>
          Payments are processed securely through third-party payment providers
          such as Stripe. SO Fundraising Platform does not store full payment
          card details.
        </p>

        <h2 style={styles.heading}>6. Refunds and disputes</h2>
        <p style={styles.text}>
          Refunds, cancellations, campaign disputes, prize disputes, and event
          queries must be handled directly with the organiser unless otherwise
          required by law.
        </p>

        <h2 style={styles.heading}>7. Data usage</h2>
        <p style={styles.text}>
          Personal data submitted during campaigns is used for administering the
          relevant campaign, processing entries or purchases, sending
          confirmations, and contacting participants where necessary.
        </p>

        <h2 style={styles.heading}>8. Limitation of liability</h2>
        <p style={styles.text}>
          SO Fundraising Platform is not responsible for the actions, omissions,
          promises, prizes, event fulfilment, communications, or legal compliance
          of organisers.
        </p>

        <h2 style={styles.heading}>9. Changes</h2>
        <p style={styles.text}>
          These terms may be updated as the platform evolves. The latest version
          will be available on this page.
        </p>

        <div style={styles.footerBox}>
          <Link href={`/c/${tenantSlug}/privacy`} style={styles.footerLink}>
            View Privacy Policy
          </Link>
          <span style={styles.footerText}>
            Last updated: {new Date().toLocaleDateString("en-GB")}
          </span>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "32px 16px 56px",
  },
  card: {
    maxWidth: 900,
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: 24,
    padding: 28,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 14px rgba(15,23,42,0.06)",
  },
  backLink: {
    display: "inline-flex",
    marginBottom: 18,
    padding: "9px 13px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 14,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: "clamp(30px, 6vw, 44px)",
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
    fontWeight: 950,
    color: "#0f172a",
  },
  intro: {
    margin: "14px 0 24px",
    fontSize: 16,
    color: "#475569",
    lineHeight: 1.65,
  },
  heading: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: 900,
    color: "#0f172a",
  },
  text: {
    margin: "6px 0",
    fontSize: 14,
    color: "#475569",
    lineHeight: 1.65,
  },
  list: {
    margin: "8px 0 16px 18px",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.65,
  },
  footerBox: {
    marginTop: 30,
    paddingTop: 18,
    borderTop: "1px solid #e2e8f0",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  footerLink: {
    color: "#2563eb",
    fontWeight: 900,
    textDecoration: "none",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },
};
