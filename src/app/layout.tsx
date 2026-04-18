import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SO Fundraising Platform",
  description: "Multi-tenant raffle and campaigns platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          background: "#f8fafc",
          color: "#111827",
        }}
      >
        {children}
      </body>
    </html>
  );
}
