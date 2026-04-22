export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    slug: string;
  };
};

export default function RaffleSlugPage({ params }: PageProps) {
  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 24,
          background: "#ffffff",
          color: "#111111",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            border: "2px solid #111111",
            padding: 24,
            background: "#ffffff",
          }}
        >
          <h1 style={{ margin: 0, marginBottom: 12 }}>Raffle route works</h1>
          <p style={{ margin: 0 }}>Slug: {params.slug}</p>
        </div>
      </body>
    </html>
  );
}
