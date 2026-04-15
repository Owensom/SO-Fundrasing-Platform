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

  const [localTenantSlug, setLocalTenantSlug] = useState(
    raffle?.tenant_slug ?? tenantSlug ?? ""
  );
  const [title, setTitle] = useState(raffle?.title ?? "");
  const [slug, setSlug] = useState(raffle?.slug ?? "");
  const [description, setDescription] = useState(raffle?.description ?? "");
  const [imageUrl, setImageUrl] = useState(raffle?.image_url ?? "");
  const [ticketPrice, setTicketPrice] = useState(
    raffle ? centsToPounds(Number(raffle.ticket_price_cents)) : "1.00"
  );
  const [totalTickets, setTotalTickets] = useState(
    Number(raffle?.total_tickets ?? 1000)
  );
  const [status, setStatus] = useState(raffle?.status ?? "draft");

  const [offers, setOffers] = useState<OfferFormRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load offers
  useEffect(() => {
    if (raffle?.offers?.length) {
      setOffers(
        raffle.offers.map((offer: RaffleOffer, index: number) => ({
          label: offer.label ?? "",
          ticket_quantity: Number(offer.ticket_quantity ?? 1),
          price_cents: Number(offer.price_cents ?? 100),
          sort_order:
            typeof offer.sort_order === "number" ? offer.sort_order : index,
          is_active: offer.is_active ?? true,
        }))
      );
    } else {
      setOffers([
        {
          label: "3 Tickets",
          ticket_quantity: 3,
          price_cents: 500,
          sort_order: 0,
          is_active: true,
        },
        {
          label: "10 Tickets",
          ticket_quantity: 10,
          price_cents: 1500,
          sort_order: 1,
          is_active: true,
        },
      ]);
    }
  }, [raffle]);

  const resolvedSlug = useMemo(() => {
    return slug.trim() || slugify(title);
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
    setOffers((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((offer, i) => ({ ...offer, sort_order: i }))
    );
  }

  function updateOffer<K extends keyof OfferFormRow>(
    index: number,
    key: K,
    value: OfferFormRow[K]
  ) {
    setOffers((prev) =>
      prev.map((offer, i) => (i === index ? { ...offer, [key]: value } : offer))
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        tenant_slug: localTenantSlug.trim(),
        title: title.trim(),
        slug: resolvedSlug,
        description: description.trim(),
        image_url: imageUrl.trim(),
        ticket_price_cents: poundsToCents(ticketPrice),
        total_tickets: Number(totalTickets),
        status: status.trim(),
        offers: offers.map((offer, index) => ({
          label: offer.label.trim() || null,
          ticket_quantity: Number(offer.ticket_quantity),
          price_cents: Number(offer.price_cents),
          sort_order: index,
          is_active: Boolean(offer.is_active),
        })),
      };

      // Validation
      if (!payload.tenant_slug) throw new Error("Tenant slug is required");
      if (!payload.title) throw new Error("Title is required");
      if (!payload.slug) throw new Error("Slug is required");

      if (
        !Number.isInteger(payload.ticket_price_cents) ||
        payload.ticket_price_cents <= 0
      ) {
        throw new Error("Single ticket price must be greater than 0");
      }

      if (
        !Number.isInteger(payload.total_tickets) ||
        payload.total_tickets <= 0
      ) {
        throw new Error("Total tickets must be greater than 0");
      }

      const seen = new Set<number>();
      for (const offer of payload.offers) {
        if (!Number.isInteger(offer.ticket_quantity) || offer.ticket_quantity <= 0) {
          throw new Error("Offer ticket quantities must be whole numbers");
        }
        if (!Number.isInteger(offer.price_cents) || offer.price_cents <= 0) {
          throw new Error("Offer prices must be greater than 0");
        }
        if (seen.has(offer.ticket_quantity)) {
          throw new Error(`Duplicate offer for ${offer.ticket_quantity} tickets`);
        }
        seen.add(offer.ticket_quantity);
      }

      if (isEdit && raffle?.id) {
        await updateRaffle(raffle.id, payload);
        setSuccess("Raffle updated");
      } else {
        await createRaffle(payload);
        setSuccess("Raffle created");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save raffle");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>{isEdit ? "Edit Raffle" : "Create Raffle"}</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 20 }}>
        <input placeholder="Tenant Slug" value={localTenantSlug} onChange={(e) => setLocalTenantSlug(e.target.value)} />
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input placeholder="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />

        <input
          type="number"
          step="0.01"
          value={ticketPrice}
          onChange={(e) => setTicketPrice(e.target.value)}
        />

        <input
          type="number"
          value={totalTickets}
          onChange={(e) => setTotalTickets(Number(e.target.value))}
        />

        <input value={status} onChange={(e) => setStatus(e.target.value)} />

        <h2>Offers</h2>

        {offers.map((offer, index) => (
          <div key={index}>
            <input
              value={offer.label}
              onChange={(e) => updateOffer(index, "label", e.target.value)}
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
              step="0.01"
              value={centsToPounds(offer.price_cents)}
              onChange={(e) =>
                updateOffer(index, "price_cents", poundsToCents(e.target.value))
              }
            />
            <input
              type="checkbox"
              checked={offer.is_active}
              onChange={(e) =>
                updateOffer(index, "is_active", e.target.checked)
              }
            />
            <button type="button" onClick={() => removeOffer(index)}>
              X
            </button>
          </div>
        ))}

        <button type="button" onClick={addOffer}>
          Add Offer
        </button>

        {error && <div style={{ color: "red" }}>{error}</div>}
        {success && <div style={{ color: "green" }}>{success}</div>}

        <button type="submit">{saving ? "Saving..." : "Save Raffle"}</button>
      </form>
    </div>
  );
}
