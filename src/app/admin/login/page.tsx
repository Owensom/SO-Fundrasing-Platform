import { getTenantSlugFromHeaders } from "@/lib/tenant";

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "tenant_access_denied":
      return "This account does not have access to this site.";
    case "invalid_credentials":
      return "Invalid email or password.";
    default:
      return "";
  }
}

export default async function AdminLoginPage({
  searchParams,
}: LoginPageProps) {
  const tenantSlug = await getTenantSlugFromHeaders();
  const errorMessage = getErrorMessage(searchParams?.error);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f3f4f6",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#ffffff",
          padding: 32,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: 44,
            lineHeight: 1.1,
            margin: 0,
            marginBottom: 16,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Admin login
        </h1>

        <p style={{ margin: "0 0 16px", color: "#374151", fontSize: 20 }}>
          Site: <strong>{tenantSlug || "unknown"}</strong>
        </p>

        {errorMessage ? (
          <p style={{ margin: "0 0 16px", color: "#dc2626", fontSize: 16 }}>
            {errorMessage}
          </p>
        ) : null}

        <form action="/api/auth/login" method="post">
          <input
            type="hidden"
            name="tenantSlug"
            value={tenantSlug || ""}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            style={{
              width: "100%",
              height: 48,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0 14px",
              fontSize: 16,
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            style={{
              width: "100%",
              height: 48,
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0 14px",
              fontSize: 16,
              marginBottom: 16,
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              height: 48,
              borderRadius: 9999,
              border: "none",
              background: "#1683f8",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
