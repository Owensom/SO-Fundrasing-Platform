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

export default async function TenantPrivacyPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const organiserName = formatTenantName(tenantSlug);

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Link href={`/c/${tenantSlug}`} style={styles.backLink}>
          ← Back to campaigns
        </Link>

        <div style={styles.badge}>Organiser privacy</div>

        <h1 style={styles.title}>Privacy Policy</h1>

        <p style={styles.intro}>
          This policy explains how information is collected and used when you
          support campaigns run by <strong>{organiserName}</strong> through the
          SO Fundraising Platform.
        </p>

        <h2 style={styles.heading}>1. Who is responsible for your data</h2>
        <p style={styles.text}>
          The campaign organiser is responsible for how participant information
          is used for their campaigns. SO Fundraising Platform provides the
          software used to collect entries, bookings, purchases, and related
          campaign information.
        </p>

        <h2 style={styles.heading}>2. Information collected</h2>
        <p style={styles.text}>When you enter or purchase from a campaign, the platform may collect:</p>
        <ul style={styles.list}>
          <li>Your name</li>
          <li>Your email address</li>
          <li>Your raffle tickets, squares, seats, tables, or bookings</li>
          <li>Transaction and checkout references</li>
          <li>Campaign participation details</li>
        </ul>

        <h2 style={styles.heading}>3. Payment information</h2>
        <p style={styles.text}>
          Payments are processed securely by third-party payment providers such
          as Stripe. Full card details are not stored by SO Fundraising Platform
          or by the campaign organiser through this platform.
        </p>

        <h2 style={styles.heading}>4. How information is used</h2>
        <p style={styles.text}>Information is used to:</p>
        <ul style={styles.list}>
          <li>Process entries, reservations, purchases, and bookings</li>
          <li>Send confirmation emails and campaign updates</li>
          <li>Contact winners or attendees where needed</li>
          <li>Administer the campaign fairly and transparently</li>
          <li>Meet legal, accounting, or regulatory obligations</li>
        </ul>

        <h2 style={styles.heading}>5. Sharing information</h2>
        <p style={styles.text}>
          Participant information may be shared with the organiser of the
          campaign you support. Information may also be processed by service
          providers needed to operate the platform, including payment and email
          providers.
        </p>
        <p style={styles.text}>
          Personal data is not sold or rented to third parties for marketing.
        </p>

        <h2 style={styles.heading}>6. Data retention</h2>
        <p style={styles.text}>
          Information is kept only for as long as necessary to operate the
          campaign, complete fulfilment, resolve issues, and meet legal or
          accounting obligations.
        </p>

        <h2 style={styles.heading}>7. Your rights</h2>
        <p style={styles.text}>
          Depending on applicable law, you may have rights to access, correct,
          delete, restrict, or object to the use of your personal data.
        </p>
        <p style={styles.text}>
          To exercise these rights, contact the organiser responsible for the
          campaign you supported.
        </p>

        <h2 style={styles.heading}>8. Security</h2>
        <p style={styles.text}>
          Reasonable technical and organisational measures are used to protect
          participant information. No online service can guarantee absolute
          security.
        </p>

        <h2 style={styles.heading}>9. Updates</h2>
        <p style={styles.text}>
          This policy may be updated as the platform and organiser requirements
          evolve. The latest version will be available on this page.
        </p>

        <div style={styles.footerBox}>
          <Link href={`/c/${tenantSlug}/terms`} style={styles.footerLink}>
            View Terms of Use
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
    background: "#ecfdf5",
    color: "#166534",
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
