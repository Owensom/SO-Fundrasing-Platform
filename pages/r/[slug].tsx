import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { getPublicRaffleBySlug } from "../../src/api";
import type { RaffleDetails, TicketRef } from "../../src/types/raffles";
import {
  hasTicket,
  makeTicket,
  removeTicket,
  sortTickets,
  ticketKey,
} from "../../src/lib/tickets";

type CurrencyCode = "GBP" | "USD" | "EUR";

function currencySymbol(currency: CurrencyCode) {
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  return "£";
}

function formatCurrency(value: number, currency: CurrencyCode) {
  return `${currencySymbol(currency)}${value.toFixed(2)}`;
}

export default function PublicRafflePage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";

  const [raffle, setRaffle] = useState<RaffleDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeColour, setActiveColour] = useState("");
  const [selectedTickets, setSelectedTickets] = useState<TicketRef[]>([]);

  useEffect(() => {
    if (!router.isReady || !slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const data = await getPublicRaffleBySlug(slug);

        if (cancelled) return;

        setRaffle(data);
        setActiveColour(data.colours?.[0] || "");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load raffle");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, slug]);

  const currency = (raffle?.currency as CurrencyCode) || "GBP";

  const numbers = useMemo(() => {
    if (!raffle) return [];
    return Array.from(
      { length: raffle.endNumber - raffle.startNumber + 1 },
      (_, i) => raffle.startNumber + i,
    );
  }, [raffle]);

  const totalTickets = useMemo(() => {
    if (!raffle) return 0;
    return numbers.length * raffle.colours.length;
  }, [raffle, numbers.length]);

  function isSold(colour: string, number: number) {
    return raffle ? hasTicket(raffle.sold || [], makeTicket(colour, number)) : false;
  }

  function isReserved(colour: string, number: number) {
    return raffle
      ? hasTicket(raffle.reserved || [], makeTicket(colour, number))
      : false;
  }

  function isUnavailable(colour: string, number: number) {
    return isSold(colour, number) || isReserved(colour, number);
  }

  function isSelected(colour: string, number: number) {
    return hasTicket(selectedTickets, makeTicket(colour, number));
  }

  function toggleTicket(colour: string, number: number) {
    const ticket = makeTicket(colour, number);

    if (isUnavailable(colour, number)) return;

    setSelectedTickets((prev) =>
      hasTicket(prev, ticket) ? removeTicket(prev, ticket) : [...prev, ticket],
    );
  }

  function calculateTotal() {
    if (!raffle) return 0;

    let remaining = selectedTickets.length;
    let total = 0;

    const sortedOffers = [...raffle.offers].sort(
      (a, b) => b.quantity - a.quantity,
    );

    for (const offer of sortedOffers) {
      while (remaining >= offer.quantity) {
        total += offer.price;
        remaining -= offer.quantity;
      }
    }

    total += remaining * raffle.ticketPrice;
    return total;
  }

  const ticketsForActiveColour = selectedTickets.filter(
    (ticket) => ticket.colour === activeColour,
  );

  const selectedByColour = useMemo(() => {
    const grouped = new Map<string, TicketRef[]>();

    if (!raffle) return grouped;

    for (const colour of raffle.colours) {
      grouped.set(colour, []);
    }

    for (const ticket of selectedTickets) {
      const current = grouped.get(ticket.colour) || [];
      grouped.set(ticket.colour, [...current, ticket]);
    }

    for (const [colour, items] of grouped.entries()) {
      grouped.set(colour, sortTickets(items));
    }

    return grouped;
  }, [raffle, selectedTickets]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading raffle…</div>;
  }

  if (error || !raffle) {
    return <div style={{ padding: 24 }}>Error: {error || "Raffle not found"}</div>;
  }

  return (
    <div style={pageStyle}>
      <div style={heroStyle}>
        <div
          style={{
            ...heroImageStyle,
            background: raffle.imageUrl
              ? `center / cover no-repeat url(${raffle.imageUrl})`
              : "linear-gradient(135deg, #dbeafe 0%, #ede9fe 50%, #fce7f3 100%)",
          }}
        >
          <div style={heroOverlayStyle}>
            <div style={heroSlugStyle}>/r/{raffle.slug}</div>
            <h1 style={heroTitleStyle}>{raffle.title}</h1>
            {raffle.description ? (
              <p style={heroDescriptionStyle}>{raffle.description}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div style={statsGridStyle}>
        <SummaryCard label="Numbers per colour" value={`${numbers.length}`} />
        <SummaryCard label="Colours" value={`${raffle.colours.length}`} />
        <SummaryCard label="Total tickets" value={`${totalTickets}`} />
        <SummaryCard
          label="Single price"
          value={formatCurrency(raffle.ticketPrice, currency)}
        />
      </div>

      <div style={layoutStyle}>
        <div style={mainColumnStyle}>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Choose colour board</h2>
            <p style={sectionSubtitleStyle}>
              Each colour is a separate full ticket range. You can mix colours to
              qualify for bundle offers.
            </p>

            <div style={colourTabsStyle}>
              {raffle.colours.map((colour) => {
                const active = activeColour === colour;
                const count = selectedTickets.filter((t) => t.colour === colour).length;

                return (
                  <button
                    key={colour}
                    type="button"
                    onClick={() => setActiveColour(colour)}
                    style={{
                      ...colourTabStyle,
                      border: active ? "2px solid #111827" : "1px solid #d1d5db",
                    }}
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: colour,
                        border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                        flexShrink: 0,
                      }}
                    />
                    <span>{colour}</span>
                    <span style={{ color: "#6b7280", fontWeight: 600 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Pick numbers for {activeColour || "colour"}</h2>
            <p style={sectionSubtitleStyle}>
              Sold tickets are black, reserved tickets are grey, and available tickets
              can be selected.
            </p>

            <div style={numbersGridStyle}>
              {numbers.map((n) => {
                const selected = isSelected(activeColour, n);
                const sold = isSold(activeColour, n);
                const reserved = isReserved(activeColour, n);

                let background = "#f3f4f6";
                let color = "#111827";
                let border = "1px solid #d1d5db";
                let cursor: "pointer" | "not-allowed" = "pointer";

                if (sold) {
                  background = "#111827";
                  color = "#ffffff";
                  border = "1px solid #111827";
                  cursor = "not-allowed";
                } else if (reserved) {
                  background = "#e5e7eb";
                  color = "#6b7280";
                  border = "1px solid #d1d5db";
                  cursor = "not-allowed";
                } else if (selected) {
                  background = activeColour || "#111827";
                  color = "#ffffff";
                  border = "2px solid #111827";
                }

                return (
                  <button
                    key={ticketKey({ colour: activeColour, number: n })}
                    type="button"
                    onClick={() => toggleTicket(activeColour, n)}
                    disabled={sold || reserved}
                    style={{
                      ...numberButtonStyle,
                      border,
                      background,
                      color,
                      cursor,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div style={legendStyle}>
              <span>Sold = black</span>
              <span>Reserved = grey</span>
              <span>Available = selectable</span>
            </div>
          </section>
        </div>

        <div style={sidebarStyle}>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Summary</h2>

            <div style={summaryRowsStyle}>
              <SummaryRow label="Currency" value={currency} />
              <SummaryRow label="Active colour" value={activeColour || "—"} />
              <SummaryRow
                label="Selected on this colour"
                value={`${ticketsForActiveColour.length}`}
              />
              <SummaryRow
                label="Total selected tickets"
                value={`${selectedTickets.length}`}
              />
              <SummaryRow
                label="Total price"
                value={formatCurrency(calculateTotal(), currency)}
              />
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={subheadingStyle}>Offers</div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={offerRowStyle}>
                  <span>Single ticket</span>
                  <strong>{formatCurrency(raffle.ticketPrice, currency)}</strong>
                </div>
                {raffle.offers.map((offer, index) => (
                  <div key={`${offer.label}-${index}`} style={offerRowStyle}>
                    <span>{offer.label}</span>
                    <strong>{formatCurrency(offer.price, currency)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>Selected tickets</h2>

            {selectedTickets.length === 0 ? (
              <div style={emptyStateStyle}>No tickets selected yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {raffle.colours.map((colour) => {
                  const items = selectedByColour.get(colour) || [];
                  if (items.length === 0) return null;

                  return (
                    <div key={colour} style={selectedGroupStyle}>
                      <div style={selectedGroupHeaderStyle}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: colour,
                            border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                            flexShrink: 0,
                          }}
                        />
                        <span>{colour}</span>
                        <span style={{ color: "#6b7280" }}>({items.length})</span>
                      </div>

                      <div style={selectedPillsWrapStyle}>
                        {items.map((ticket) => (
                          <button
                            key={ticketKey(ticket)}
                            type="button"
                            onClick={() => toggleTicket(ticket.colour, ticket.number)}
                            style={selectedPillStyle}
                          >
                            {ticket.number} ×
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryCardLabelStyle}>{label}</div>
      <div style={summaryCardValueStyle}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryRowStyle}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  padding: 24,
  maxWidth: 1200,
  margin: "0 auto",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const heroStyle: React.CSSProperties = {
  marginBottom: 24,
};

const heroImageStyle: React.CSSProperties = {
  minHeight: 280,
  borderRadius: 24,
  overflow: "hidden",
  display: "flex",
  alignItems: "flex-end",
};

const heroOverlayStyle: React.CSSProperties = {
  width: "100%",
  padding: 24,
  background:
    "linear-gradient(180deg, rgba(17,24,39,0.1) 0%, rgba(17,24,39,0.75) 100%)",
};

const heroSlugStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.85)",
  marginBottom: 8,
};

const heroTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 36,
  lineHeight: 1.05,
};

const heroDescriptionStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 0,
  color: "rgba(255,255,255,0.92)",
  maxWidth: 700,
  lineHeight: 1.5,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const summaryCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
};

const summaryCardLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6b7280",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const summaryCardValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: "#111827",
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.8fr)",
  gap: 24,
  alignItems: "start",
};

const mainColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
};

const sidebarStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  color: "#111827",
};

const sectionSubtitleStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.5,
};

const colourTabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 16,
};

const colourTabStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 999,
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
};

const numbersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
  gap: 8,
  marginTop: 16,
};

const numberButtonStyle: React.CSSProperties = {
  padding: "12px 8px",
  borderRadius: 10,
  fontWeight: 700,
};

const legendStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 18,
  flexWrap: "wrap",
  color: "#6b7280",
  fontSize: 14,
};

const summaryRowsStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const summaryRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  paddingBottom: 10,
  borderBottom: "1px solid #f3f4f6",
};

const subheadingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 10,
};

const offerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 14,
  padding: 16,
  color: "#6b7280",
  background: "#fafafa",
};

const selectedGroupStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 14,
  background: "#fafafa",
};

const selectedGroupHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
  fontWeight: 700,
};

const selectedPillsWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const selectedPillStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  borderRadius: 999,
  padding: "6px 10px",
  cursor: "pointer",
  fontWeight: 600,
};
