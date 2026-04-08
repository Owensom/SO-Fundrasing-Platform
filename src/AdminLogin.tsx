import React, { useState } from "react";
import { useAdminAuth } from "./useAdminAuth";

export default function AdminLogin() {
  const { admin, isAdmin, loading, refreshAdmin } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      setEmail("");
      setPassword("");
      await refreshAdmin();
    } catch {
      setError("Unable to log in");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });

    await refreshAdmin();
  }

  if (loading) {
    return <div style={{ color: "white", padding: 24 }}>Loading...</div>;
  }

  return (
    <div
      style={{
        maxWidth: 460,
        margin: "40px auto",
        padding: 24,
        color: "white",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 20,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Admin Login</h2>

      {isAdmin && admin ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div>Logged in as {admin.email}</div>
          <button
            onClick={handleLogout}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "white",
              color: "#020617",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      ) : (
        <form onSubmit={handleLogin} style={{ display: "grid", gap: 12 }}>
          <input
            type="email"
            placeholder="Admin email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0f172a",
              color: "white",
            }}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0f172a",
              color: "white",
            }}
          />

          {error && <div style={{ color: "#fda4af" }}>{error}</div>}

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "none",
              background: "white",
              color: "#020617",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Logging in..." : "Log in"}
          </button>
        </form>
      )}
    </div>
  );
}
