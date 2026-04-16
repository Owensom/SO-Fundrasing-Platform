import React, { useState } from "react";

type Offer = {
  label: string;
  tickets: number;
  price: number;
  is_active: boolean;
};

export default function CreateRafflePage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState(5);
  const [totalTickets, setTotalTickets] = useState(100);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function addOffer() {
    setOffers((prev) => [
      ...prev,
      { label: "", tickets: 1, price: 1, is_active: true },
    ]);
  }

  function updateOffer(index: number, key: keyof Offer, value: any) {
    setOffers((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [key]: value } : o))
    );
  }

  function removeOffer(index: number) {
    setOffers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantSlug: "demo-a",
          title,
          slug,
          description,
          ticketPrice,
          totalTickets,
          offers,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to create raffle");
      }

      setMessage("✅ Raffle created successfully");
      setTitle("");
      setSlug("");
      setDescription("");
      setOffers([]);
    } catch (err: any) {
      setMessage("❌ " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "40px auto" }}>
      <h1>Create raffle</h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          placeholder="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          value={ticketPrice}
          onChange={(e) => setTicketPrice(Number(e.target.value))}
        />

        <input
          type="number"
          value={totalTickets}
          onChange={(e) => setTotalTickets(Number(e.target.value))}
        />

        <h2>Offers</h2>

        {offers.map((offer, i) => (
          <div key={i} style={{ border: "1px solid #ccc", padding: 10 }}>
            <input
              placeholder="Label"
              value={offer.label}
              onChange={(e) =>
                updateOffer(i, "label", e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Tickets"
              value={offer.tickets}
              onChange={(e) =>
                updateOffer(i, "tickets", Number(e.target.value))
              }
            />

            <input
              type="number"
              placeholder="Price"
              value={offer.price}
              onChange={(e) =>
                updateOffer(i, "price", Number(e.target.value))
              }
            />

            <button type="button" onClick={() => removeOffer(i)}>
              Remove
            </button>
          </div>
        ))}

        <button type="button" onClick={addOffer}>
          + Add offer
        </button>

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Create raffle"}
        </button>

        {message && <div>{message}</div>}
      </form>
    </div>
  );
}
