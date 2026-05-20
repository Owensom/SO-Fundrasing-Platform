import Link from "next/link";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "organisation_required":
      return "Enter the organisation name.";
    case "invalid_slug":
      return "Enter a valid site slug using lowercase letters, numbers and hyphens.";
    case "admin_name_required":
      return "Enter the admin name.";
    case "invalid_email":
      return "Enter a valid email address.";
    case "weak_password":
      return "Password must be at least 10 characters.";
    case "password_mismatch":
      return "Passwords do not match.";
    case "tenant_exists":
      return "That site slug is already in use.";
    case "email_exists":
      return "That email address already has an admin account.";
    case "failed":
      return "Registration failed. Please try again.";
    default:
      return "";
  }
}

export default async function AdminRegisterPage({
  searchParams,
}: RegisterPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(22,131,248,0.12), transparent 30%), linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e3a8a 100%)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <style>{responsiveStyles}</style>

      <section className="register-shell" style={styles.shell}>
        <div style={styles.heroCard}>
          <div style={styles.eyebrow}>SO Fundraising Platform</div>

          <h1 style={styles.title}>Create your organisation account</h1>

          <p style={styles.subtitle}>
            Set up a new tenant workspace with secure admin access, Community
            defaults, campaign tools and tenant-scoped billing settings.
          </p>

          <div style={styles.checkList}>
            {[
              "Creates a tenant workspace",
              "Creates the first organisation admin",
              "Starts on the Community tier",
              "Generates a safe tenant slug automatically",
            ].map((item) => (
              <div key={item} style={styles.checkItem}>
                <span style={styles.checkIcon}>✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={styles.formCard}>
          <h2 style={styles.formTitle}>Register</h2>

          <p style={styles.formIntro}>
            Enter the organisation name and the site slug will be generated
            automatically. You can still edit it before creating the account.
          </p>

          {errorMessage ? (
            <div style={styles.errorBox}>{errorMessage}</div>
          ) : null}

          <RegisterForm />

          <p style={styles.footerText}>
            Already registered?{" "}
            <Link href="/admin/login" style={styles.footerLink}>
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

const responsiveStyles = `
.register-shell {
  width: 100%;
}

@media (max-width: 900px) {
  .register-shell {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 520px) {
  .register-shell {
    gap: 16px !important;
  }
}
`;

const styles: Record<string, React.CSSProperties> = {
  shell: {
    width: "100%",
    maxWidth: 1040,
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(360px, 0.8fr)",
    gap: 24,
    alignItems: "stretch",
  },

  heroCard: {
    borderRadius: 32,
    padding: 32,
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 28px 80px rgba(0,0,0,0.28)",
  },

  eyebrow: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.55)",
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  title: {
    margin: "22px 0 16px",
    fontSize: "clamp(44px, 7vw, 78px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    color: "#ffffff",
  },

  subtitle: {
    margin: 0,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.65,
    maxWidth: 620,
    fontWeight: 650,
  },

  checkList: {
    display: "grid",
    gap: 12,
    marginTop: 28,
  },

  checkItem: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    color: "#eff6ff",
    fontWeight: 800,
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

  formCard: {
    borderRadius: 32,
    padding: 24,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    boxShadow: "0 28px 80px rgba(0,0,0,0.22)",
  },

  formTitle: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: 30,
    letterSpacing: "-0.04em",
  },

  formIntro: {
    margin: "0 0 18px",
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 650,
  },

  errorBox: {
    padding: 14,
    borderRadius: 16,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 800,
    marginBottom: 16,
  },

  footerText: {
    margin: "18px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },

  footerLink: {
    color: "#2563eb",
    fontWeight: 900,
  },
};
