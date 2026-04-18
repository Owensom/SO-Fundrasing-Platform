"use client";

import { useEffect, useMemo, useState } from "react";

type RaffleStatus = "draft" | "published" | "completed";

type RaffleColour = {
  id: string;
  name: string;
  hex: string;
  sortOrder?: number;
};

type RaffleOffer = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  sortOrder?: number;
  isActive?: boolean;
};

type RaffleConfig = {
  startNumber: number;
  endNumber: number;
  colours: RaffleColour[];
  offers: RaffleOffer[];
};

type AdminRaffle = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  ticket_price_cents: number;
  total_tickets: number;
  currency: string;
  status: RaffleStatus;
  slug: string;
  tenant_slug: string;
  config_json: RaffleConfig;
};

export default function AdminEditRafflePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [raffle, setRaffle] = useState<AdminRaffle | null>(null);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;

    async function run() {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/admin/raffles/${id}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to load raffle");
        setLoading(false);
        return;
      }

      setRaffle(data.raffle);
      setLoading(false);
    }

    run();
  }, [id]);

  const derivedTotalTickets = useMemo(() => {
    if (!raffle) return 0;
    const range =
      raffle.config_json.endNumber - raffle.config_json.startNumber + 1;
    const colourCount = raffle.config_json.colours.length || 1;
    return range * colourCount;
  }, [raffle]);

  async function save(action: "save" | "publish" | "complete") {
    if (!raffle) return;

    setSaving(true);
    setError("");

    const res = await fetch(`/api/admin/raffles/${raffle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: raffle.title,
        description: raffle.description,
        image_url: raffle.image_url,
        ticket_price_cents: raffle.ticket_price_cents,
        total_tickets: derivedTotalTickets,
        currency: raffle.currency,
        config_json: raffle.config_json,
        action,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error || "Save failed");
      setSaving(false);
      return;
    }

    setRaffle(data.raffle);
    setSaving(false);
  }

  async function deleteRaffle() {
    if (!raffle) return;

    const confirmed = window.confirm(
      `Delete raffle "${raffle.title}"? This will also remove its reservations and sales records.`,
    );

    if (!confirmed) return;

    setDeleting(true);
    setError("");

    const res = await fetch(`/api/admin/raffles/${raffle.id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error || "Delete failed");
      setDeleting(false);
      return;
    }

    window.location.href = "/admin/raffles";
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (error && !raffle) return <div style={{ padding: 24 }}>{error}</div>;
  if (!raffle) return <div style={{ padding: 24 }}>Raffle not found</div>;

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: 24 }}>
      <h1>Edit raffle</h1>

      <div style={{ marginBottom: 24 }}>
        <strong>Status:</strong> {raffle.status}
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <label>
          Title
          <input
            value={raffle.title}
            onChange={(e) => setRaffle({ ...raffle, title: e.target.value })}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Description
          <textarea
            value={raffle.description ?? ""}
            onChange={(e) =>
              setRaffle({ ...raffle, description: e.target.value })
            }
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              minHeight: 100,
              marginTop: 6,
            }}
          />
        </label>

        <label>
          Image URL
          <input
            value={raffle.image_url ?? ""}
            onChange={(e) => setRaffle({ ...raffle, image_url: e.target.value })}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Single ticket price (cents)
          <input
            type="number"
            value={raffle.ticket_price_cents}
            onChange={(e) =>
              setRaffle({
                ...raffle,
                ticket_price_cents: Number(e.target.value || 0),
              })
            }
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Currency
          <input
            value={raffle.currency}
            onChange={(e) => setRaffle({ ...raffle, currency: e.target.value })}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <label>
            Start number
            <input
              type="number"
              value={raffle.config_json.startNumber}
              onChange={(e) =>
                setRaffle({
                  ...raffle,
                  config_json: {
                    ...raffle.config_json,
                    startNumber: Number(e.target.value || 1),
                  },
                })
              }
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label>
            End number
            <input
              type="number"
              value={raffle.config_json.endNumber}
              onChange={(e) =>
                setRaffle({
                  ...raffle,
                  config_json: {
                    ...raffle.config_json,
                    endNumber: Number(e.target.value || 1),
                  },
                })
              }
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>
        </div>

        <div>
          <strong>Colours</strong>
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            {raffle.config_json.colours.map((colour, index) => (
              <div
                key={colour.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr auto",
                  gap: 10,
                }}
              >
                <input
                  value={colour.id}
                  onChange={(e) => {
                    const next = [...raffle.config_json.colours];
                    next[index] = { ...next[index], id: e.target.value };
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, colours: next },
                    });
                  }}
                />
                <input
                  value={colour.name}
                  onChange={(e) => {
                    const next = [...raffle.config_json.colours];
                    next[index] = { ...next[index], name: e.target.value };
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, colours: next },
                    });
                  }}
                />
                <input
                  value={colour.hex}
                  onChange={(e) => {
                    const next = [...raffle.config_json.colours];
                    next[index] = { ...next[index], hex: e.target.value };
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, colours: next },
                    });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = raffle.config_json.colours.filter((_, i) => i !== index);
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, colours: next },
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            style={{ marginTop: 10 }}
            onClick={() =>
              setRaffle({
                ...raffle,
                config_json: {
                  ...raffle.config_json,
                  colours: [
                    ...raffle.config_json.colours,
                    {
                      id: `colour-${raffle.config_json.colours.length + 1}`,
                      name: `Colour ${raffle.config_json.colours.length + 1}`,
                      hex: "#000000",
                    },
                  ],
                },
              })
            }
          >
            Add colour
          </button>
        </div>

        <div>
          <strong>Offers</strong>
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            {raffle.config_json.offers.map((offer, index) => (
              <div
                key={offer.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr auto",
                  gap: 10,
                }}
              >
                <input
                  value={offer.label}
                  onChange={(e) => {
                    const next = [...raffle.config_json.offers];
                    next[index] = { ...next[index], label: e.target.value };
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, offers: next },
                    });
                  }}
                />
                <input
                  type="number"
                  value={offer.quantity}
                  onChange={(e) => {
                    const next = [...raffle.config_json.offers];
                    next[index] = {
                      ...next[index],
                      quantity: Number(e.target.value || 1),
                    };
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, offers: next },
                    });
                  }}
                />
                <input
                  type="number"
                  step="0.01"
                  value={offer.price}
                  onChange={(e) => {
                    const next = [...raffle.config_json.offers];
                    next[index] = {
                      ...next[index],
                      price: Number(e.target.value || 0),
                    };
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, offers: next },
                    });
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = raffle.config_json.offers.filter((_, i) => i !== index);
                    setRaffle({
                      ...raffle,
                      config_json: { ...raffle.config_json, offers: next },
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            style={{ marginTop: 10 }}
            onClick={() =>
              setRaffle({
                ...raffle,
                config_json: {
                  ...raffle.config_json,
                  offers: [
                    ...raffle.config_json.offers,
                    {
                      id: `offer-${raffle.config_json.offers.length + 1}`,
                      label: "Offer",
                      quantity: 2,
                      price: 0,
                      isActive: true,
                    },
                  ],
                },
              })
            }
          >
            Add offer
          </button>
        </div>

        <div>
          <strong>Derived total tickets:</strong> {derivedTotalTickets}
        </div>

        {error ? (
          <div style={{ color: "#b91c1c" }}>{error}</div>
        ) : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => save("save")} disabled={saving || deleting}>
            Save draft
          </button>
          <button type="button" onClick={() => save("publish")} disabled={saving || deleting}>
            Publish
          </button>
          <button type="button" onClick={() => save("complete")} disabled={saving || deleting}>
            Complete
          </button>
          <button
            type="button"
            onClick={deleteRaffle}
            disabled={saving || deleting}
            style={{
              background: "#b91c1c",
              color: "#fff",
              border: 0,
              padding: "10px 14px",
              borderRadius: 8,
            }}
          >
            {deleting ? "Deleting..." : "Delete raffle"}
          </button>
        </div>
      </div>
    </div>
  );
}
