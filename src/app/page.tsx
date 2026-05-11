const features = [
  {
    title: "Raffles",
    text: "Premium online raffles with Stripe checkout and live draws.",
  },
  {
    title: "Squares",
    text: "Interactive fundraising squares with automated winner selection.",
  },
  {
    title: "Auctions",
    text: "Run silent auctions with item listings, bids, and premium fundraising moments.",
  },
  {
    title: "Events",
    text: "Elegant ticketing, seating plans, and gala event management.",
  },
];

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "calc(100vh - 220px)",
        background:
          "linear-gradient(180deg, #0d1b3d 0%, #132957 45%, #f3f5f7 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "1280px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(56px, 9vw, 110px)",
            lineHeight: 0.95,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            color: "#ffffff",
            textTransform: "uppercase",
            textShadow: `
              -1px -1px 0 #c8a24a,
               1px -1px 0 #c8a24a,
              -1px  1px 0 #c8a24a,
               1px  1px 0 #c8a24a,
               0 0 18px rgba(200,162,74,0.15)
            `,
          }}
        >
          SO Fundraising
        </h1>

        <div
          style={{
            marginTop: "12px",
            fontSize: "clamp(22px, 4vw, 42px)",
            letterSpacing: "0.45em",
            color: "#c8a24a",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Platform
        </div>

        <div
          style={{
            width: "220px",
            height: "2px",
            margin: "28px auto",
            background:
              "linear-gradient(90deg, transparent 0%, #c8a24a 20%, #c8a24a 80%, transparent 100%)",
          }}
        />

        <p
          style={{
            maxWidth: "780px",
            margin: "0 auto",
            color: "rgba(255,255,255,0.92)",
            fontSize: "clamp(18px, 2vw, 28px)",
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          Create and run premium multi-tenant raffles, squares, silent
          auctions, and fundraising events.
        </p>

        <div
          style={{
            marginTop: "42px",
            display: "flex",
            gap: "18px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="/admin/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 28px",
              background:
                "linear-gradient(180deg, #d4af57 0%, #c8a24a 100%)",
              color: "#0d1b3d",
              textDecoration: "none",
              borderRadius: "999px",
              fontWeight: 800,
              fontSize: "16px",
              letterSpacing: "0.03em",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Admin Login
          </a>

          <a
            href="/c/demo-a"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 28px",
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(10px)",
              color: "#ffffff",
              textDecoration: "none",
              borderRadius: "999px",
              fontWeight: 700,
              fontSize: "16px",
              letterSpacing: "0.03em",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            View Campaigns
          </a>
        </div>

        <div
          style={{
            marginTop: "80px",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "24px",
          }}
        >
          {features.map((item) => (
            <div
              key={item.title}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "24px",
                padding: "28px",
                backdropFilter: "blur(12px)",
                textAlign: "left",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                minHeight: "150px",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(26px, 2.2vw, 34px)",
                  fontWeight: 900,
                  color: "#ffffff",
                  marginBottom: "12px",
                  textShadow: `
                    -1px -1px 0 #c8a24a,
                     1px -1px 0 #c8a24a,
                    -1px  1px 0 #c8a24a,
                     1px  1px 0 #c8a24a
                  `,
                }}
              >
                {item.title}
              </div>

              <p
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.7,
                  fontSize: "15px",
                }}
              >
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
