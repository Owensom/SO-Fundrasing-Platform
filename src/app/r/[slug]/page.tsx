import Link from "next/link";
import { notFound } from "next/navigation";
import { getRaffleBySlug } from "@/lib/raffles";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import RaffleClient from "./RaffleClient";

type Props = {
  params: { slug: string };
};

type PublicColour = {
  id: string;
  name: string;
  sortOrder: number;
};

function colourToText(colour: any) {
  if (typeof colour === "string") return colour;
  if (colour?.name) return String(colour.name);
  if (colour?.hex) return String(colour.hex);
  return "";
}

function moneyFromCents(cents: any, currency = "GBP") {
  const amount = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function getTicketPrice(config: any, raffle: any) {
  return Number(
    config.ticketPriceCents ??
      config.ticket_price_cents ??
      config.priceCents ??
      config.price_cents ??
      raffle.ticket_price_cents ??
      0,
  );
}

function getPublicPrizes(config: any) {
  if (!Array.isArray(config.prizes)) return [];

  return config.prizes.filter((prize: any) => prize?.isPublic !== false);
}

function getPrizeTitle(prize: any, index: number) {
  return (
    prize?.title ||
    prize?.name ||
    prize?.prizeTitle ||
    prize?.prize_title ||
    `Prize ${index + 1}`
  );
}

function getPrizeDescription(prize: any) {
  return prize?.description || prize?.details || prize?.summary || "";
}

export default async function PublicRafflePage({ params }: Props) {
  const tenantSlug = getTenantSlugFromHeaders();
  const raffle = await getRaffleBySlug(tenantSlug, params.slug);

  if (!raffle) return notFound();

  const config = (raffle.config_json as any) || {};
  const imagePosition = config.image_position || "center";

  const entryQuestion = config.question?.text
    ? String(config.question.text).trim()
    : "";

  const currency = String(config.currency || raffle.currency || "GBP");

  const ticketPriceCents = getTicketPrice(config, raffle);
  const ticketPriceLabel =
    ticketPriceCents > 0 ? moneyFromCents(ticketPriceCents, currency) : null;

  const startNumber = Number(config.startNumber || 1);
  const endNumber = Number(config.endNumber || raffle.total_tickets || 100);
  const totalTickets = Math.max(0, endNumber - startNumber + 1);

  const publicPrizes = getPublicPrizes(config);

  const colours: PublicColour[] = Array.isArray(config.colours)
    ? config.colours
        .map(colourToText)
        .filter(Boolean)
        .map((colour: string, index: number) => ({
          id: `${colour}-${index}`,
          name: colour,
          sortOrder: index,
        }))
    : [];

  const fallbackColours =
    colours.length > 0
      ? colours
      : [{ id: "default", name: "Default", sortOrder: 0 }];

  const soldTickets = Array.isArray(config.sold)
    ? config.sold
        .map((ticket: any) => ({
          colour: String(ticket.colour || fallbackColours[0].name),
          number: Number(ticket.number),
        }))
        .filter((ticket: any) => Number.isFinite(ticket.number))
    : [];

  const reservedTickets = Array.isArray(config.reserved)
    ? config.reserved
        .map((ticket: any) => ({
          colour: String(ticket.colour || fallbackColours[0].name),
          number: Number(ticket.number),
        }))
        .filter((ticket: any) => Number.isFinite(ticket.number))
    : [];

  const unavailableCount = soldTickets.length + reservedTickets.length;
  const availableCount = Math.max(0, totalTickets * fallbackColours.length - unavailableCount);

  const raffleForClient = {
    id: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    description: raffle.description ?? "",
    startNumber,
    endNumber,
    colours: fallbackColours,
    soldTickets,
    reservedTickets,
    config_json: config,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 32%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 48%, #f8fafc 100%)",
        color: "#0f172a",
      }}
    >
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "34px 18px 54px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            marginBottom: 22,
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "#0f172a",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              fontSize: 22,
            }}
          >
            SO Foundation
          </Link>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <Link href="/terms" style={{ color: "#2563eb", textDecoration: "none" }}>
              Terms
            </Link>
            <Link href="/privacy" style={{ color: "#2563eb", textDecoration: "none" }}>
              Privacy
            </Link>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.08fr) minmax(340px, 0.92fr)",
            gap: 22,
            alignItems: "start",
          }}
        >
          <section
            style={{
              background: "rgba(255,255,255,0.86)",
              border: "1px solid rgba(226,232,240,0.95)",
              borderRadius: 28,
              boxShadow: "0 24px 70px rgba(15,23,42,0.10)",
              overflow: "hidden",
            }}
          >
            {raffle.image_url ? (
              <div
                style={{
                  width: "100%",
                  height: 390,
                  overflow: "hidden",
                  background: "#e2e8f0",
                }}
              >
                <img
                  src={raffle.image_url}
                  alt={raffle.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: imagePosition,
                    display: "block",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  minHeight: 320,
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(135deg, #1e3a8a 0%, #2563eb 45%, #7c3aed 100%)",
                  color: "white",
                  padding: 28,
                  textAlign: "center",
                }}
              >
                <div>
                  <div
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 24,
                      background: "rgba(255,255,255,0.18)",
                      display: "grid",
                      placeItems: "center",
                      margin: "0 auto 16px",
                      fontSize: 34,
                      fontWeight: 900,
                    }}
                  >
                    R
                  </div>
                  <p style={{ margin: 0, fontWeight: 900, fontSize: 22 }}>
                    Prize draw
                  </p>
                </div>
              </div>
            )}

            <div style={{ padding: 24 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    background: "#dcfce7",
                    color: "#166534",
                    padding: "7px 11px",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Live raffle
                </span>

                {ticketPriceLabel ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      padding: "7px 11px",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {ticketPriceLabel} per ticket
                  </span>
                ) : null}

                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    background: "#f8fafc",
                    color: "#334155",
                    padding: "7px 11px",
                    fontSize: 12,
                    fontWeight: 900,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {availableCount} available
                </span>
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(34px, 5vw, 58px)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.065em",
                  fontWeight: 950,
                  color: "#020617",
                }}
              >
                {raffle.title}
              </h1>

              {raffle.description ? (
                <p
                  style={{
                    margin: "16px 0 0",
                    color: "#475569",
                    lineHeight: 1.7,
                    fontSize: 16,
                    maxWidth: 760,
                  }}
                >
                  {raffle.description}
                </p>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 12,
                  marginTop: 22,
                }}
              >
                <div
                  style={{
                    borderRadius: 20,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: 16,
                  }}
                >
                  <p style={{ margin: 0, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                    Tickets
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 950 }}>
                    {totalTickets}
                  </p>
                </div>

                <div
                  style={{
                    borderRadius: 20,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: 16,
                  }}
                >
                  <p style={{ margin: 0, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                    Colours
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 950 }}>
                    {fallbackColours.length}
                  </p>
                </div>

                <div
                  style={{
                    borderRadius: 20,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    padding: 16,
                  }}
                >
                  <p style={{ margin: 0, color: "#64748b", fontSize: 12, fontWeight: 800 }}>
                    Prizes
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 950 }}>
                    {publicPrizes.length}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside
            style={{
              display: "grid",
              gap: 16,
              position: "sticky",
              top: 18,
            }}
          >
            <div
              style={{
                borderRadius: 28,
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                boxShadow: "0 22px 60px rgba(15,23,42,0.10)",
                padding: 18,
              }}
            >
              <RaffleClient raffle={raffleForClient as any} />
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 22,
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#7c2d12",
              }}
            >
              <p style={{ margin: 0, fontWeight: 950 }}>
                Important draw information
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55 }}>
                This campaign is run by the organiser. The platform provides
                software only and is not responsible for the operation of this
                draw. The organiser is responsible for ensuring compliance with
                all applicable laws.
              </p>
            </div>

            {entryQuestion ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 22,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1e3a8a",
                }}
              >
                <p style={{ margin: 0, fontWeight: 950 }}>
                  Entry question required
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.55 }}>
                  You will need to answer the entry question correctly before
                  checkout.
                </p>
              </div>
            ) : null}
          </aside>
        </div>

        {publicPrizes.length ? (
          <section style={{ marginTop: 24 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "end",
                marginBottom: 14,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    color: "#2563eb",
                    fontWeight: 950,
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  What you can win
                </p>
                <h2
                  style={{
                    margin: "6px 0 0",
                    fontSize: "clamp(28px, 4vw, 42px)",
                    lineHeight: 1,
                    letterSpacing: "-0.045em",
                    fontWeight: 950,
                  }}
                >
                  Prizes
                </h2>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 14,
              }}
            >
              {publicPrizes.map((prize: any, index: number) => (
                <article
                  key={`${getPrizeTitle(prize, index)}-${index}`}
                  style={{
                    borderRadius: 24,
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    boxShadow: "0 14px 40px rgba(15,23,42,0.07)",
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 16,
                      display: "grid",
                      placeItems: "center",
                      background: "#eef2ff",
                      color: "#3730a3",
                      fontWeight: 950,
                      marginBottom: 12,
                    }}
                  >
                    {index + 1}
                  </div>

                  <h3
                    style={{
                      margin: 0,
                      fontSize: 18,
                      lineHeight: 1.2,
                      fontWeight: 950,
                      color: "#020617",
                    }}
                  >
                    {getPrizeTitle(prize, index)}
                  </h3>

                  {getPrizeDescription(prize) ? (
                    <p
                      style={{
                        margin: "8px 0 0",
                        color: "#64748b",
                        lineHeight: 1.55,
                        fontSize: 14,
                      }}
                    >
                      {getPrizeDescription(prize)}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <footer
          style={{
            marginTop: 30,
            paddingTop: 18,
            borderTop: "1px solid #cbd5e1",
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#64748b",
            fontSize: 13,
          }}
        >
          <span>Secure checkout powered by Stripe.</span>

          <span style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/terms" style={{ color: "#2563eb", fontWeight: 800 }}>
              Terms & Conditions
            </Link>
            <Link href="/privacy" style={{ color: "#2563eb", fontWeight: 800 }}>
              Privacy Policy
            </Link>
          </span>
        </footer>
      </section>
    </main>
  );
}
