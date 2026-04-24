import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getSquaresGameById,
  listSquaresWinners,
} from "../../../../../api/_lib/squares-repo";

type PageProps = {
  params: {
    id: string;
  };
};

function firstNameOnly(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "Winner";
}

export default async function AdminSquaresEditPage({ params }: PageProps) {
  const tenantSlug = getTenantSlugFromHeaders();
  const game = await getSquaresGameById(params.id);

  if (!tenantSlug || !game || game.tenant_slug !== tenantSlug) {
    notFound();
  }

  const winners = await listSquaresWinners(game.id);
  const prizesJson = JSON.stringify(game.config_json?.prizes ?? [], null, 2);

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <p>
        <a href="/admin/squares/new">Create another squares game</a>
      </p>

      <h1>Edit squares game</h1>

      <p>
        Public page:{" "}
        <a href={`/s/${game.slug}`} target="_blank">
          /s/{game.slug}
        </a>
      </p>

      <form
        action={`/api/admin/squares/${game.id}`}
        method="post"
        style={{ display: "grid", gap: 16 }}
      >
        <label>
          Title
          <input
            name="title"
            defaultValue={game.title}
            required
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Slug
          <input
            name="slug"
            defaultValue={game.slug}
            required
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            rows={4}
            defaultValue={game.description ?? ""}
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Image URL
          <input
            name="image_url"
            defaultValue={game.image_url ?? ""}
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Number of squares
          <input
            name="total_squares"
            type="number"
            min={1}
            max={500}
            defaultValue={game.total_squares}
            required
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Price per square
          <input
            name="price_per_square"
            type="number"
            min={0}
            step="0.01"
            defaultValue={(game.price_per_square_cents / 100).toFixed(2)}
            required
            style={{ display: "block", width: "100%", padding: 10 }}
          />
        </label>

        <label>
          Currency
          <select
            name="currency"
            defaultValue={game.currency ?? "GBP"}
            style={{ display: "block", width: "100%", padding: 10 }}
          >
            <option value="GBP">GBP</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label>
          Status
          <select
            name="status"
            defaultValue={game.status}
            style={{ display: "block", width: "100%", padding: 10 }}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="drawn">Drawn</option>
          </select>
        </label>

        <label>
          Prizes JSON
          <textarea
            name="prizes"
            rows={8}
            defaultValue={prizesJson}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              fontFamily: "monospace",
            }}
          />
        </label>

        <button
          type="submit"
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #111",
            cursor: "pointer",
          }}
        >
          Save squares game
        </button>
      </form>

      <section
        style={{
          marginTop: 32,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <h2>Draw winners</h2>

        {winners.length > 0 ? (
          <div>
            <p>Winners have already been drawn.</p>

            <ul>
              {winners.map((winner) => (
                <li key={winner.id}>
                  <strong>{winner.prize_title}</strong>: Square #
                  {winner.square_number} — {firstNameOnly(winner.customer_name)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <form
            action={`/api/admin/squares/${game.id}/draw`}
            method="post"
            style={{ marginTop: 16 }}
          >
            <button
              type="submit"
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #111",
                background: "#16a34a",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Draw winners
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
