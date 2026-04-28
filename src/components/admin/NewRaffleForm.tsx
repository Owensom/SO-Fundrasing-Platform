"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  tenantSlug: string;
};

type OfferRow = {
  id: string;
  label: string;
  price: string;
  quantity: string;
  is_active: boolean;
  sort_order: number;
};

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

const PRESET_COLOURS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
  "Black",
  "White",
  "Gold",
  "Silver",
];

const IMAGE_POSITIONS = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeOffer(id: string, label = "", price = "", quantity = ""): OfferRow {
  return {
    id,
    label,
    price,
    quantity,
    is_active: true,
    sort_order: 0,
  };
}

function makePrize(
  id: string,
  position = "1",
  title = "",
  description = "",
): PrizeRow {
  return {
    id,
    position,
    title,
    description,
    is_public: true,
  };
}

function toInt(value: string, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export default function NewRaffleForm({ tenantSlug }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [drawAt, setDrawAt] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imagePosition, setImagePosition] = useState("center");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [startNumber, setStartNumber] = useState("1");
  const [endNumber, setEndNumber] = useState("10");

  const [selectedColours, setSelectedColours] = useState<string[]>([
    "Red",
    "Blue",
  ]);
  const [customColour, setCustomColour] = useState("");

  const [offers, setOffers] = useState<OfferRow[]>([
    makeOffer("offer-1", "3 for 12", "12", "3"),
    makeOffer("offer-2", "5 for 18", "18", "5"),
  ]);

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "", ""),
  ]);

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

  const coloursValue = useMemo(
    () => selectedColours.join(","),
    [selectedColours],
  );

  const offersValue = useMemo(() => {
    const clean = offers
      .map((offer, index) => ({
        id: offer.id,
        label: offer.label.trim(),
        price: Number(offer.price),
        quantity: Number(offer.quantity),
        is_active: Boolean(offer.is_active),
        sort_order: index,
      }))
      .filter(
        (offer) =>
          offer.label &&
          Number.isFinite(offer.price) &&
          offer.price > 0 &&
          Number.isFinite(offer.quantity) &&
          offer.quantity > 0,
      );

    return JSON.stringify(clean);
  }, [offers]);

  const prizesValue = useMemo(() => {
    const clean = prizes
      .map((prize, index) => {
        const position = Number(prize.position);

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title: prize.title.trim(),
          name: prize.title.trim(),
          description: prize.description.trim(),
          isPublic: Boolean(prize.is_public),
          is_public: Boolean(prize.is_public),
          sortOrder: index,
          sort_order: index,
        };
      })
      .filter((prize) => prize.title);

    return JSON.stringify(clean);
  }, [prizes]);

  const numbersPerColour = useMemo(() => {
    const start = toInt(startNumber, 1);
    const end = toInt(endNumber, 1);
    return end >= start ? end - start + 1 : 0;
  }, [startNumber, endNumber]);

  const totalTickets = useMemo(() => {
    return numbersPerColour * selectedColours.length;
  }, [numbersPerColour, selectedColours.length]);

  function toggleColour(colour: string) {
    setSelectedColours((current) =>
      current.includes(colour)
        ? current.filter((item) => item !== colour)
        : [...current, colour],
    );
  }

  function addCustomColour() {
    const value = customColour.trim();
    if (!value) return;

    setSelectedColours((current) =>
      current.includes(value) ? current : [...current, value],
    );
    setCustomColour("");
  }

  function updateOffer(id: string, patch: Partial<OfferRow>) {
    setOffers((current) =>
      current.map((offer) =>
        offer.id === id ? { ...offer, ...patch } : offer,
      ),
    );
  }

  function addOffer() {
    setOffers((current) => [
      ...current,
      makeOffer(`offer-${crypto.randomUUID()}`),
    ]);
  }

  function removeOffer(id: string) {
    setOffers((current) => current.filter((offer) => offer.id !== id));
  }

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setPrizes((current) =>
      current.map((prize) =>
        prize.id === id ? { ...prize, ...patch } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      makePrize(`prize-${crypto.randomUUID()}`, String(current.length + 1)),
    ]);
  }

  function removePrize(id: string) {
    setPrizes((current) => current.filter((prize) => prize.id !== id));
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadError("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });

      const text = await response.text();

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`Upload API did not return JSON: ${text.slice(0, 120)}`);
      }

      if (!response.ok || !parsed?.ok) {
        throw new Error(parsed?.error || "Upload failed");
      }

      setImageUrl(String(parsed.url ?? ""));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <form
      action="/api/admin/raffles"
      method="post"
      style={{ display: "grid", gap: 16, marginTop: 24, maxWidth: 760 }}
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="image_url" value={imageUrl} />
      <input type="hidden" name="image_position" value={imagePosition} />
      <input type="hidden" name="colours" value={coloursValue} />
      <input type="hidden" name="offers" value={offersValue} />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="total_tickets" value={String(totalTickets)} />

      <label>
        <div style={{ marginBottom: 6 }}>Title</div>
        <input
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: "100%", padding: 12 }}
          placeholder="Spring Cash Raffle"
        />
      </label>

      <label>
        <div style={{ marginBottom: 6 }}>Slug</div>
        <input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
          style={{ width: "100%", padding: 12 }}
          placeholder="spring-cash-raffle"
        />
      </label>

      <label>
        <div style={{ marginBottom: 6 }}>Description</div>
        <textarea
          name="description"
          rows={4}
          style={{ width: "100%", padding: 12 }}
          placeholder="Describe the raffle..."
        />
      </label>

      <label>
        <div style={{ marginBottom: 6 }}>Draw date</div>
        <input
          name="draw_at"
          type="datetime-local"
          value={drawAt}
          onChange={(e) => setDrawAt(e.target.value)}
          style={{ width: "100%", padding: 12 }}
        />
        <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
          Optional. This will be shown to buyers and in admin.
        </div>
      </label>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Image</div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 9999,
              background: "#1683f8",
              color: "#fff",
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? "Uploading..." : "Upload image"}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>

          {imageUrl ? (
            <span style={{ color: "#166534", fontWeight: 600 }}>
              Image uploaded
            </span>
          ) : (
            <span style={{ color: "#64748b" }}>No image uploaded yet</span>
          )}
        </div>

        {imageUrl ? (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: "100%", padding: 12 }}
              placeholder="https://..."
            />
            <img
              src={imageUrl}
              alt="Raffle preview"
              style={{
                width: 180,
                height: 180,
                objectFit: "cover",
                objectPosition: imagePosition,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
              }}
            />
          </div>
        ) : (
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            style={{ width: "100%", padding: 12 }}
            placeholder="Or paste image URL"
          />
        )}

        <label>
          <div style={{ marginBottom: 6 }}>Image focus</div>
          <select
            value={imagePosition}
            onChange={(e) => setImagePosition(e.target.value)}
            style={{ width: "100%", padding: 12 }}
          >
            {IMAGE_POSITIONS.map((position) => (
              <option key={position.value} value={position.value}>
                {position.label}
              </option>
            ))}
          </select>
        </label>

        {uploadError ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
            }}
          >
            {uploadError}
          </div>
        ) : null}
      </div>

      <label>
        <div style={{ marginBottom: 6 }}>Currency</div>
        <select
          name="currency"
          defaultValue="EUR"
          style={{ width: "100%", padding: 12 }}
        >
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
          <option value="USD">USD</option>
        </select>
      </label>

      <label>
        <div style={{ marginBottom: 6 }}>Single ticket price</div>
        <input
          name="ticket_price"
          type="number"
          min="0"
          step="0.01"
          defaultValue="5"
          style={{ width: "100%", padding: 12 }}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label>
          <div style={{ marginBottom: 6 }}>Start number</div>
          <input
            name="startNumber"
            type="number"
            min="0"
            step="1"
            value={startNumber}
            onChange={(e) => setStartNumber(e.target.value)}
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>End number</div>
          <input
            name="endNumber"
            type="number"
            min="0"
            step="1"
            value={endNumber}
            onChange={(e) => setEndNumber(e.target.value)}
            style={{ width: "100%", padding: 12 }}
          />
        </label>
      </div>

      <div
        style={{
          display: "grid",
          gap: 8,
          padding: 14,
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
        }}
      >
        <div>
          <strong>Numbers per colour:</strong> {numbersPerColour}
        </div>
        <div>
          <strong>Selected colours:</strong> {selectedColours.length}
        </div>
        <div>
          <strong>Total tickets:</strong> {totalTickets}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Colours</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {PRESET_COLOURS.map((colour) => {
            const active = selectedColours.includes(colour);
            return (
              <button
                key={colour}
                type="button"
                onClick={() => toggleColour(colour)}
                style={{
                  border: "none",
                  borderRadius: 9999,
                  padding: "10px 14px",
                  background: active ? "#1683f8" : "#e2e8f0",
                  color: active ? "#fff" : "#111827",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {colour}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={customColour}
            onChange={(e) => setCustomColour(e.target.value)}
            style={{ flex: 1, padding: 12 }}
            placeholder="Add custom colour"
          />
          <button
            type="button"
            onClick={addCustomColour}
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Add
          </button>
        </div>

        <div style={{ color: "#475569" }}>
          Selected:{" "}
          {selectedColours.length ? selectedColours.join(", ") : "None"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 600 }}>Offers</div>
          <button
            type="button"
            onClick={addOffer}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Add offer
          </button>
        </div>

        {offers.map((offer) => (
          <div
            key={offer.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr auto auto",
              gap: 10,
              alignItems: "center",
              padding: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 12,
            }}
          >
            <input
              value={offer.label}
              onChange={(e) => updateOffer(offer.id, { label: e.target.value })}
              placeholder="3 for 12"
              style={{ padding: 12 }}
            />
            <input
              value={offer.price}
              onChange={(e) => updateOffer(offer.id, { price: e.target.value })}
              placeholder="12"
              type="number"
              min="0"
              step="0.01"
              style={{ padding: 12 }}
            />
            <input
              value={offer.quantity}
              onChange={(e) =>
                updateOffer(offer.id, { quantity: e.target.value })
              }
              placeholder="3"
              type="number"
              min="1"
              step="1"
              style={{ padding: 12 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={offer.is_active}
                onChange={(e) =>
                  updateOffer(offer.id, { is_active: e.target.checked })
                }
              />
              Active
            </label>
            <button
              type="button"
              onClick={() => removeOffer(offer.id)}
              disabled={offers.length <= 1}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #fecaca",
                background: "#fff",
                color: "#b91c1c",
                cursor: offers.length <= 1 ? "not-allowed" : "pointer",
                opacity: offers.length <= 1 ? 0.6 : 1,
              }}
            >
              Remove
            </button>
          </div>
        ))}

        <div style={{ color: "#475569" }}>
          Offers are saved automatically from the rows above.
        </div>
      </div>

      <section
        style={{
          display: "grid",
          gap: 12,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          background: "#fff",
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Prize Settings</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Choose what prizes are visible on the public raffle page.
          </div>
        </div>

        {prizes.map((prize) => (
          <div
            key={prize.id}
            style={{
              display: "grid",
              gap: 10,
              padding: 12,
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              background: "#f8fafc",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "90px 1fr auto",
                gap: 10,
                alignItems: "end",
              }}
            >
              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Position
                </span>
                <input
                  value={prize.position}
                  onChange={(e) =>
                    updatePrize(prize.id, { position: e.target.value })
                  }
                  type="number"
                  min="1"
                  step="1"
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Prize title
                </span>
                <input
                  value={prize.title}
                  onChange={(e) =>
                    updatePrize(prize.id, { title: e.target.value })
                  }
                  placeholder="Prize title"
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => removePrize(prize.id)}
                disabled={prizes.length <= 1}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fff",
                  color: "#b91c1c",
                  cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                  opacity: prizes.length <= 1 ? 0.6 : 1,
                }}
              >
                Remove
              </button>
            </div>

            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                Description optional
              </span>
              <textarea
                value={prize.description}
                onChange={(e) =>
                  updatePrize(prize.id, { description: e.target.value })
                }
                rows={2}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={prize.is_public}
                onChange={(e) =>
                  updatePrize(prize.id, { is_public: e.target.checked })
                }
              />
              Show this prize on public page
            </label>
          </div>
        ))}

        <button
          type="button"
          onClick={addPrize}
          style={{
            width: "fit-content",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Add prize
        </button>
      </section>

      <label>
        <div style={{ marginBottom: 6 }}>Status</div>
        <select
          name="status"
          defaultValue="draft"
          style={{ width: "100%", padding: 12 }}
        >
          <option value="draft">draft</option>
          <option value="published">published</option>
          <option value="closed">closed</option>
        </select>
      </label>

      <button
        type="submit"
        style={{
          width: "100%",
          padding: 14,
          border: "none",
          borderRadius: 9999,
          background: "#1683f8",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Create raffle
      </button>
    </form>
  );
}
