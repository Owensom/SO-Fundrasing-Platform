import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getSquaresGameByTenantAndSlug,
  listSquaresWinners,
} from "../../../../api/_lib/squares-repo";
import SquaresGameClient from "./SquaresGameClient";

type PageProps = {
  params: {
    slug: string;
  };
};

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

export default async function SquaresPublicPage({ params }: PageProps) {
  const tenantSlug = getTenantSlugFromHeaders();

  if (!tenantSlug) {
    notFound();
  }

  const game = await getSquaresGameByTenantAndSlug(
    tenantSlug,
    params.slug,
  );

  if (!game || game.status !== "published") {
    notFound();
  }

  const winners = await listSquaresWinners(game.id);

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      {/* Winners section */}
      {winners.length > 0 && (
        <section
          style={{
            marginBottom: 24,
            padding: 16,
            border: "2px solid #16a34a",
            borderRadius: 12,
            background: "#f0fdf4",
          }}
        >
          <h2 style={{ marginTop: 0 }}>🎉 Winners</h2>

          <ul style={{ paddingLeft: 20 }}>
            {winners.map((winner) => (
              <li key={winner.id}>
                <strong>{winner.prize_title}</strong>: Square #
                {winner.square_number} —{" "}
                {firstNameOnly(winner.customer_name)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Game UI */}
      <SquaresGameClient game={game} />
    </main>
  );
}
