import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "SO Fundraising Platform",
  description: "Multi-tenant raffle and fundraising platform",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#f3f5f7",
          color: "#111111",
          fontFamily:
            'Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* HEADER */}
        <header
          style={{
            width: "100%",
            borderBottom: "1px solid #e5e7eb",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Link href="/" aria-label="SO Fundraising Platform home">
              <Image
                src="/brand/so-logo-full.png"
                alt="SO Fundraising Platform"
                width={420}
                height={140}
                priority
                style={{
                  height: "72px",
                  width: "auto",
                  objectFit: "contain",
                }}
              />
            </Link>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main
          style={{
            minHeight: "calc(100vh - 180px)",
          }}
        >
          {children}
        </main>

        {/* FOOTER */}
        <footer
          style={{
            borderTop: "1px solid #e5e7eb",
            background: "#ffffff",
            marginTop: "40px",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "24px 20px",
              textAlign: "center",
              fontSize: "12px",
              color: "#607085",
            }}
          >
            <Image
              src="/brand/so-powered-by.png"
              alt="Powered by SO Fundraising Platform"
              width={360}
              height={120}
              style={{
                maxWidth: "260px",
                width: "100%",
                height: "auto",
                objectFit: "contain",
              }}
            />

            {/* ✅ LEGAL LINKS (ADDED) */}
            <div
              style={{
                marginTop: "14px",
                display: "flex",
                justifyContent: "center",
                gap: "16px",
                flexWrap: "wrap",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              <Link href="/terms" style={{ color: "#2563eb" }}>
                Terms
              </Link>
              <Link href="/privacy" style={{ color: "#2563eb" }}>
                Privacy
              </Link>
            </div>

            <div style={{ marginTop: "12px" }}>
              © {new Date().getFullYear()} SO Fundraising Platform
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
