import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicRaffleBySlug } from "../api";
import type { RaffleDetails, RaffleOffer } from "../types/raffles";

function money(value: number) {
  return `£${value.toFixed(2)}`;
}

function cardStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    backdropFilter: "blur(18px)",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 20px 80px rgba(2,6,23,0.45)",
  };
}

function buttonStyle(active = false): React.CSSProperties {
  return {
    border: active
      ? "1px solid rgba(125,211,252,0.45)"
      : "1px solid rgba(255,255,255,0.10)",
    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
    color: "white",
    borderRadius: 18,
    padding: "14px 18px",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.72)",
    color: "white",
    boxSizing: "border-box",
    outline: "none",
  };
}

export default function PublicRafflePage() {
  const { slug = "" } = useParams();
  const [raffle, setRaffle] = useState<RaffleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [selectedColour, setSelectedColour] = useState<string>("");
  const [manualQuantity, setManualQuantity] = useState<string>("1");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await getPublicRaffleBySlug(slug);

        if (!active) return;

        setRaffle(data);

        const firstActiveOffer = data.offers.find((offer) => offer.is_active);
        setSelectedOfferId(firstActiveOffer?.id ?? "");
        setSelectedColour(data.available_colours?.[0] ?? "");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load raffle");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (slug) {
      load();
    } else {
      setLoading(false);
      setError("Missing raffle slug");
    }

    return () => {
      active = false;
    };
  }, [slug]);

  const activeOffers = useMemo(
    () => raffle?.offers.filter((offer) => offer.is_active) ?? [],
    [raffle]
  );

  const selectedOffer = useMemo(
    () => activeOffers.find((offer) => offer.id === selectedOfferId) ?? null,
    [activeOffers, selectedOfferId]
  );

  const fallbackTicketPrice = raffle?.ticket_price ?? 0;
  const quantity =
    selectedOffer?.tickets ??
    Math.max(1, Number.isNaN(Number(manualQuantity)) ? 1 : Number(manualQuantity));

  const totalPrice =
    selectedOffer?.price ??
    quantity * (fallbackTicketPrice > 0 ? fallbackTicketPrice : 0);

  const canContinue =
    !!raffle &&
    buyerName.trim() !== "" &&
    buyerEmail.trim() !== "" &&
    quantity > 0;

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
          color: "white",
          fontFamily: "Inter, Arial, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>Loading raffle...</h2>
          </section>
        </div>
      </div>
    );
  }

  if (error || !raffle) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
          color: "white",
          fontFamily: "Inter, Arial, sans-serif",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <section style={cardStyle()}>
            <h2 style={{ marginTop: 0 }}>Raffle unavailable</h2>
            <p style={{ color: "#cbd5e1" }}>{error || "Raffle not found."}</p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(56,189,248,0.16), transparent 28%), radial-gradient(circle at right, rgba(168,85,247,0.14), transparent 22%), linear-gradient(180deg, #020617 0%, #0f172a 48%, #020617 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 20 }}>
        <section
          style={{
            ...cardStyle(),
            overflow: "hidden",
            padding: 0,
          }}
        >
          {raffle.image_url ? (
            <div>
              <div
                style={{
                  height: 320,
                  backgroundImage: `url(${raffle.image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div style={{ padding: 24 }}>
                <h1 style={{ margin: 0, fontSize: 40, letterSpacing: "-0.03em" }}>
                  {raffle.title}
                </h1>
                {raffle.description && (
                  <p style={{ margin: "14px 0 0", color: "#cbd5e1", lineHeight: 1.6 }}>
                    {raffle.description}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: 24 }}>
              <h1 style={{ margin: 0, fontSize: 40, letterSpacing: "-0.03em" }}>
                {raffle.title}
              </h1>
              {raffle.description && (
                <p style={{ margin: "14px 0 0", color: "#cbd5e1", lineHeight: 1.6 }}>
                  {raffle.description}
                </p>
              )}
            </div>
          )}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.3fr) minmax(320px, 0.9fr)",
            gap: 20,
          }}
        >
          <div style={cardStyle()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#94a3b8",
                    marginBottom: 8,
                  }}
                >
                  Public raffle
                </div>
                <h2 style={{ margin: 0, fontSize: 28 }}>Choose your tickets</h2>
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 18,
                  padding: "12px 14px",
                  minWidth: 180,
                }}
              >
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Single ticket price</div>
                <div style={{ marginTop: 6, fontWeight: 700, fontSize: 22 }}>
                  {raffle.ticket_price ? money(raffle.ticket_price) : "Not set"}
                </div>
              </div>
            </div>

            {activeOffers.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#94a3b8",
                    marginBottom: 12,
                  }}
                >
                  Offers
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {activeOffers.map((offer: RaffleOffer) => {
                    const active = offer.id === selectedOfferId;
                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => setSelectedOfferId(offer.id)}
                        style={{
                          ...buttonStyle(active),
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontSize: 18 }}>{offer.label}</div>
                        <div style={{ marginTop: 8, color: "#cbd5e1" }}>
                          {offer.tickets} tickets
                        </div>
                        <div style={{ marginTop: 8, fontSize: 22 }}>
                          {money(offer.price)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeOffers.length === 0 && (
              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#94a3b8",
                    marginBottom: 12,
                  }}
                >
                  Ticket quantity
                </div>

                <input
                  type="number"
                  min={1}
                  value={manualQuantity}
                  onChange={(e) => setManualQuantity(e.target.value)}
                  style={inputStyle()}
                />
              </div>
            )}

            {raffle.available_colours.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#94a3b8",
                    marginBottom: 12,
                  }}
                >
                  Choose a colour
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {raffle.available_colours.map((colour) => {
                    const active = colour === selectedColour;
                    return (
                      <button
                        key={colour}
                        type="button"
                        onClick={() => setSelectedColour(colour)}
                        style={{
                          ...buttonStyle(active),
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          textTransform: "capitalize",
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            background: colour,
                            border: "1px solid rgba(255,255,255,0.35)",
                            display: "inline-block",
                          }}
                        />
                        {colour}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div style={cardStyle()}>
            <h3 style={{ marginTop: 0, fontSize: 24 }}>Your entry</h3>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "#94a3b8",
                    marginBottom: 8,
                  }}
                >
                  Full name
                </div>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  style={inputStyle()}
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.14em",
                    color: "#94a3b8",
                    marginBottom: 8,
                  }}
                >
                  Email address
                </div>
                <input
                  type="email"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  style={inputStyle()}
                  placeholder="Enter your email"
                />
              </div>

              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(2,6,23,0.55)",
                  borderRadius: 18,
                  padding: 16,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ color: "#94a3b8" }}>Tickets</span>
                  <strong>{quantity}</strong>
                </div>

                {selectedOffer && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <span style={{ color: "#94a3b8" }}>Offer</span>
                    <strong>{selectedOffer.label}</strong>
                  </div>
                )}

                {selectedColour && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <span style={{ color: "#94a3b8" }}>Colour</span>
                    <strong style={{ textTransform: "capitalize" }}>{selectedColour}</strong>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ color: "#94a3b8" }}>Total</span>
                  <strong style={{ fontSize: 22 }}>{money(totalPrice)}</strong>
                </div>
              </div>

              <button
                type="button"
                disabled={!canContinue}
                style={{
                  border: "none",
                  borderRadius: 18,
                  padding: "16px 18px",
                  fontWeight: 800,
                  background: canContinue ? "white" : "rgba(255,255,255,0.20)",
                  color: canContinue ? "#020617" : "#cbd5e1",
                  cursor: canContinue ? "pointer" : "not-allowed",
                }}
              >
                Continue to purchase
              </button>

              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>
                This page is connected to the public raffle API. The purchase submit step
                can be wired next once your purchase endpoint is finalised.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
