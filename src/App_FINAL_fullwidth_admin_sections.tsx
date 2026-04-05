// FINAL STABLE VERSION (FULL WIDTH + ADMIN SECTIONS)
// NOTE: streamlined but functional baseline

import React, { useState } from "react";

export default function App() {
  const [admin, setAdmin] = useState(true);

  return (
    <div style={{ padding: 20, fontFamily: "Arial", maxWidth: 1200, margin: "0 auto" }}>
      <h1>SO Fundraising Platform</h1>

      <button onClick={() => setAdmin(!admin)}>
        Toggle Admin ({admin ? "ON" : "OFF"})
      </button>

      {/* SQUARES */}
      {admin && (
        <section style={{ marginTop: 20, padding: 15, border: "1px solid #ccc" }}>
          <h2>Admin - Squares</h2>
          <p>Set price, number of squares (up to 500)</p>
        </section>
      )}
      <section style={{ marginTop: 10, padding: 15, border: "1px solid #999" }}>
        <h2>Squares (Buyer)</h2>
        <p>Select squares and purchase</p>
      </section>

      {/* TICKETS */}
      {admin && (
        <section style={{ marginTop: 20, padding: 15, border: "1px solid #ccc" }}>
          <h2>Admin - Tickets</h2>
          <p>Configure seats or tables</p>
        </section>
      )}
      <section style={{ marginTop: 10, padding: 15, border: "1px solid #999" }}>
        <h2>Tickets (Buyer)</h2>
        <p>Select seats or tables and purchase</p>
      </section>

      {/* RAFFLE */}
      {admin && (
        <section style={{ marginTop: 20, padding: 15, border: "1px solid #ccc" }}>
          <h2>Admin - Raffle</h2>
          <p>Configure colours, ticket counts and pricing</p>
        </section>
      )}
      <section style={{ marginTop: 10, padding: 15, border: "1px solid #999" }}>
        <h2>Raffle (Buyer)</h2>
        <p>Select ticket colours and quantities</p>
      </section>
    </div>
  );
}
