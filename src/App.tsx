import React, { useState } from "react";
import SquaresSection from "./SquaresSection";
import TicketsSection from "./TicketsSection";

export default function App() {
  const [section, setSection] = useState<"squares" | "tickets">("squares");

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
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <button
          onClick={() => setSection("squares")}
          style={{
            border: section === "squares" ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)",
            background: section === "squares" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
            color: "white",
            borderRadius: 18,
            padding: "12px 18px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Squares
        </button>

        <button
          onClick={() => setSection("tickets")}
          style={{
            border: section === "tickets" ? "1px solid rgba(125,211,252,0.35)" : "1px solid rgba(255,255,255,0.10)",
            background: section === "tickets" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
            color: "white",
            borderRadius: 18,
            padding: "12px 18px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tickets
        </button>
      </div>

      {section === "squares" ? <SquaresSection /> : <TicketsSection />}
    </div>
  );
}
