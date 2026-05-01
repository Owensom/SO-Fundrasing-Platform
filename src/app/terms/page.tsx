import type { CSSProperties } from "react";

export default function TermsPage() {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Terms of Use</h1>

        <p style={styles.text}>
          Welcome to the SO Fundraising Platform. By using this platform, you
          agree to the following terms.
        </p>

        <h2 style={styles.heading}>1. Platform role</h2>
        <p style={styles.text}>
          This platform provides software tools that allow organisers to create
          and manage fundraising campaigns, raffles, prize draws, and similar
          activities.
        </p>
        <p style={styles.text}>
          We do not operate, manage, or run any campaigns ourselves. Each
          campaign is created and operated independently by the organiser.
        </p>

        <h2 style={styles.heading}>2. No operation of lotteries</h2>
        <p style={styles.text}>
          This platform does not operate lotteries or gambling services.
        </p>
        <p style={styles.text}>
          Any campaign that involves paid entry and prizes is the sole
          responsibility of the organiser, including ensuring it complies with
          all applicable laws and regulations.
        </p>

        <h2 style={styles.heading}>3. Organiser responsibility</h2>
        <p style={styles.text}>
          Organisers using the platform must ensure that their campaigns:
        </p>
        <ul style={styles.list}>
          <li>Comply with all local laws and regulations</li>
          <li>Are run fairly and transparently</li>
          <li>Clearly describe prizes and entry conditions</li>
          <li>Deliver prizes as advertised</li>
        </ul>

        <h2 style={styles.heading}>4. User participation</h2>
        <p style={styles.text}>
          By participating in a campaign, you acknowledge that you are entering
          an activity run by the organiser, not by this platform.
        </p>

        <h2 style={styles.heading}>5. Data usage</h2>
        <p style={styles.text}>
          Personal data collected during campaigns is used only for the purpose
          of running that campaign.
        </p>
        <p style={styles.text}>
          Data is retained only for as long as necessary to complete the campaign
          and is not sold or shared with third parties for marketing purposes.
        </p>

        <h2 style={styles.heading}>6. Limitation of liability</h2>
        <p style={styles.text}>
          We are not responsible for the actions of organisers or participants.
          Any disputes must be resolved directly with the campaign organiser.
        </p>

        <h2 style={styles.heading}>7. Changes</h2>
        <p style={styles.text}>
          These terms may be updated from time to time as the platform evolves.
        </p>

        <p style={styles.footer}>
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "40px 16px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  card: {
    background: "#ffffff",
    borderRadius: 24,
    padding: 28,
    border: "1px solid #e2e8f0",
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
    color: "#0f172a",
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
    lineHeight: 1.6,
  },
  list: {
    margin: "8px 0 16px 18px",
    color: "#475569",
    fontSize: 14,
  },
  footer: {
    marginTop: 28,
    fontSize: 12,
    color: "#94a3b8",
  },
};
