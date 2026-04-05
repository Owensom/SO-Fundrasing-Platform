import React, { useState } from "react";

export default function App() {
  const [isAdmin, setIsAdmin] = useState(true);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>SO Fundraising Platform</h1>

      <button onClick={() => setIsAdmin(!isAdmin)}>
        Toggle Admin ({isAdmin ? "ON" : "OFF"})
      </button>

      {isAdmin && <h2>Admin Sections (Top)</h2>}
      <h2>Buyer Full Width Sections</h2>

      <div>Squares / Tickets / Raffle UI placeholder</div>
    </div>
  );
}
