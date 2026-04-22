import type { ReactNode } from "react";

export const metadata = {
  title: "SO Fundraising Platform",
  description: "Multi-tenant raffle and fundraising platform",
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
          background: "#ffffff",
          color: "#111111",
          fontFamily:
            'Arial, Helvetica, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
