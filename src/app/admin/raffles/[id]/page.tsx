import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRaffleById } from "@/lib/raffles";
import { query } from "@/lib/db";
import RaffleAdminActions from "./RaffleAdminActions";
import PrizeSettings from "./PrizeSettings";

type PageProps = {
  params: {
    id: string;
  };
};

type WinnerRow = {
  id: string;
  raffle_id: string;
  prize_position: number;
  ticket_number: number;
  colour: string | null;
  sale_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  drawn_at: string;
};

function ordinal(position: number) {
  const suffix =
    position % 10 === 1 && position % 100 !== 11
      ? "st"
      : position % 10 === 2 && position % 100 !== 12
        ? "nd"
        : position % 10 === 3 && position % 100 !== 13
          ? "rd"
          : "th";

  return `${position}${suffix}`;
}

function formatStatus(status: "draft" | "published" | "closed" | "drawn") {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "closed":
      return "Closed";
    case "drawn":
      return "Winner Drawn";
    default:
      return status;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusStyles(status: "draft" | "published" | "closed" | "drawn") {
  switch (status) {
    case "draft":
      return {
        background: "#f3f4f6",
        color: "#374151",
        border: "1px solid #d1d5db",
      };
    case "published":
      return {
        background: "#eff6ff",
        color: "#1d4ed8",
        border: "1px solid #bfdbfe",
      };
    case "closed":
      return {
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fed7aa",
      };
    case "drawn":
      return {
        background: "#ecfdf5",
        color: "#047857",
        border: "1px solid #a7f3d0",
      };
  }
}

export default async function AdminRafflePage({ params }: PageProps) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  const raffle = await getRaffleById(params.id);

  if (!raffle) {
    notFound();
  }

  const winners = await query<WinnerRow>(
    `
    select
      id::text,
      raffle_id,
      prize_position::int,
      ticket_number::int,
      colour,
      sale_id,
      buyer_name,
      buyer_email,
      drawn_at
    from raffle_winners
    where raffle_id = $1
    order by prize_position asc
    `,
    [raffle.id]
  );

  const fallbackWinners: WinnerRow[] =
    winners.length === 0 &&
    raffle.status === "drawn" &&
    raffle.winner_ticket_number != null
      ? [
          {
            id: "fallback",
            raffle_id: raffle.id,
            prize_position: 1,
            ticket_number: raffle.winner_ticket_number,
            colour: raffle.winner_colour,
            sale_id: raffle.winner_sale_id,
            buyer_name: null,
            buyer_email: null,
            drawn_at: raffle.drawn_at || "",
          },
        ]
      : [];

  const displayWinners = winners.length ? winners : fallbackWinners;
  const badgeStyle = statusStyles(raffle.status);

  const initialPrizes =
    Array.isArray((raffle.config_json as any)?.prizes)
      ? ((raffle.config_json as any).prizes as any[])
      : [];

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "40px auto",
        padding: "0 16px 48px",
        display: "grid",
        gap: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <Link
            href="/admin"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ← Back to admin
          </Link>

          <h1
            style={{
              margin: 0,
              fontSize: 32,
              lineHeight: 1.1,
              fontWeight: 800,
            }}
          >
            {raffle.title}
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                ...badgeStyle,
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {formatStatus(raffle.status)}
            </span>

            <span style={{ color: "#6b7280", fontSize: 14 }}>
              Slug: {raffle.slug}
            </span>

            <span style={{ color: "#6b7280", fontSize: 14 }}>
              Tenant: {raffle.tenant_slug}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/r/${raffle.slug}`}
            target="_blank"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              textDecoration: "none",
              color: "#111827",
              fontWeight: 600,
              background: "#fff",
            }}
          >
            Open Public Page
          </Link>
        </div>
      </div>

      <RaffleAdminActions
        raffleId={raffle.id}
        status={raffle.status}
        drawnAt={raffle.drawn_at}
      />

      <PrizeSettings raffleId={raffle.id} initialPrizes={initialPrizes} />

      {raffle.status === "drawn" ? (
        <section
          style={{
            display: "grid",
            gap: 12,
            padding: 20,
            borderRadius: 16,
            border: "1px solid #a7f3d0",
            background: "#ecfdf5",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: "#065f46" }}>
            Winners Drawn
          </div>

          {displayWinners.length ? (
            <div style={{ display: "grid", gap: 12 }}>
              {displayWinners.map((winner) => (
                <div
                  key={winner.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr 1fr",
                    gap: 12,
                    padding: 14,
                    borderRadius: 12,
                    background: "#ffffff",
                    border: "1px solid #d1fae5",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginBottom: 6,
                      }}
                    >
                      Prize
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      {ordinal(winner.prize_position)}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginBottom: 6,
                      }}
                    >
                      Winning ticket
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      #{winner.ticket_number}
                    </div>
                    <div style={{ marginTop: 4, fontWeight: 700 }}>
                      Colour: {winner.colour || "—"}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginBottom: 6,
                      }}
                    >
                      Winner
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      {winner.buyer_name || "—"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 14 }}>
                      {winner.buyer_email || "—"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
                      {formatDateTime(winner.drawn_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>No winners found.</div>
          )}
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            padding: 20,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800 }}>Raffle Details</div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                Description
              </div>
              <div style={{ whiteSpace: "pre-wrap", color: "#111827" }}>
                {raffle.description || "—"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Ticket price
                </div>
                <div style={{ fontWeight: 700 }}>
                  {raffle.currency} {raffle.ticket_price.toFixed(2)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Total tickets
                </div>
                <div style={{ fontWeight: 700 }}>{raffle.total_tickets}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Sold tickets
                </div>
                <div style={{ fontWeight: 700 }}>{raffle.sold_tickets}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Remaining tickets
                </div>
                <div style={{ fontWeight: 700 }}>{raffle.remaining_tickets}</div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Created
                </div>
                <div style={{ fontWeight: 700 }}>
                  {formatDateTime(raffle.created_at)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                  Updated
                </div>
                <div style={{ fontWeight: 700 }}>
                  {formatDateTime(raffle.updated_at)}
                </div>
              </div>
            </div>
          </div>

          {raffle.offers?.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Offers</div>

              <div style={{ display: "grid", gap: 10 }}>
                {raffle.offers
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((offer, index) => (
                    <div
                      key={offer.id || `${offer.label}-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.8fr",
                        gap: 10,
                        padding: 12,
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        background: "#f9fafb",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Label
                        </div>
                        <div style={{ fontWeight: 700 }}>{offer.label}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Price
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {raffle.currency} {offer.price.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Quantity
                        </div>
                        <div style={{ fontWeight: 700 }}>{offer.quantity}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Active
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {offer.is_active ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside
          style={{
            display: "grid",
            gap: 16,
            padding: 20,
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            background: "#fff",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 800 }}>Preview</div>

          {raffle.image_url ? (
            <img
              src={raffle.image_url}
              alt={raffle.title}
              style={{
                width: "100%",
                height: "auto",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                padding: 24,
                borderRadius: 12,
                border: "1px dashed #d1d5db",
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              No image uploaded
            </div>
          )}

          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 14, color: "#6b7280" }}>Slug</div>
            <code
              style={{
                display: "block",
                padding: 10,
                borderRadius: 10,
                background: "#f3f4f6",
                color: "#111827",
                overflowX: "auto",
              }}
            >
              /r/{raffle.slug}
            </code>
          </div>
        </aside>
      </section>
    </main>
  );
}
