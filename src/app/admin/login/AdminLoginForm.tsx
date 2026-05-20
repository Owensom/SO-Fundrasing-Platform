"use client";

import { getSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

const TENANT_COOKIE_NAME = "so_tenant_slug";

function slugifyTenant(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function setTenantCookie(tenantSlug: string) {
  if (typeof document === "undefined") return;

  const safeTenantSlug = slugifyTenant(tenantSlug);

  if (!safeTenantSlug) return;

  document.cookie = `${TENANT_COOKIE_NAME}=${encodeURIComponent(
    safeTenantSlug,
  )}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax; secure`;
}

function clearTenantCookie() {
  if (typeof document === "undefined") return;

  document.cookie = `${TENANT_COOKIE_NAME}=; path=/; max-age=0; samesite=lax; secure`;
}

function safeCallbackUrl(value: string | null | undefined) {
  const clean = String(value || "").trim();

  if (!clean || !clean.startsWith("/") || clean.startsWith("//")) {
    return "/admin";
  }

  if (clean.startsWith("/admin/login")) return "/admin";

  return clean;
}

function getTenantSlugsFromSession(
  session: Awaited<ReturnType<typeof getSession>>,
) {
  const rawTenantSlugs = (session?.user as any)?.tenantSlugs;

  if (!Array.isArray(rawTenantSlugs)) {
    return [];
  }

  return Array.from(
    new Set(
      rawTenantSlugs
        .map((value) => slugifyTenant(String(value)))
        .filter(Boolean),
    ),
  );
}

export default function AdminLoginForm() {
  const searchParams = useSearchParams();

  const queryTenantSlug = useMemo(() => {
    return slugifyTenant(searchParams?.get("tenant") || "");
  }, [searchParams]);

  const callbackUrl = useMemo(() => {
    return safeCallbackUrl(searchParams?.get("callbackUrl") || "/admin");
  }, [searchParams]);

  const errorCode = useMemo(() => {
    return searchParams?.get("error") || "";
  }, [searchParams]);

  const registered = useMemo(() => {
    return searchParams?.get("registered") === "1";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resolvedTenantSlug, setResolvedTenantSlug] = useState(
    queryTenantSlug || "",
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (queryTenantSlug) {
      setResolvedTenantSlug(queryTenantSlug);
      setTenantCookie(queryTenantSlug);
      return;
    }

    setResolvedTenantSlug("");
    clearTenantCookie();
  }, [queryTenantSlug]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    if (queryTenantSlug) {
      setTenantCookie(queryTenantSlug);
    } else {
      clearTenantCookie();
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    if (!result || result.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    const session = await getSession();
    const tenantSlugs = getTenantSlugsFromSession(session);

    if (tenantSlugs.length === 0) {
      setError("No tenant access was found for this account.");
      setLoading(false);
      return;
    }

    if (queryTenantSlug) {
      if (!tenantSlugs.includes(queryTenantSlug)) {
        clearTenantCookie();
        setError("This account does not have access to that site.");
        setLoading(false);
        return;
      }

      setTenantCookie(queryTenantSlug);
      setResolvedTenantSlug(queryTenantSlug);
      window.location.href = result.url || callbackUrl;
      return;
    }

    if (tenantSlugs.length === 1) {
      setTenantCookie(tenantSlugs[0]);
      setResolvedTenantSlug(tenantSlugs[0]);
      window.location.href = result.url || callbackUrl;
      return;
    }

    clearTenantCookie();

    const selectUrl = new URL("/admin/select-tenant", window.location.origin);
    selectUrl.searchParams.set("callbackUrl", callbackUrl);

    window.location.href = selectUrl.toString();
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.eyebrow}>Secure admin access</div>

        <h1 style={styles.title}>Admin login</h1>

        <p style={styles.subtitle}>
          Sign in with your organisation admin account. If your account has
          access to more than one site, you will choose which site to manage.
        </p>
      </div>

      <div style={styles.siteBox}>
        <span style={styles.siteLabel}>Site</span>
        <strong style={styles.siteValue}>
          {resolvedTenantSlug || "choose after sign in"}
        </strong>
      </div>

      {registered && queryTenantSlug ? (
        <div style={styles.successBox}>
          Account created for <strong>{queryTenantSlug}</strong>. Sign in to
          continue.
        </div>
      ) : null}

      {errorCode === "tenant_access_denied" ? (
        <div style={styles.errorBox}>
          This account does not have access to this site.
        </div>
      ) : null}

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Email address
          <input
            type="email"
            placeholder="admin@example.org"
            value={email}
            autoComplete="email"
            required
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            autoComplete="current-password"
            required
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
        </label>

        <button type="submit" disabled={loading} style={styles.submitButton}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      <div style={styles.footer}>
        <a href="/admin/register" style={styles.footerLink}>
          Create organisation account
        </a>

        <span style={styles.footerDivider}>·</span>

        <a href="/" style={styles.footerLinkMuted}>
          Back to home
        </a>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: 18,
  },

  header: {
    display: "grid",
    gap: 9,
  },

  eyebrow: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 40,
    lineHeight: 1,
    letterSpacing: "-0.06em",
  },

  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.55,
    fontWeight: 700,
  },

  siteBox: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
  },

  siteLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  siteValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  successBox: {
    padding: 13,
    borderRadius: 16,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
  },

  errorBox: {
    padding: 13,
    borderRadius: 16,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
  },

  form: {
    display: "grid",
    gap: 13,
  },

  label: {
    display: "grid",
    gap: 7,
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  input: {
    width: "100%",
    height: 50,
    padding: "0 14px",
    borderRadius: 15,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 700,
    outlineColor: "#1683f8",
  },

  submitButton: {
    minHeight: 52,
    border: "none",
    borderRadius: 999,
    background: "linear-gradient(135deg, #1683f8 0%, #2563eb 100%)",
    color: "#ffffff",
    fontWeight: 950,
    fontSize: 16,
    cursor: "pointer",
    boxShadow: "0 16px 32px rgba(37,99,235,0.24)",
  },

  footer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    flexWrap: "wrap",
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: 800,
  },

  footerLink: {
    color: "#2563eb",
    textDecoration: "none",
    fontWeight: 950,
  },

  footerLinkMuted: {
    color: "#64748b",
    textDecoration: "none",
    fontWeight: 850,
  },

  footerDivider: {
    color: "#cbd5e1",
  },
};
