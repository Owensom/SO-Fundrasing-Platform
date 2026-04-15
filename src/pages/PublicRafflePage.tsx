import React, { useEffect, useState } from "react";
import { getPublicRaffleBySlug } from "./api";
import type { Raffle, RaffleOffer } from "./types/raffles";

type Props = {
  slug: string;
};

function centsToPounds(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await getPublicRaffleBySlug(slug);
        if (!active) return;
        setRaffle(data.raffle);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load raffle");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading raffle...</div>;
  }

  if (error || !raffle) {
    return <div style={{ padding: 24 }}>Failed to load raffle</div>;
  }

  const singlePriceCents = Number(raffle.ticket_price_cents);
  const offers = raffle.offers ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        <div>
          {raffle.image_url ? (
            <img
              src={raffle.image_url}
              alt={raffle.title}
              style={{
                width: "100%",
                borderRadius: 16,
                display: "block",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                minHeight: 300,
                border: "1px solid #ddd",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              No image
            </div>
          )}
        </div>

        <div>
          <h1>{raffle.title}</h1>
          {raffle.description ? <p>{raffle.description}</p> : null}

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 16,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ opacity: 0.7 }}>Single ticket price</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              £{centsToPounds(singlePriceCents)}
            </div>
          </div>

          {offers.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              <h2>Ticket Bundles</h2>

              {offers
                .filter((offer: RaffleOffer) => offer.is_active !== false)
                .map((offer: RaffleOffer, index: number) => {
                  const priceCents = Number(offer.price_cents);
                  const tickets = Number(offer.ticket_quantity);
                  const perTicketCents = Math.round(priceCents / tickets);
                  const normalTotalCents = singlePriceCents * tickets;
                  const savingCents = normalTotalCents - priceCents;

                  return (
                    <button
                      key={offer.id || index}
                      type="button"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: "1px solid #ddd",
                        borderRadius: 16,
                        padding: 16,
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {offer.label || `${tickets} Tickets`}
                        </div>
                        <div style={{ opacity: 0.75, marginTop: 4 }}>
                          {tickets} for £{centsToPounds(priceCents)} · £
                          {centsToPounds(perTicketCents)} each
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 20 }}>
                          £{centsToPounds(priceCents)}
                        </div>
                        {savingCents > 0 ? (
                          <div style={{ color: "green", marginTop: 4 }}>
                            Save £{centsToPounds(savingCents)}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
