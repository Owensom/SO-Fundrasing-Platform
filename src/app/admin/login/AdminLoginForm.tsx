"use client";

import { getSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

function getTenantSlugsFromSession(session: Awaited<ReturnType<typeof getSession>>) {
  const rawTenantSlugs = (session?.user as any)?.tenantSlugs;

  if (!Array.isArray(rawTenantSlugs)) {
    return [];
  }

  return rawTenantSlugs
    .map((value) => slugifyTenant(String(value)))
    .filter(Boolean);
}

export default function AdminLoginForm() {
  const searchParams = useSearchParams();

  const queryTenantSlug = useMemo(() => {
    return slugifyTenant(searchParams?.get("tenant") || "");
  }, [searchParams]);

  const callbackUrl = useMemo(() => {
    return searchParams?.get("callbackUrl") || "/admin";
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
    }
  }, [queryTenantSlug]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");

    if (queryTenantSlug) {
      setTenantCookie(queryTenantSlug);
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

    const selectedTenantSlug =
      queryTenantSlug && tenantSlugs.includes(queryTenantSlug)
        ? queryTenantSlug
        : tenantSlugs[0] || "";

    if (!selectedTenantSlug) {
      setError("No tenant access was found for this account.");
      setLoading(false);
      return;
    }

    setTenantCookie(selectedTenantSlug);
    setResolvedTenantSlug(selectedTenantSlug);

    window.location.href = result.url || callbackUrl;
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>Admin login</h1>

      <p>
        Site:{" "}
        <strong>
          {resolvedTenantSlug || "found automatically after sign in"}
        </strong>
      </p>

      {registered && queryTenantSlug ? (
        <p style={{ color: "#166534", fontWeight: 700 }}>
          Account created for {queryTenantSlug}. Sign in to continue.
        </p>
      ) : null}

      {errorCode === "tenant_access_denied" ? (
        <p style={{ color: "#b91c1c" }}>
          This account does not have access to this site.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12 }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12 }}
        />

        <button type="submit" disabled={loading} style={{ padding: 12 }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {error ? (
        <p style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p>
      ) : null}
    </div>
  );
}
