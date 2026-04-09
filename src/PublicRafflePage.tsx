export default function PublicRafflePage() {
  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Demo Raffle</h1>
      <p>Static test page. This bypasses the API completely.</p>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Raffle Details</h2>
        <p>Ticket Price: £5.00</p>
        <p>Sold Tickets: 0</p>
        <p>Remaining Tickets: 100</p>
        <p>Status: published</p>
      </div>
    </div>
  );
}
