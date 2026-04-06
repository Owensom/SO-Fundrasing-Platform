import React, { useState } from "react";
import SquaresSection from "./SquaresSection";
import TicketsSection from "./TicketsSection";
import RaffleSection from "./RaffleSection";

export default function App() {
  const [section, setSection] = useState<"squares" | "tickets" | "raffle">("squares");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    border: active ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
    color: "white",
    borderRadius: 18,
    padding: "12px 18px",
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          display: "flex",
          gap: 10,
          padding: 16,
          background: "rgba(2,6,23,0.92)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setSection("squares")} style={tabStyle(section === "squares")}>
          Squares
        </button>

        <button onClick={() => setSection("tickets")} style={tabStyle(section === "tickets")}>
          Tickets
        </button>

        <button onClick={() => setSection("raffle")} style={tabStyle(section === "raffle")}>
          Raffle
        </button>
      </div>

      {section === "squares" && <SquaresSection />}
      {section === "tickets" && <TicketsSection />}
      {section === "raffle" && <RaffleSection />}
    </div>
  );
}
