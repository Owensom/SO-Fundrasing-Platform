import React, { useState } from "react";
import AdminLogin from "./AdminLogin";
import SquaresSection from "./SquaresSection";
import RaffleSection from "./RaffleSection";
import TicketsSection from "./TicketsSection";
import { useAdminAuth } from "./useAdminAuth";

type View = "home" | "admin-login" | "squares" | "raffle" | "tickets";

export default function App() {
  const [view, setView] = useState<View>("home");
  const { isAdmin, loading } = useAdminAuth();

  return (
    <div style={{ minHeight: "100vh", background: "#020617", color: "white" }}>
      <div
        style={{
          padding: 20,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button onClick={() => setView("home")}>Home</button>
        <button onClick={() => setView("squares")}>Squares</button>
        <button onClick={() => setView("raffle")}>Raffle</button>
        <button onClick={() => setView("tickets")}>Tickets</button>
        <button onClick={() => setView("admin-login")}>
          {loading ? "Checking..." : isAdmin ? "Admin Account" : "Admin Login"}
        </button>
      </div>

      {view === "home" && (
        <div style={{ padding: 24 }}>
          <h1>SO Fundraising Platform</h1>
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
