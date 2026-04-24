import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { listSquaresGames } from "../../../../api/_lib/squares-repo";

export default async function AdminSquaresListPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((v) => String(v))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const games = await listSquaresGames(tenantSlug);

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: 24 }}>
      <h1>Squares Games</h1>

      <p>
        <Link href="/admin">← Back to dashboard</Link>
      </p>

      <p>
        <Link href="/admin/squares/new">➕ Create new squares game</Link>
      </p>

      {games.length === 0 ? (
        <p>No squares games yet.</p>
      ) : (
        <table style={{ width: "100%", marginTop: 20 }}>
          <thead>
            <tr>
              <th align="left">Title</th>
              <th align="left">Status</th>
              <th align="left">Squares</th>
              <th align="left">Price</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>{game.title}</td>
                <td>{game.status}</td>
                <td>{game.total_squares}</td>
                <td>
                  {(game.price_per_square_cents / 100).toFixed(2)}{" "}
                  {game.currency}
                </td>
                <td>
                  <Link href={`/admin/squares/${game.id}`}>Edit</Link>{" "}
                  |{" "}
                  <a href={`/s/${game.slug}`} target="_blank">
                    View
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
