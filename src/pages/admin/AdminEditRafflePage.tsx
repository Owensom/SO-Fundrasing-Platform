import React, { useEffect, useMemo, useState } from "react";
import { createRaffle, updateRaffle } from "../../api";
import type { RaffleDetails, RaffleOffer, SaveRaffleInput } from "../../types/raffles";

type Props = {
  raffle?: RaffleDetails;
  mode?: "create" | "edit";
  tenantSlug?: string;
};

type OfferFormRow = {
  label: string;
  tickets: number;
  price: number;
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

function parseColours(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function AdminEditRafflePage({
  raffle,
  mode = "edit",
  tenantSlug = "",
}: Props) {
  const isEdit = mode === "edit" && !!raffle?.id;

  const [localTenantSlug] = useState(tenantSlug ?? "");
  const [title, setTitle] = useState(raffle?.title ?? "");
  const [slug, setSlug] = useState(raffle?.slug ?? "");
  const [description, setDescription] = useState(raffle?.description ?? "");
  const [imageUrl, setImageUrl] = useState(raffle?.image_url ?? "");
  const [ticketPrice, setTicketPrice] = useState(
    raffle?.ticket_price != null ? String(raffle.ticket_price) : "1"
  );
  const [maxTickets, setMaxTickets] = useState(
    raffle?.max_tickets != null ? String(raffle.max_tickets) : "1000"
  );
  const [isActive, setIsActive] = useState(raffle?.is_active ?? true);
  const [drawAt, setDrawAt] = useState(raffle?.draw_at ?? "");
  const [availableColours, setAvailableColours] = useState(
    raffle?.available_colours?.join(", ") ?? ""
  );

  const [offers, setOffers] = useState<OfferFormRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (raffle?.offers?.length) {
      setOffers(
        raffle.offers.map((offer: RaffleOffer, index: number) => ({
          label: offer.label ?? "",
          tickets: Number(offer.tickets ?? 1),
          price: Number(offer.price ?? 1),
          sort_order:
            typeof offer.sort_order === "number" ? offer.sort_order : index,
          is_active: offer.is_active ?? true,
        }))
      );
    } else {
      setOffers([
        {
          label: "3 Tickets",
          tickets: 3,
          price: 5,
          sort_order: 0,
          is_active: true,
        },
        {
          label: "10 Tickets",
          tickets: 10,
          price: 15,
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
        tickets: 1,
        price: 1,
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
      const parsedTicketPrice = Number(ticketPrice);
      const parsedMaxTickets =
        maxTickets.trim() === "" ? null : Number(maxTickets);

      const payload: SaveRaffleInput = {
        title: title.trim(),
        slug: resolvedSlug,
        description: description.trim(),
        image_url: imageUrl.trim(),
        draw_at: drawAt.trim() || null,
        ticket_price: Number.isFinite(parsedTicketPrice) ? parsedTicketPrice : null,
        max_tickets:
          parsedMaxTickets !== null && Number.isFinite(parsedMaxTickets)
            ? parsedMaxTickets
            : null,
        is_active: isActive,
        available_colours: parseColours(availableColours),
        offers: offers.map((offer, index) => ({
          label: offer.label.trim() || `${offer.tickets} Tickets`,
          tickets: Number(offer.tickets),
          price: Number(offer.price),
          sort_order: index,
          is_active: Boolean(offer.is_active),
        })),
      };

      if (!payload.title) throw new Error("Title is required");
      if (!payload.slug) throw new Error("Slug is required");

      if (
        payload.ticket_price !== null &&
        (!Number.isFinite(payload.ticket_price) || payload.ticket_price <= 0)
      ) {
        throw new Error("Single ticket price must be greater than 0");
      }

      if (
        payload.max_tickets !== null &&
        (!Number.isInteger(payload.max_tickets) || payload.max_tickets <= 0)
      ) {
        throw new Error("Max tickets must be greater than 0");
      }

      const seen = new Set<number>();
      for (const offer of payload.offers ?? []) {
        if (!Number.isInteger(offer.tickets) || offer.tickets <= 0) {
          throw new Error("Offer ticket quantities must be whole numbers");
        }
        if (!Number.isFinite(offer.price) || offer.price <= 0) {
          throw new Error("Offer prices must be greater than 0");
        }
        if (seen.has(offer.tickets)) {
          throw new Error(`Duplicate offer for ${offer.tickets} tickets`);
        }
        seen.add(offer.tickets);
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
        {!!localTenantSlug && (
          <div>
            <label>Tenant Slug</label>
            <input
              value={localTenantSlug}
              readOnly
              style={{ width: "100%", padding: 10, opacity: 0.7 }}
            />
          </div>
        )}

        <div>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <label>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Leave blank to auto-generate"
            style={{ width: "100%", padding: 10 }}
          />
          <small>Final slug: {resolvedSlug}</small>
        </div>

        <div>
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <label>Image URL</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <label>Single Ticket Price (£)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={ticketPrice}
            onChange={(e) => setTicketPrice(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <label>Max Tickets</label>
          <input
            type="number"
            min={1}
            value={maxTickets}
            onChange={(e) => setMaxTickets(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <label>Draw At</label>
          <input
            type="datetime-local"
            value={drawAt}
            onChange={(e) => setDrawAt(e.target.value)}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <label>Available Colours</label>
          <input
            value={availableColours}
            onChange={(e) => setAvailableColours(e.target.value)}
            placeholder="e.g. red, blue, green"
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active
        </label>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0 }}>Offer Pricing</h2>
            <button type="button" onClick={addOffer}>
              Add Offer
            </button>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {offers.map((offer, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 12,
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr auto auto",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div>
                  <label>Label</label>
                  <input
                    value={offer.label}
                    onChange={(e) => updateOffer(index, "label", e.target.value)}
                    placeholder="e.g. 10 Tickets"
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>

                <div>
                  <label>Tickets</label>
                  <input
                    type="number"
                    min={1}
                    value={offer.tickets}
                    onChange={(e) =>
                      updateOffer(index, "tickets", Number(e.target.value))
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>

                <div>
                  <label>Price (£)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={offer.price}
                    onChange={(e) =>
                      updateOffer(index, "price", Number(e.target.value))
                    }
                    style={{ width: "100%", padding: 10 }}
                  />
                </div>

                <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
          </div>
        </div>

        {error ? <div style={{ color: "red" }}>{error}</div> : null}
        {success ? <div style={{ color: "green" }}>{success}</div> : null}

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Raffle" : "Create Raffle"}
        </button>
      </form>
    </div>
  );
}
