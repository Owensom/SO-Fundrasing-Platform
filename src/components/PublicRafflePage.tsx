"use client";

type Props = {
  slug: string;
};

export default function PublicRafflePage({ slug }: Props) {
  async function sendTest() {
    const response = await fetch(`/api/raffles/${encodeURIComponent(slug)}/reserve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantSlug: "test-tenant",
        buyerName: "Test User",
        buyerEmail: "test@example.com",
        selectedTickets: [{ ticket_number: 123, colour: "Blue" }],
      }),
    });

    const text = await response.text();
    alert(text);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>PUBLIC RAFFLE LIVE CHECK</h1>
      <button
        type="button"
        onClick={sendTest}
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
