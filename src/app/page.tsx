const features = [
  {
    title: "Raffles",
    text: "Premium online raffles with Stripe checkout and live draws.",
  },
  {
    title: "Squares",
    text: "Interactive fundraising squares with automated winner selection.",
  },
  {
    title: "Auctions",
    text: "Run silent auctions with item listings, bids, and premium fundraising moments.",
  },
  {
    title: "Events",
    text: "Elegant ticketing, seating plans, and gala event management.",
  },
];

export default function HomePage() {
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <h1 style={styles.title}>SO Fundraising</h1>

        <div style={styles.subtitle}>Platform</div>

        <div style={styles.divider} />

        <p style={styles.intro}>
          Create and run premium multi-tenant raffles, squares, silent auctions,
          and fundraising events.
        </p>

        <div style={styles.actions}>
          <a href="/admin/login" style={styles.primaryButton}>
            Admin Login
          </a>

          <a href="/c/demo-a" style={styles.secondaryButton}>
            View Campaigns
          </a>
        </div>

        <div style={styles.featureGrid}>
          {features.map((item) => (
            <div key={item.title} style={styles.featureCard}>
              <div style={styles.featureTitle}>{item.title}</div>
              <p style={styles.featureText}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "calc(100vh - 220px)",
    background:
      "linear-gradient(180deg, #0d1b3d 0%, #132957 45%, #f3f5f7 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "clamp(32px, 8vw, 60px) 16px",
    overflowX: "hidden" as const,
    boxSizing: "border-box" as const,
  },
  shell: {
    width: "100%",
    maxWidth: 1280,
    textAlign: "center" as const,
    minWidth: 0,
    boxSizing: "border-box" as const,
  },
  title: {
    margin: 0,
    fontSize: "clamp(42px, 13vw, 110px)",
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: "-0.055em",
    color: "#ffffff",
    textTransform: "uppercase" as const,
    overflowWrap: "anywhere" as const,
    textShadow: `
      -1px -1px 0 #c8a24a,
       1px -1px 0 #c8a24a,
      -1px  1px 0 #c8a24a,
       1px  1px 0 #c8a24a,
       0 0 18px rgba(200,162,74,0.15)
    `,
  },
  subtitle: {
    marginTop: 12,
    fontSize: "clamp(18px, 6vw, 42px)",
    letterSpacing: "clamp(0.18em, 4vw, 0.45em)",
    color: "#c8a24a",
    textTransform: "uppercase" as const,
    fontWeight: 600,
    overflowWrap: "anywhere" as const,
  },
  divider: {
    width: "min(220px, 70vw)",
    height: 2,
    margin: "28px auto",
    background:
      "linear-gradient(90deg, transparent 0%, #c8a24a 20%, #c8a24a 80%, transparent 100%)",
  },
  intro: {
    maxWidth: 780,
    margin: "0 auto",
    color: "rgba(255,255,255,0.92)",
    fontSize: "clamp(17px, 4.5vw, 28px)",
    lineHeight: 1.55,
    fontWeight: 500,
    overflowWrap: "anywhere" as const,
  },
  actions: {
    marginTop: 38,
    display: "flex",
    gap: 14,
    justifyContent: "center",
    flexWrap: "wrap" as const,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "min(100%, 270px)",
    padding: "16px 24px",
    background: "linear-gradient(180deg, #d4af57 0%, #c8a24a 100%)",
    color: "#0d1b3d",
    textDecoration: "none",
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 16,
    letterSpacing: "0.03em",
    boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.2)",
    boxSizing: "border-box" as const,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "min(100%, 270px)",
    padding: "16px 24px",
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
    color: "#ffffff",
    textDecoration: "none",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: "0.03em",
    border: "1px solid rgba(255,255,255,0.18)",
    boxSizing: "border-box" as const,
  },
  featureGrid: {
    marginTop: 64,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: 18,
    width: "100%",
    minWidth: 0,
  },
  featureCard: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 24,
    padding: "24px 20px",
    backdropFilter: "blur(12px)",
    textAlign: "left" as const,
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    minHeight: 150,
    minWidth: 0,
    boxSizing: "border-box" as const,
  },
  featureTitle: {
    fontSize: "clamp(24px, 7vw, 34px)",
    fontWeight: 900,
    color: "#ffffff",
    marginBottom: 12,
    lineHeight: 1.05,
    overflowWrap: "anywhere" as const,
    textShadow: `
      -1px -1px 0 #c8a24a,
       1px -1px 0 #c8a24a,
      -1px  1px 0 #c8a24a,
       1px  1px 0 #c8a24a
    `,
  },
  featureText: {
    margin: 0,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.6,
    fontSize: 15,
    overflowWrap: "anywhere" as const,
  },
};
