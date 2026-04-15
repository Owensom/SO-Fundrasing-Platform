import React, { useEffect, useMemo, useState } from "react";
import { createRaffle, updateRaffle } from "../../api";
import type { Raffle, RaffleOffer } from "../../types/raffles";

type Props = {
  raffle?: Raffle;
  mode?: "create" | "edit";
  tenantSlug?: string;
};

type OfferFormRow = {
  label: string;
  ticket_quantity: number;
  price_cents: number;
  sort_order: number;
  is_active: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function poundsToCents(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return Math.round(n * 100);
}

function centsToPounds(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function AdminEditRafflePage({
  raffle,
  mode = "edit",
  tenantSlug = "",
}: Props) {
  const isEdit = mode === "edit" && !!raffle?.id;

  const [title, setTitle] = useState(raffle?.title ?? "");
  const [slug, setSlug] = useState(raffle?.slug ?? "");
  const [description, setDescription] = useState(raffle?.description ?? "");
  const [ticketPrice, setTicketPrice] = useState(
    raffle ? centsToPounds(raffle.ticket_price_cents) : "5.00"
  );
  const [totalTickets, setTotalTickets] = useState(
    raffle?.total_tickets ?? 100
  );
  const [status, setStatus] = useState(raffle?.status ?? "published");

  const [offers, setOffers] = useState<OfferFormRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (raffle?.offers?.length) {
      setOffers(
        raffle.offers.map((o, i) => ({
          label: o.label ?? "",
          ticket_quantity: o.ticket_quantity,
          price_cents: o.price_cents,
          sort_order: i,
          is_active: o.is_active ?? true,
        }))
      );
    } else {
      setOffers([
        {
          label: "3 Tickets",
          ticket_quantity: 3,
          price_cents: 1000,
          sort_order: 0,
          is_active: true,
        },
        {
          label: "10 Tickets",
          ticket_quantity: 10,
          price_cents: 2500,
          sort_order: 1,
          is_active: true,
        },
      ]);
    }
  }, [raffle]);

  const resolvedSlug = useMemo(() => {
    return slug || slugify(title);
  }, [slug, title]);

  function addOffer() {
    setOffers((prev) => [
      ...prev,
      {
        label: "",
        ticket_quantity: 1,
        price_cents: 100,
        sort_order: prev.length,
        is_active: true,
      },
    ]);
  }

  function removeOffer(index: number) {
    setOffers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOffer(
    index: number,
    key: keyof OfferFormRow,
    value: any
  ) {
    setOffers((prev) =>
      prev.map((o, i) => (i === index ? { ...o, [key]: value } : o))
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const payload = {
      tenant_slug: tenantSlug,
      title,
      slug: resolvedSlug,
      description,
      ticket_price_cents: poundsToCents(ticketPrice),
      total_tickets: Number(totalTickets),
      status,
      offers: offers.map((o, i) => ({
        label: o.label || null,
        ticket_quantity: Number(o.ticket_quantity),
        price_cents: Number(o.price_cents),
        sort_order: i,
        is_active: o.is_active,
      })),
    };

    if (isEdit && raffle?.id) {
      await updateRaffle(raffle.id, payload);
    } else {
      await createRaffle(payload);
    }

    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Edit raffle</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 20 }}>
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label>Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
        </div>

        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        <div>
          <label>Single ticket price (£)</label>
          <input
            type="number"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(e.target.value)}
          />
        </div>

        <div>
          <label>Total tickets</label>
          <input
            type="number"
            value={totalTickets}
            onChange={(e) => setTotalTickets(Number(e.target.value))}
          />
        </div>

        {/* ✅ MULTIPLE TICKET OFFERS */}
        <div style={{ border: "1px solid #ddd", padding: 16 }}>
          <h2>Multiple ticket offers</h2>

          {offers.map((offer, index) => (
            <div key={index} style={{ display: "flex", gap: 10 }}>
              <input
                placeholder="Label"
                value={offer.label}
                onChange={(e) =>
                  updateOffer(index, "label", e.target.value)
                }
              />

              <input
                type="number"
                value={offer.ticket_quantity}
                onChange={(e) =>
                  updateOffer(index, "ticket_quantity", Number(e.target.value))
                }
              />

              <input
                type="number"
                value={centsToPounds(offer.price_cents)}
                onChange={(e) =>
                  updateOffer(index, "price_cents", poundsToCents(e.target.value))
                }
              />

              <label>
                <input
                  type="checkbox"
                  checked={offer.is_active}
                  onChange={(e) =>
                    updateOffer(index, "is_active", e.target.checked)
                  }
                />
                Active
              </label>

              <button type="button" onClick={() => removeOffer(index)}>
                Remove
              </button>
            </div>
          ))}

          <button type="button" onClick={addOffer}>
            Add offer
          </button>
        </div>

        <button type="submit">
          {saving ? "Saving..." : "Save raffle"}
        </button>
      </form>
    </div>
  );
}
