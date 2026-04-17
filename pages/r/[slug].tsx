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
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>{raffle.title}</h1>
      {raffle.description ? (
        <p style={{ color: "#6b7280" }}>{raffle.description}</p>
      ) : null}

      <div
        style={{
          marginTop: 20,
          padding: 16,
          borderRadius: 16,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <SummaryCard label="Numbers per colour" value={`${numbers.length}`} />
        <SummaryCard label="Colours" value={`${raffle.colours.length}`} />
        <SummaryCard label="Total tickets" value={`${totalTickets}`} />
        <SummaryCard label="Single price" value={`£${raffle.ticketPrice}`} />
      </div>

      <div style={{ marginTop: 28 }}>
        <h2>Choose colour board</h2>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
          {raffle.colours.map((colour) => {
            const active = activeColour === colour;
            const count = selectedTickets.filter((t) => t.colour === colour).length;

            return (
              <button
                key={colour}
                type="button"
                onClick={() => setActiveColour(colour)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: active ? "2px solid #111827" : "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: colour,
                    border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                  }}
                />
                <span>{colour}</span>
                <span style={{ color: "#6b7280", fontWeight: 600 }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <h2>Pick numbers for {activeColour || "colour"}</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
            gap: 8,
            marginTop: 14,
          }}
        >
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
                  padding: "12px 8px",
                  borderRadius: 10,
                  border,
                  background,
                  color,
                  cursor,
                  fontWeight: 700,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Selected tickets</h2>

          {selectedTickets.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No tickets selected yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {raffle.colours.map((colour) => {
                const items = selectedByColour.get(colour) || [];
                if (items.length === 0) return null;

                return (
                  <div
                    key={colour}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 14,
                      padding: 14,
                      background: "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                        fontWeight: 700,
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: colour,
                          border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                        }}
                      />
                      <span>{colour}</span>
                      <span style={{ color: "#6b7280" }}>({items.length})</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {items.map((ticket) => (
                        <button
                          key={ticketKey(ticket)}
                          type="button"
                          onClick={() => toggleTicket(ticket.colour, ticket.number)}
                          style={{
                            border: "1px solid #d1d5db",
                            background: "#fff",
                            borderRadius: 999,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
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
        </div>

        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 18,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Summary</h2>

          <div style={{ display: "grid", gap: 10 }}>
            <SummaryRow label="Active colour" value={activeColour || "—"} />
            <SummaryRow
              label="Selected on this colour"
              value={`${ticketsForActiveColour.length}`}
            />
            <SummaryRow
              label="Total selected tickets"
              value={`${selectedTickets.length}`}
            />
            <SummaryRow label="Total price" value={`£${calculateTotal()}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        paddingBottom: 10,
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <span style={{ color: "#6b7280" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
