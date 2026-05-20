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
        padding: "40px 18px",
        overflowX: "hidden",
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
            fontSize: "clamp(34px, 11vw, 110px)",
            lineHeight: 0.92,
            fontWeight: 900,
            letterSpacing: "-0.06em",
            color: "#ffffff",
            textTransform: "uppercase",
            textShadow: `
              -1px -1px 0 #c8a24a,
               1px -1px 0 #c8a24a,
              -1px  1px 0 #c8a24a,
               1px  1px 0 #c8a24a,
               0 0 18px rgba(200,162,74,0.15)
            `,
            wordBreak: "break-word",
          }}
        >
          SO Fundraising
        </h1>

        <div
          style={{
            marginTop: "10px",
            fontSize: "clamp(16px, 5vw, 42px)",
            letterSpacing: "clamp(0.14em, 3vw, 0.45em)",
            color: "#c8a24a",
            textTransform: "uppercase",
            fontWeight: 600,
            paddingLeft: "0.14em",
          }}
        >
          Platform
        </div>

        <div
          style={{
            width: "min(220px, 60vw)",
            height: "2px",
            margin: "24px auto",
            background:
              "linear-gradient(90deg, transparent 0%, #c8a24a 20%, #c8a24a 80%, transparent 100%)",
          }}
        />

        <p
          style={{
            maxWidth: "780px",
            margin: "0 auto",
            color: "rgba(255,255,255,0.92)",
            fontSize: "clamp(16px, 4vw, 28px)",
            lineHeight: 1.45,
            fontWeight: 500,
            padding: "0 4px",
          }}
        >
          Create and run premium multi-tenant raffles, squares, silent
          auctions, and fundraising events.
        </p>

        <div
          style={{
            marginTop: "36px",
            display: "flex",
            gap: "14px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="/admin/register"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 28px",
              minWidth: "260px",
              maxWidth: "100%",
              background:
                "linear-gradient(180deg, #d4af57 0%, #c8a24a 100%)",
              color: "#0d1b3d",
              textDecoration: "none",
              borderRadius: "999px",
              fontWeight: 900,
              fontSize: "16px",
              letterSpacing: "0.03em",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.2)",
              boxSizing: "border-box",
            }}
          >
            Create Organisation Account
          </a>

          <a
            href="/admin/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 28px",
              minWidth: "260px",
              maxWidth: "100%",
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(10px)",
              color: "#ffffff",
              textDecoration: "none",
              borderRadius: "999px",
              fontWeight: 800,
              fontSize: "16px",
              letterSpacing: "0.03em",
              border: "1px solid rgba(255,255,255,0.18)",
              boxSizing: "border-box",
            }}
          >
            Admin Login
          </a>
        </div>

        <div
          style={{
            marginTop: "44px",
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            gap: "14px",
          }}
        >
          {features.map((item) => (
            <div
              key={item.title}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "24px",
                padding: "20px 18px",
                backdropFilter: "blur(12px)",
                textAlign: "left",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                minHeight: 0,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(22px, 6vw, 34px)",
                  fontWeight: 900,
                  color: "#ffffff",
                  marginBottom: "12px",
                  lineHeight: 1,
                  textShadow: `
                    -1px -1px 0 #c8a24a,
                     1px -1px 0 #c8a24a,
                    -1px  1px 0 #c8a24a,
                     1px  1px 0 #c8a24a
                  `,
                  wordBreak: "break-word",
                }}
              >
                {item.title}
              </div>

              <p
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.5,
                  fontSize: "14px",
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
