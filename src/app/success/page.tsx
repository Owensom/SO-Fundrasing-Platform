type SuccessPageProps = {
  searchParams?: {
    session_id?: string;
  };
};

export default function SuccessPage({ searchParams }: SuccessPageProps) {
  const sessionId =
    typeof searchParams?.session_id === "string"
      ? searchParams.session_id
      : "";

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "60px auto",
        padding: "0 16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 2px 14px rgba(15,23,42,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, color: "#166534" }}>Payment successful</h1>

        <p>Thank you. Your payment has been completed successfully.</p>

        <p>
          Your tickets should now be confirmed and your receipt email should
          arrive shortly.
        </p>

        {sessionId ? (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 10,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#475569",
              wordBreak: "break-all",
            }}
          >
            <strong>Session ID:</strong> {sessionId}
          </div>
        ) : null}

        <div style={{ marginTop: 24 }}>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "12px 16px",
              borderRadius: 10,
              background: "#1683f8",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
