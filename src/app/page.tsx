export default function HomePage() {
  return (
    <main style={{ maxWidth: 960, margin: "40px auto", padding: 16 }}>
      <h1>SO Fundraising Platform</h1>
      <p>Create and run multi-tenant raffles and fundraising campaigns.</p>

      <div style={{ marginTop: 24 }}>
        <a
          href="/admin/login"
          style={{
            display: "inline-block",
            padding: "12px 16px",
            background: "#111",
            color: "#fff",
            textDecoration: "none",
            borderRadius: 8,
          }}
        >
          Admin login
        </a>
      </div>
    </main>
  );
}
