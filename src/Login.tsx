import React, { useState } from "react";
import { useAuth } from "./useAuth";

function cardStyle(): React.CSSProperties {
  return {
    maxWidth: 480,
    margin: "40px auto",
    padding: 24,
    color: "white",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 20,
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0f172a",
    color: "white",
    boxSizing: "border-box",
    outline: "none",
  };
}

function buttonStyle(primary = false): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 12,
    border: primary ? "none" : "1px solid rgba(255,255,255,0.12)",
    background: primary ? "white" : "rgba(255,255,255,0.08)",
    color: primary ? "#020617" : "white",
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default function Login() {
  const { user, tenant, isLoggedIn, loading, login, register, logout } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, tenantName);
      }

      setEmail("");
      setPassword("");
      setTenantName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setError("");
    setBusy(true);

    try {
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log out");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div style={{ color: "white", padding: 24 }}>Loading...</div>;
  }

  return (
    <div style={cardStyle()}>
      <h2 style={{ marginTop: 0 }}>
        {isLoggedIn ? "Account" : mode === "login" ? "Login" : "Create account"}
      </h2>

      {isLoggedIn && user ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            Logged in as <strong>{user.email}</strong>
          </div>
          <div>
            Role: <strong>{user.role}</strong>
          </div>
          <div>
            Tenant: <strong>{tenant?.name ?? "Unknown"}</strong>
          </div>
          <button onClick={handleLogout} disabled={busy} style={buttonStyle(true)}>
            {busy ? "Logging out..." : "Log out"}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setMode("login")}
              style={buttonStyle(mode === "login")}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              style={buttonStyle(mode === "register")}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            {mode === "register" && (
              <input
                type="text"
                placeholder="Organisation / tenant name"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                style={inputStyle()}
              />
            )}

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle()}
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle()}
            />

            {error && <div style={{ color: "#fda4af" }}>{error}</div>}

            <button type="submit" disabled={busy} style={buttonStyle(true)}>
              {busy
                ? mode === "login"
                  ? "Logging in..."
                  : "Creating account..."
                : mode === "login"
                ? "Log in"
                : "Create account"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
