import React, { useState } from "react";
import { apiFetch } from "./api";
import { useAuth } from "./useAuth";

function cardStyle(): React.CSSProperties {
  return {
    maxWidth: 480,
    margin: "40px auto",
    padding: 24,
    color: "white",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 24,
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "16px 18px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#0b1733",
    color: "white",
    boxSizing: "border-box",
    outline: "none",
  };
}

function buttonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: active ? "white" : "rgba(255,255,255,0.08)",
    color: active ? "#020617" : "white",
    fontWeight: 700,
    cursor: "pointer",
  };
}

export default function Login() {
  const { refreshAuth } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [charityName, setCharityName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "login") {
        await apiFetch("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
          }),
        });

        await refreshAuth();
        setMessage("Logged in successfully.");
      } else {
        await apiFetch("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            charityName,
            email,
            password,
          }),
        });

        await refreshAuth();
        setMessage("Account created successfully.");
      }

      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
      });

      await refreshAuth();
      setMessage("Logged out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={cardStyle()}>
      <h2 style={{ marginTop: 0 }}>{mode === "login" ? "Login" : "Create account"}</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button type="button" onClick={() => setMode("login")} style={buttonStyle(mode === "login")}>
          Login
        </button>
        <button type="button" onClick={() => setMode("register")} style={buttonStyle(mode === "register")}>
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
        {mode === "register" && (
          <input
            type="text"
            placeholder="Charity name"
            value={charityName}
            onChange={(e) => setCharityName(e.target.value)}
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
        {message && <div style={{ color: "#86efac" }}>{message}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{
            padding: "14px 18px",
            borderRadius: 16,
            border: "none",
            background: "white",
            color: "#020617",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          disabled={busy}
          style={{
            padding: "14px 18px",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
          }}
        >
          Log out
        </button>
      </form>

      <div style={{ marginTop: 18, fontSize: 13, color: "#cbd5e1" }}>
        Demo login: <strong>ownera@example.com</strong> / <strong>Password123!</strong>
      </div>
    </div>
  );
}
