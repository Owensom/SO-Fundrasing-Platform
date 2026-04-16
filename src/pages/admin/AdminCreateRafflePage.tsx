import React, { useEffect, useMemo, useState } from "react";

type Offer = {
  label: string;
  price: number;
  quantity: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

const presetColours = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#111827",
  "#ffffff",
];

export default function AdminCreateRafflePage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(100);
  const [ticketPrice, setTicketPrice] = useState(1);

  const [offers, setOffers] = useState<Offer[]>([
    { label: "5 for £4", price: 4, quantity: 5 },
  ]);

  const [colours, setColours] = useState<string[]>(["#ef4444", "#3b82f6"]);
  const [colourInput, setColourInput] = useState("#22c55e");
  const [autoSlug, setAutoSlug] = useState(true);

  useEffect(() => {
    if (autoSlug) {
      setSlug(slugify(title));
    }
  }, [title, autoSlug]);

  const totalTickets = useMemo(() => {
    if (!Number.isFinite(startNumber) || !Number.isFinite(endNumber)) return 0;
    if (endNumber < startNumber) return 0;
    return endNumber - startNumber + 1;
  }, [startNumber, endNumber]);

  const numberPreview = useMemo(() => {
    const maxPreview = 12;
    if (totalTickets <= 0) return [];
    return Array.from(
      { length: Math.min(totalTickets, maxPreview) },
      (_, i) => startNumber + i
    );
  }, [startNumber, totalTickets]);

  function addOffer() {
    setOffers((prev) => [...prev, { label: "", price: 0, quantity: 2 }]);
  }

  function updateOffer(index: number, field: keyof Offer, value: string | number) {
    setOffers((prev) =>
      prev.map((offer, i) =>
        i === index ? { ...offer, [field]: value } : offer
      )
    );
  }

  function removeOffer(index: number) {
    setOffers((prev) => prev.filter((_, i) => i !== index));
  }

  function addColour(value?: string) {
    const next = (value ?? colourInput).trim();
    if (!next) return;
    if (colours.includes(next)) return;
    setColours((prev) => [...prev, next]);
  }

  function removeColour(colour: string) {
    setColours((prev) => prev.filter((c) => c !== colour));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const payload = {
      title,
      slug,
      description,
      imageUrl,
      startNumber,
      endNumber,
      totalTickets,
      ticketPrice,
      offers: offers.filter((offer) => offer.label.trim() && offer.quantity > 0),
      colours,
    };

    console.log("Create raffle payload:", payload);
    alert("Enhanced create page is working. Next step is wiring this to your API.");
  }

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: 24,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 32 }}>Create Raffle</h1>
        <p style={{ marginTop: 8, color: "#4b5563" }}>
          Set up raffle details, number range, pricing, offers, and colours.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 0.9fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 24 }}>
            <section
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Basic details</h2>

              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={labelStyle} htmlFor="title">
                    Raffle title
                  </label>
                  <input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Win a signed shirt"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <label style={labelStyle} htmlFor="slug">
                      Slug
                    </label>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "#4b5563",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={autoSlug}
                        onChange={(e) => setAutoSlug(e.target.checked)}
                      />
                      Auto-generate from title
                    </label>
                  </div>

                  <input
                    id="slug"
                    value={slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      setSlug(slugify(e.target.value));
                    }}
                    placeholder="win-a-signed-shirt"
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="description">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add prize details, draw date, and anything buyers should know."
                    rows={5}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="imageUrl">
                    Image URL
                  </label>
                  <input
                    id="imageUrl"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    style={inputStyle}
                  />
                </div>
              </div>
            </section>

            <section
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Tickets and pricing</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label style={labelStyle} htmlFor="startNumber">
                    Start number
                  </label>
                  <input
                    id="startNumber"
                    type="number"
                    value={startNumber}
                    onChange={(e) => setStartNumber(Number(e.target.value))}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="endNumber">
                    End number
                  </label>
                  <input
                    id="endNumber"
                    type="number"
                    value={endNumber}
                    onChange={(e) => setEndNumber(Number(e.target.value))}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="ticketPrice">
                    Single ticket price (£)
                  </label>
                  <input
                    id="ticketPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 12,
                }}
              >
                <div>
                  <div style={statLabelStyle}>Total tickets</div>
                  <div style={statValueStyle}>{totalTickets}</div>
                </div>
                <div>
                  <div style={statLabelStyle}>Range</div>
                  <div style={statValueStyle}>
                    {startNumber}–{endNumber}
                  </div>
                </div>
                <div>
                  <div style={statLabelStyle}>Max revenue</div>
                  <div style={statValueStyle}>
                    £{formatMoney(totalTickets * ticketPrice)}
                  </div>
                </div>
              </div>
            </section>

            <section
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <h2 style={{ margin: 0 }}>Offers</h2>
                <button type="button" onClick={addOffer} style={secondaryButtonStyle}>
                  Add offer
                </button>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {offers.length === 0 ? (
                  <div
                    style={{
                      padding: 16,
                      border: "1px dashed #d1d5db",
                      borderRadius: 12,
                      color: "#6b7280",
                    }}
                  >
                    No offers yet. Buyers will only see the single ticket price.
                  </div>
                ) : (
                  offers.map((offer, index) => (
                    <div
                      key={index}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: 16,
                        background: "#fafafa",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 1fr auto",
                          gap: 12,
                          alignItems: "end",
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Label</label>
                          <input
                            value={offer.label}
                            onChange={(e) =>
                              updateOffer(index, "label", e.target.value)
                            }
                            placeholder="e.g. 10 for £8"
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Price (£)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={offer.price}
                            onChange={(e) =>
                              updateOffer(index, "price", Number(e.target.value))
                            }
                            style={inputStyle}
                          />
                        </div>

                        <div>
                          <label style={labelStyle}>Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={offer.quantity}
                            onChange={(e) =>
                              updateOffer(index, "quantity", Number(e.target.value))
                            }
                            style={inputStyle}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeOffer(index)}
                          style={dangerButtonStyle}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section
              style={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 20,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Colours</h2>

              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Quick add presets</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {presetColours.map((colour) => (
                      <button
                        key={colour}
                        type="button"
                        onClick={() => addColour(colour)}
                        title={colour}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "999px",
                          border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                          background: colour,
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    value={colourInput}
                    onChange={(e) => setColourInput(e.target.value)}
                    placeholder="#22c55e or green"
                    style={{ ...inputStyle, maxWidth: 220 }}
                  />
                  <button type="button" onClick={() => addColour()} style={secondaryButtonStyle}>
                    Add colour
                  </button>
                </div>

                <div>
                  <label style={labelStyle}>Selected colours</label>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {colours.length === 0 ? (
                      <div style={{ color: "#6b7280" }}>No colours added yet.</div>
                    ) : (
                      colours.map((colour) => (
                        <div
                          key={colour}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            border: "1px solid #e5e7eb",
                            borderRadius: 999,
                            padding: "6px 10px 6px 6px",
                            background: "#fff",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => removeColour(colour)}
                            title={`Remove ${colour}`}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: "999px",
                              border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                              background: colour,
                              cursor: "pointer",
                            }}
                          />
                          <span style={{ fontSize: 13 }}>{colour}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div style={{ display: "flex", justifyContent: "flex-start", gap: 12 }}>
              <button type="submit" style={primaryButtonStyle}>
                Create raffle
              </button>
            </div>
          </div>

          <aside
            style={{
              position: "sticky",
              top: 24,
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Live preview</h2>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <div
                style={{
                  height: 180,
                  background: imageUrl
                    ? `center / cover no-repeat url(${imageUrl})`
                    : "linear-gradient(135deg, #dbeafe 0%, #f5d0fe 100%)",
                  display: "flex",
                  alignItems: "end",
                  padding: 16,
                  color: "#111827",
                  fontWeight: 700,
                  fontSize: 22,
                }}
              >
                {title || "Your raffle title"}
              </div>

              <div style={{ padding: 16 }}>
                <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                  /r/{slug || "your-slug"}
                </div>

                <p style={{ marginTop: 0, color: "#374151", lineHeight: 1.5 }}>
                  {description || "Your raffle description will appear here."}
                </p>

                <div style={{ marginTop: 16 }}>
                  <div style={previewHeadingStyle}>Ticket details</div>
                  <div style={previewTextStyle}>
                    Numbers {startNumber} to {endNumber}
                  </div>
                  <div style={previewTextStyle}>
                    {totalTickets} total tickets
                  </div>
                  <div style={previewTextStyle}>
                    Single ticket £{formatMoney(ticketPrice)}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={previewHeadingStyle}>Offers</div>
                  {offers.filter((o) => o.label.trim()).length === 0 ? (
                    <div style={previewTextStyle}>No offers added</div>
                  ) : (
                    offers
                      .filter((o) => o.label.trim())
                      .map((offer, index) => (
                        <div key={`${offer.label}-${index}`} style={previewTextStyle}>
                          {offer.label} — £{formatMoney(offer.price)}
                        </div>
                      ))
                  )}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={previewHeadingStyle}>Colours</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {colours.length === 0 ? (
                      <div style={previewTextStyle}>No colours selected</div>
                    ) : (
                      colours.map((colour) => (
                        <div
                          key={colour}
                          title={colour}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "999px",
                            background: colour,
                            border: colour === "#ffffff" ? "1px solid #d1d5db" : "none",
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div style={previewHeadingStyle}>Number preview</div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 8,
                    }}
                  >
                    {numberPreview.map((n) => (
                      <div
                        key={n}
                        style={{
                          padding: "10px 8px",
                          borderRadius: 10,
                          background: "#f3f4f6",
                          textAlign: "center",
                          fontWeight: 600,
                        }}
                      >
                        {n}
                      </div>
                    ))}
                  </div>
                  {totalTickets > numberPreview.length && (
                    <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                      + {totalTickets - numberPreview.length} more numbers
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "12px 18px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  marginBottom: 6,
};

const statValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#111827",
};

const previewHeadingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#6b7280",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const previewTextStyle: React.CSSProperties = {
  fontSize: 14,
  color: "#111827",
  marginBottom: 6,
};
