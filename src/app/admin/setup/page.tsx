"use client";

import { useEffect, useState } from "react";

function detectTenantSlug() {
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

export default function AdminSetupPage() {
  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("default");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTenantSlug(detectTenantSlug());
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const res = await fetch("/api/admin/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ secret, email, password, name, tenantSlug }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setMessage(data.error || "Setup failed");
      setLoading(false);
      return;
    }

    setMessage("Admin user created. You can now sign in at /admin/login.");
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 24 }}>
      <h1>Admin setup</h1>
      <p>Create the first admin user for this site.</p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        <input
          placeholder="Setup secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          style={{ padding: 12 }}
        />
        <input
          placeholder="Tenant slug"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          style={{ padding: 12 }}
        />
        <input
          placeholder="Admin name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 12 }}
        />
        <input
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12 }}
        />
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12 }}
        />
        <button type="submit" disabled={loading} style={{ padding: 12 }}>
          {loading ? "Creating..." : "Create admin"}
        </button>
      </form>

      {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
    </div>
  );
}
