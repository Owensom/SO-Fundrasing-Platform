import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRaffleById } from "@/lib/raffles";
import { getAdminSession } from "@/lib/admin-auth";
import RaffleAdminActions from "./RaffleAdminActions";

type PageProps = {
  params: {
    id: string;
  };
};

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
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  const raffle = await getRaffleById(params.id);

  if (!raffle) {
    notFound();
  }

  if (admin.tenant_slug && raffle.tenant_slug !== admin.tenant_slug) {
    notFound();
  }

  const badgeStyle = statusStyles(raffle.status);

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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
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

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
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
            Winner Drawn
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #d1fae5",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                Winning ticket
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {raffle.winner_ticket_number != null
                  ? `#${raffle.winner_ticket_number}`
                  : "—"}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #d1fae5",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                Winning colour
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {raffle.winner_colour || "—"}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #d1fae5",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                Drawn at
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {formatDateTime(raffle.drawn_at)}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: "#ffffff",
                border: "1px solid #d1fae5",
              }}
            >
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                Drawn by
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {raffle.drawn_by || "—"}
              </div>
            </div>
          </div>
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
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Label</div>
                        <div style={{ fontWeight: 700 }}>{offer.label}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Price</div>
                        <div style={{ fontWeight: 700 }}>
                          {raffle.currency} {offer.price.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Quantity</div>
                        <div style={{ fontWeight: 700 }}>{offer.quantity}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Active</div>
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

          {raffle.status === "closed" ? (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
                fontWeight: 600,
              }}
            >
              This raffle is closed. Customers should no longer be able to reserve or pay.
            </div>
          ) : null}

          {raffle.status === "drawn" ? (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                fontWeight: 600,
              }}
            >
              Winner has been drawn and can now be shown on the public raffle page.
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
