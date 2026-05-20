import { Suspense } from "react";
import AdminLoginForm from "./AdminLoginForm";

export const dynamic = "force-dynamic";

function LoginFallback() {
  return (
    <div style={styles.card}>
      <div style={styles.logoPill}>SO Fundraising Platform</div>
      <h1 style={styles.title}>Admin login</h1>
      <p style={styles.subtitle}>Preparing secure sign in…</p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <main style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="login-shell" style={styles.shell}>
        <aside style={styles.heroPanel}>
          <div style={styles.heroGlow} />

          <div style={styles.logoPill}>SO Fundraising Platform</div>

          <h1 className="login-title" style={styles.heroTitle}>
            Manage your fundraising platform
          </h1>

          <p style={styles.heroText}>
            Sign in to manage campaigns, events, raffles, squares, payments,
            tenant settings and fundraising tools.
          </p>

          <div style={styles.checkList}>
            {[
              "Tenant-secure admin access",
              "Stripe Connect ready",
              "Premium campaign management",
              "Owner-controlled billing tools",
            ].map((item) => (
              <div key={item} style={styles.checkItem}>
                <span style={styles.checkIcon}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>

        <section style={styles.formPanel}>
          <Suspense fallback={<LoginFallback />}>
            <AdminLoginForm />
          </Suspense>
        </section>
      </section>
    </main>
  );
}

const responsiveStyles = `
.login-shell,
.login-shell * {
  box-sizing: border-box;
}

@media (max-width: 900px) {
  .login-shell {
    grid-template-columns: 1fr !important;
  }

  .login-title {
    font-size: clamp(42px, 11vw, 68px) !important;
  }
}

@media (max-width: 560px) {
  .login-shell {
    gap: 16px !important;
  }
}
`;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(22,131,248,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e3a8a 100%)",
    color: "#ffffff",
  },

  shell: {
    width: "100%",
    maxWidth: 1080,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(360px, 0.78fr)",
    gap: 24,
    alignItems: "stretch",
  },

  heroPanel: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    padding: 34,
    minHeight: 520,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.045) 100%)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.34)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  heroGlow: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.12), transparent 26%), radial-gradient(circle at 82% 80%, rgba(250,204,21,0.12), transparent 32%)",
  },

  logoPill: {
    position: "relative",
    zIndex: 1,
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 13px",
    borderRadius: 999,
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.58)",
    background: "rgba(15,23,42,0.22)",
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  heroTitle: {
    position: "relative",
    zIndex: 1,
    margin: "24px 0 16px",
    fontSize: "clamp(54px, 7vw, 84px)",
    lineHeight: 0.92,
    letterSpacing: "-0.075em",
    color: "#ffffff",
  },

  heroText: {
    position: "relative",
    zIndex: 1,
    margin: 0,
    maxWidth: 660,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.62,
    fontWeight: 700,
  },

  checkList: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 12,
    marginTop: 28,
  },

  checkItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#eff6ff",
    fontWeight: 850,
  },

  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#16a34a",
    color: "#ffffff",
    fontSize: 14,
    flexShrink: 0,
  },

  formPanel: {
    borderRadius: 34,
    padding: 24,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(219,234,254,0.92)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.28)",
    display: "grid",
    alignContent: "center",
  },

  card: {
    display: "grid",
    gap: 10,
  },

  title: {
    margin: "12px 0 0",
    color: "#0f172a",
    fontSize: 36,
    lineHeight: 1,
    letterSpacing: "-0.05em",
  },

  subtitle: {
    margin: 0,
    color: "#64748b",
    fontWeight: 750,
    lineHeight: 1.5,
  },
};
