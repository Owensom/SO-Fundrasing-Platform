"use client";

export default function RaffleClient() {
  async function testReserve() {
    const response = await fetch("/api/raffles/oh-yes/reserve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantSlug: "TEST",
        buyerName: "TEST",
        buyerEmail: "test@example.com",
        selectedTickets: [
          { ticket_number: 99, colour: "test-colour" }
        ],
      }),
    });

    const data = await response.json();
    alert(JSON.stringify(data));
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>RAFFLE CLIENT LIVE CHECK</h1>
      <button
        type="button"
        onClick={testReserve}
        style={{
          padding: "12px 16px",
          background: "#111",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        TEST RESERVE
      </button>
    </div>
  );
}
