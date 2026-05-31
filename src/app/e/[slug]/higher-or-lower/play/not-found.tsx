"use client";

import { useMemo } from "react";

export default function HigherOrLowerPlayNotFound() {
  const eventUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "/";
    }

    const parts = window.location.pathname.split("/").filter(Boolean);
    const eventSlug = parts[1] || "";

    if (!eventSlug) {
      return "/";
    }

    return `/e/${encodeURIComponent(eventSlug)}`;
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background:
          "radial-gradient(circle at top left, rgba(250,204,21,0.18), transparent 34%), radial-gradient(circle at 80% 8%, rgba(22,131,248,0.15), transparent 30%), #f8fafc",
        padding: "clamp(18px, 4vw, 38px)",
        color: "#0f172a",
        boxSizing: "border-box",
      }}
    >
      <section
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            padding: "clamp(22px, 5vw, 34px)",
            borderRadius: 30,
            background:
              "radial-gradient(circle at bottom right, rgba(250,204,21,0.2), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
            color: "#ffffff",
            border: "1px solid rgba(250,204,21,0.35)",
            boxShadow: "0 24px 70px rgba(15,23,42,0.2)",
            overflow: "hidden",
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              display: "inline-flex",
              width: "fit-content",
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(250,204,21,0.16)",
              border: "1px solid rgba(250,204,21,0.35)",
              color: "#fef3c7",
              fontSize: 12,
              fontWeight: 950,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Higher or Lower player link
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(42px, 10vw, 82px)",
              lineHeight: 0.92,
              letterSpacing: "-0.075em",
              fontWeight: 1000,
            }}
          >
            We could not open this private link
          </h1>

          <p
            style={{
              margin: "18px 0 0",
              color: "#dbeafe",
              fontSize: "clamp(16px, 3vw, 21px)",
              lineHeight: 1.5,
              fontWeight: 800,
              maxWidth: 680,
            }}
          >
            This link may be old, incomplete, copied incorrectly, or no longer
            connected to a paid Higher or Lower entry.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            padding: "clamp(18px, 4vw, 24px)",
            borderRadius: 26,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 14px 38px rgba(15,23,42,0.08)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 16,
              borderRadius: 20,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1e3a8a",
            }}
          >
            <strong style={{ fontSize: 17 }}>
              If you received this by email
            </strong>
            <span style={{ lineHeight: 1.55, fontWeight: 750 }}>
              Open the newest Higher or Lower email and use the blue button
              inside it. Older test emails may contain an outdated link format.
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gap: 8,
              padding: 16,
              borderRadius: 20,
              background: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e",
            }}
          >
            <strong style={{ fontSize: 17 }}>
              If the organiser has not opened a round yet
            </strong>
            <span style={{ lineHeight: 1.55, fontWeight: 750 }}>
              A valid player link will still open your entry page and show that
              no round is open yet. You do not need a new link for each round.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <a
              href={eventUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 46,
                padding: "12px 16px",
                borderRadius: 999,
                background: "#1683f8",
                color: "#ffffff",
                textDecoration: "none",
                fontWeight: 950,
                boxShadow: "0 12px 24px rgba(22,131,248,0.22)",
              }}
            >
              Back to event page
            </a>

            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 46,
                padding: "12px 16px",
                borderRadius: 999,
                background: "#f8fafc",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                textDecoration: "none",
                fontWeight: 950,
              }}
            >
              Go to platform home
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
