import Link from "next/link";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams?: {
    error?: string;
  };
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

export default function AdminRegisterPage({ searchParams }: RegisterPageProps) {
  const errorMessage = getErrorMessage(searchParams?.error);

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
      <section
        style={{
          width: "100%",
          maxWidth: 1040,
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.95fr) minmax(360px, 0.8fr)",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            borderRadius: 32,
            padding: 32,
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.06)",
            boxShadow: "0 28px 80px rgba(0,0,0,0.28)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              padding: "8px 12px",
              borderRadius: 999,
              color: "#facc15",
              border: "1px solid rgba(250,204,21,0.55)",
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            SO Fundraising Platform
          </div>

          <h1
            style={{
              margin: "22px 0 16px",
              fontSize: "clamp(44px, 7vw, 78px)",
              lineHeight: 0.94,
              letterSpacing: "-0.075em",
              color: "#ffffff",
            }}
          >
            Create your organisation account
          </h1>

          <p
            style={{
              margin: 0,
              color: "#dbeafe",
              fontSize: 18,
              lineHeight: 1.65,
              maxWidth: 620,
              fontWeight: 650,
            }}
          >
            Set up a new tenant workspace with secure admin access, Community
            defaults, campaign tools and tenant-scoped billing settings.
          </p>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 28,
            }}
          >
            {[
              "Creates a tenant workspace",
              "Creates the first organisation admin",
              "Starts on the Community tier",
              "Keeps premium upgrades owner-controlled",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  color: "#eff6ff",
                  fontWeight: 800,
                }}
              >
                <span
                  style={{
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
                  }}
                >
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            borderRadius: 32,
            padding: 24,
            background: "#ffffff",
            border: "1px solid #dbeafe",
            boxShadow: "0 28px 80px rgba(0,0,0,0.22)",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px",
              color: "#0f172a",
              fontSize: 30,
              letterSpacing: "-0.04em",
            }}
          >
            Register
          </h2>

          <p
            style={{
              margin: "0 0 18px",
              color: "#64748b",
              lineHeight: 1.6,
              fontWeight: 650,
            }}
          >
            Use lowercase letters, numbers and hyphens for the site slug. This
            becomes the tenant identifier.
          </p>

          {errorMessage ? (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontWeight: 800,
                marginBottom: 16,
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          <form
            action="/api/admin/register"
            method="post"
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <label style={styles.label}>
              Organisation name
              <input
                name="organisationName"
                required
                placeholder="Example Charity"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Site slug
              <input
                name="tenantSlug"
                required
                placeholder="example-charity"
                pattern="[a-z0-9][a-z0-9-]{1,58}[a-z0-9]"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Admin name
              <input
                name="adminName"
                required
                placeholder="Organisation Admin"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Admin email
              <input
                name="email"
                type="email"
                required
                placeholder="admin@example.org"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={10}
                placeholder="At least 10 characters"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={10}
                placeholder="Repeat password"
                style={styles.input}
              />
            </label>

            <button
              type="submit"
              style={{
                marginTop: 8,
                height: 52,
                border: "none",
                borderRadius: 999,
                background:
                  "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
                color: "#ffffff",
                fontWeight: 950,
                fontSize: 16,
                cursor: "pointer",
                boxShadow: "0 16px 32px rgba(37,99,235,0.24)",
              }}
            >
              Create organisation account
            </button>
          </form>

          <p
            style={{
              margin: "18px 0 0",
              color: "#64748b",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Already registered?{" "}
            <Link
              href="/admin/login"
              style={{
                color: "#2563eb",
                fontWeight: 900,
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  label: {
    display: "grid",
    gap: 6,
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },

  input: {
    width: "100%",
    height: 48,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },
};
