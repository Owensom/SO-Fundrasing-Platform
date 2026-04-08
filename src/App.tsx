import React, { useState } from "react";
import AdminLogin from "./AdminLogin";
import SquaresSection from "./SquaresSection";
import RaffleSection from "./RaffleSection";
import TicketsSection from "./TicketsSection";
import { useAdminAuth } from "./useAdminAuth";

type View = "home" | "admin-login" | "squares" | "raffle" | "tickets";

function navButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 16px",
    borderRadius: 12,
    border: active ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const { isAdmin, loading } = useAdminAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          padding: 20,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(2,6,23,0.75)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          backdropFilter: "blur(12px)",
        }}
      >
        <button onClick={() => setView("home")} style={navButtonStyle(view === "home")}>
          Home
        </button>
        <button onClick={() => setView("squares")} style={navButtonStyle(view === "squares")}>
          Squares
        </button>
        <button onClick={() => setView("raffle")} style={navButtonStyle(view === "raffle")}>
          Raffle
        </button>
        <button onClick={() => setView("tickets")} style={navButtonStyle(view === "tickets")}>
          Tickets
        </button>
        <button
          onClick={() => setView("admin-login")}
          style={navButtonStyle(view === "admin-login")}
        >
          {loading ? "Checking..." : isAdmin ? "Admin Account" : "Admin Login"}
        </button>
      </div>

      {view === "home" && (
        <div style={{ padding: 24 }}>
          <h1 style={{ marginTop: 0 }}>SO Fundraising Platform</h1>
          <p>Select a section above.</p>
          <p>{loading ? "Checking admin..." : isAdmin ? "Admin is logged in." : "Buyer mode."}</p>
        </div>
      )}

      {view === "admin-login" && <AdminLogin />}
      {view === "squares" && <SquaresSection />}
      {view === "raffle" && <RaffleSection />}
      {view === "tickets" && <TicketsSection />}
    </div>
  );
}
