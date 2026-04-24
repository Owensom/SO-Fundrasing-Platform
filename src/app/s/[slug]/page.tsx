import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getSquaresGameByTenantAndSlug } from "../../../../api/_lib/squares-repo";

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function SquaresPublicPage({ params }: PageProps) {
  const tenantSlug = getTenantSlugFromHeaders();
  const game = await getSquaresGameByTenantAndSlug(
    tenantSlug,
    params.slug,
  );

  if (!tenantSlug || !game || game.status !== "published") {
    notFound();
  }

  const sold = new Set(game.config_json?.sold ?? []);
  const reserved = new Set(game.config_json?.reserved ?? []);

  const squares = Array.from({ length: game.total_squares }, (_, i) => i + 1);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <h1>{game.title}</h1>

      {game.image_url && (
        <img
          src={game.image_url}
          alt=""
          style={{ width: "100%", borderRadius: 12 }}
        />
      )}

      <p>{game.description}</p>

      <h2>Prizes</h2>
      <ul>
        {(game.config_json?.prizes ?? []).map((p, i) => (
          <li key={i}>
            <strong>{p.title}</strong>
            {p.description && <div>{p.description}</div>}
          </li>
        ))}
      </ul>

      <h2>Pick your squares</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
          gap: 6,
          marginTop: 20,
        }}
      >
        {squares.map((n) => {
          const isSold = sold.has(n);
          const isReserved = reserved.has(n);

          let bg = "#f3f4f6";

          if (isSold) bg = "#111";        // black = sold
          else if (isReserved) bg = "#f59e0b"; // amber = reserved

          return (
            <div
              key={n}
              style={{
                aspectRatio: "1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                fontSize: 12,
                background: bg,
                color: isSold ? "#fff" : "#111",
              }}
            >
              {n}
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 20 }}>
        Price per square: {(game.price_per_square_cents / 100).toFixed(2)}{" "}
        {game.currency}
      </p>
    </main>
  );
}
