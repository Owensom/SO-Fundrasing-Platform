"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function getTenantFromBrowserHost() {
  if (typeof window === "undefined") {
    return "default";
  }

  const host = window.location.host.split(":")[0].toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost")) {
    const parts = host.split(".").filter(Boolean);
    return parts.length >= 2 ? parts[0] : "default";
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.toLowerCase() || "";

  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    return host.replace(`.${rootDomain}`, "").split(".")[0] || "default";
  }

  if (host.endsWith(".vercel.app") || host.endsWith(".now.sh")) {
    const parts = host.split(".").filter(Boolean);
    return parts.length >= 3 ? parts[0] : "default";
  }

  return "default";
}

export default function AdminLoginForm() {
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => {
    return searchParams?.get("callbackUrl") || "/admin";
  }, [searchParams]);

  const errorCode = useMemo(() => {
    return searchParams?.get("error") || "";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tenantSlug = useMemo(() => getTenantFromBrowserHost(), []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

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

    window.location.href = result.url || callbackUrl;
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>Admin login</h1>

      <p>
        Site: <strong>{tenantSlug}</strong>
      </p>

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
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12 }}
        />
        <button type="submit" disabled={loading} style={{ padding: 12 }}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {error ? <p style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p> : null}
    </div>
  );
}
