import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type Offer = {
  id: string;
  label: string;
  price: number;
  quantity: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function money(value: number) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

const colourPresets = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#111827",
  "#6b7280",
  "#ffffff",
];

const offerTemplates = [
  { label: "3 for £5", quantity: 3, price: 5 },
  { label: "5 for £8", quantity: 5, price: 8 },
  { label: "10 for £15", quantity: 10, price: 15 },
  { label: "20 for £25", quantity: 20, price: 25 },
];

export default function AdminRaffleEditPage() {
  const router = useRouter();
  const routeId = typeof router.query.id === "string" ? router.query.id : "";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [startNumber, setStartNumber] = useState(1);
  const [endNumber, setEndNumber] = useState(100);
  const [ticketPrice, setTicketPrice] = useState(2);

  const [autoSlug, setAutoSlug] = useState(false);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [colours, setColours] = useState<string[]>([]);
  const [customColour, setCustomColour] = useState("#8b5cf6");

  useEffect(() => {
    if (!router.isReady) return;

    // Replace with real fetch later
    const timer = setTimeout(() => {
      setTitle("SO Foundation Demo Raffle");
      setSlug("so-foundation-demo-raffle");
      setDescription(
        "Edit your raffle details, pricing, offers and available colours from this page."
      );
      setImageUrl("");
      setStartNumber(1);
      setEndNumber(200);
      setTicketPrice(2);
      setOffers([
        { id: uid(), label: "5 for £8", quantity: 5, price: 8 },
        { id: uid(), label: "10 for £15", quantity: 10, price: 15 },
      ]);
      setColours(["#ef4444", "#3b82f6", "#22c55e"]);
      setIsLoading(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [router.isReady, routeId]);

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

  const expectedRevenue = useMemo(() => {
    return totalTickets * ticketPrice;
  }, [totalTickets, ticketPrice]);

  const numbersPreview = useMemo(() => {
    if (totalTickets <= 0) return [];
    const max = Math.min(totalTickets, 24);
    return Array.from({ length: max }, (_, i) => startNumber + i);
  }, [startNumber, totalTickets]);

  const validOffers = useMemo(() => {
    return offers
      .filter((o) => o.label.trim() && o.quantity > 0 && o.price >= 0)
      .sort((a, b) => a.quantity - b.quantity);
  }, [offers]);

  const bestOffer = useMemo(() => {
    if (validOffers.length === 0) return null;

    const ranked = [...validOffers].sort((a, b) => {
      const aPerTicket = a.price / a.quantity;
      const bPerTicket = b.price / b.quantity;
      return aPerTicket - bPerTicket;
    });

    return ranked[0];
  }, [validOffers]);

  function addBlankOffer() {
    setOffers((prev) => [
      ...prev,
      { id: uid(), label: "", quantity: 2, price: 0 },
    ]);
  }

  function addTemplateOffer(template: { label: string; quantity: number; price: number }) {
    setOffers((prev) => [
      ...prev,
      {
        id: uid(),
        label: template.label,
        quantity: template.quantity,
        price: template.price,
      },
    ]);
  }

  function updateOffer(id: string, field: keyof Offer, value: string | number) {
    setOffers((prev) =>
      prev.map((offer) =>
        offer.id === id ? { ...offer, [field]: value } : offer
      )
    );
  }

  function removeOffer(id: string) {
    setOffers((prev) => prev.filter((offer) => offer.id !== id));
  }

  function addColour(colour: string) {
    const next = colour.trim();
    if (!next) return;
    if (colours.includes(next)) return;
    setColours((prev) => [...prev, next]);
  }

  function removeColour(colour: string) {
    setColours((prev) => prev.filter((c) => c !== colour));
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);

    const payload = {
      id: routeId,
      title,
      slug,
      description,
      imageUrl,
      startNumber,
      endNumber,
      totalTickets,
      ticketPrice,
      offers: validOffers,
      colours,
    };

    console.log("Update raffle payload:", payload);

    setTimeout(() => {
      setIsSaving(false);
      alert("Raffle saved");
    }, 500);
  }

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={loadingCardStyle}>Loading raffle…</div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <form onSubmit={handleSave}>
        <div style={topBarStyle}>
          <div>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={pageTitleStyle}>Edit raffle</h1>
            <p style={pageSubtitleStyle}>
              Update raffle details, pricing, offers, colours and preview.
            </p>
            <div style={metaTextStyle}>Raffle: {routeId || "demo-raffle"}</div>
          </div>

          <div style={topActionsStyle}>
            <button
              type="button"
              style={ghostButtonStyle}
              onClick={() => router.back()}
            >
              Back
            </button>
            <button
              type="submit"
              style={primaryButtonStyle}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>

        <div style={statsGridStyle}>
          <StatCard label="Ticket range" value={`${startNumber}–${endNumber}`} />
          <StatCard label="Total tickets" value={`${totalTickets}`} />
          <StatCard label="Single price" value={`£${money(ticketPrice)}`} />
          <StatCard label="Max revenue" value={`£${money(expectedRevenue)}`} />
        </div>

        <div style={layoutStyle}>
          <div style={leftColumnStyle}>
            <SectionCard
              title="Raffle details"
              subtitle="Core details buyers will see on the public page."
            >
              <div style={fieldGridStyle}>
                <Field label="Title">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Win a signed shirt"
                    style={inputStyle}
                    required
                  />
                </Field>

                <Field label="Slug">
                  <div style={{ display: "grid", gap: 8 }}>
                    <input
                      value={slug}
                      onChange={(e) => {
                        setAutoSlug(false);
                        setSlug(slugify(e.target.value));
                      }}
                      placeholder="win-a-signed-shirt"
                      style={inputStyle}
                      required
                    />
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        checked={autoSlug}
                        onChange={(e) => setAutoSlug(e.target.checked)}
                      />
                      Auto-generate from title
                    </label>
                  </div>
                </Field>
              </div>

              <div style={{ marginTop: 18 }}>
                <Field label="Description">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Prize details, draw date, collection info, sponsor details..."
                    rows={5}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </Field>
              </div>

              <div style={{ marginTop: 18 }}>
                <Field label="Image URL">
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Ticket setup"
              subtitle="Define the number range and base ticket price."
            >
              <div style={threeColGridStyle}>
                <Field label="Start number">
                  <input
                    type="number"
                    value={startNumber}
                    onChange={(e) => setStartNumber(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>

                <Field label="End number">
                  <input
                    type="number"
                    value={endNumber}
                    onChange={(e) => setEndNumber(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Single ticket price (£)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(Number(e.target.value))}
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div style={infoStripStyle}>
                <div>
                  <div style={infoStripLabelStyle}>Range</div>
                  <div style={infoStripValueStyle}>
                    {startNumber} to {endNumber}
                  </div>
                </div>
                <div>
                  <div style={infoStripLabelStyle}>Tickets</div>
                  <div style={infoStripValueStyle}>{totalTickets}</div>
                </div>
                <div>
                  <div style={infoStripLabelStyle}>Revenue if sold out</div>
                  <div style={infoStripValueStyle}>£{money(expectedRevenue)}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Offers"
              subtitle="Create bundles to encourage larger purchases."
              rightAction={
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={addBlankOffer}
                >
                  Add custom offer
                </button>
              }
            >
              <div style={{ marginBottom: 16 }}>
                <div style={subtleLabelStyle}>Quick templates</div>
                <div style={templateRowStyle}>
                  {offerTemplates.map((template) => (
                    <button
                      key={template.label}
                      type="button"
                      style={templateButtonStyle}
                      onClick={() => addTemplateOffer(template)}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {offers.length === 0 ? (
                  <EmptyState text="No offers added yet." />
                ) : (
                  offers.map((offer) => {
                    const pricePerTicket =
                      offer.quantity > 0 ? offer.price / offer.quantity : 0;

                    return (
                      <div key={offer.id} style={offerCardStyle}>
                        <div style={offerGridStyle}>
                          <Field label="Label">
                            <input
                              value={offer.label}
                              onChange={(e) =>
                                updateOffer(offer.id, "label", e.target.value)
                              }
                              placeholder="e.g. 10 for £15"
                              style={inputStyle}
                            />
                          </Field>

                          <Field label="Quantity">
                            <input
                              type="number"
                              min="1"
                              value={offer.quantity}
                              onChange={(e) =>
                                updateOffer(
                                  offer.id,
                                  "quantity",
                                  Number(e.target.value)
                                )
                              }
                              style={inputStyle}
                            />
                          </Field>

                          <Field label="Price (£)">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={offer.price}
                              onChange={(e) =>
                                updateOffer(
                                  offer.id,
                                  "price",
                                  Number(e.target.value)
                                )
                              }
                              style={inputStyle}
                            />
                          </Field>

                          <div style={{ display: "flex", alignItems: "end" }}>
                            <button
                              type="button"
                              style={dangerButtonStyle}
                              onClick={() => removeOffer(offer.id)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div style={offerMetaStyle}>
                          <span>£{money(pricePerTicket)} per ticket</span>
                          <span>vs base £{money(ticketPrice)} each</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Colours"
              subtitle="Choose the colours buyers can assign to their selections."
            >
              <div style={{ display: "grid", gap: 18 }}>
                <div>
                  <div style={subtleLabelStyle}>Preset swatches</div>
                  <div style={swatchGridStyle}>
                    {colourPresets.map((colour) => (
                      <button
                        key={colour}
                        type="button"
                        onClick={() => addColour(colour)}
                        title={colour}
                        style={{
                          ...swatchButtonStyle,
                          background: colour,
                          border:
                            colour === "#ffffff"
                              ? "1px solid #d1d5db"
                              : "1px solid transparent",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div style={subtleLabelStyle}>Custom colour</div>
                  <div style={customColourRowStyle}>
                    <input
                      value={customColour}
                      onChange={(e) => setCustomColour(e.target.value)}
                      placeholder="#8b5cf6"
                      style={{ ...inputStyle, maxWidth: 220 }}
                    />
                    <button
                      type="button"
                      style={secondaryButtonStyle}
                      onClick={() => addColour(customColour)}
                    >
                      Add colour
                    </button>
                  </div>
                </div>

                <div>
                  <div style={subtleLabelStyle}>Selected colours</div>
                  {colours.length === 0 ? (
                    <EmptyState text="No colours selected." />
                  ) : (
                    <div style={selectedColoursWrapStyle}>
                      {colours.map((colour) => (
                        <div key={colour} style={selectedColourChipStyle}>
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              background: colour,
                              border:
                                colour === "#ffffff"
                                  ? "1px solid #d1d5db"
                                  : "1px solid transparent",
                            }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>
                            {colour}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeColour(colour)}
                            style={chipRemoveButtonStyle}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>

          <div style={rightColumnStyle}>
            <SectionCard
              title="Public preview"
              subtitle="How the raffle can look to buyers."
              sticky
            >
              <div style={previewCardStyle}>
                <div
                  style={{
                    ...previewHeroStyle,
                    background: imageUrl
                      ? `center / cover no-repeat url(${imageUrl})`
                      : "linear-gradient(135deg, #dbeafe 0%, #ede9fe 50%, #fce7f3 100%)",
                  }}
                >
                  <div style={previewHeroOverlayStyle}>
                    <div style={previewSlugStyle}>/r/{slug || "your-slug"}</div>
                    <div style={previewTitleStyle}>
                      {title || "Your raffle title"}
                    </div>
                  </div>
                </div>

                <div style={previewBodyStyle}>
                  <p style={previewDescriptionStyle}>
                    {description || "Your raffle description will appear here."}
                  </p>

                  <div style={previewMetaGridStyle}>
                    <PreviewStat label="Numbers" value={`${startNumber}–${endNumber}`} />
                    <PreviewStat label="Tickets" value={`${totalTickets}`} />
                    <PreviewStat label="Single" value={`£${money(ticketPrice)}`} />
                    <PreviewStat label="Offers" value={`${validOffers.length}`} />
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div style={previewSectionTitleStyle}>Available colours</div>
                    <div style={previewSwatchesStyle}>
                      {colours.length === 0 ? (
                        <div style={mutedTextStyle}>No colours selected</div>
                      ) : (
                        colours.map((colour) => (
                          <div
                            key={colour}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              background: colour,
                              border:
                                colour === "#ffffff"
                                  ? "1px solid #d1d5db"
                                  : "1px solid transparent",
                            }}
                            title={colour}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div style={previewSectionTitleStyle}>Offers</div>
                    {validOffers.length === 0 ? (
                      <div style={mutedTextStyle}>No offers added</div>
                    ) : (
                      <div style={{ display: "grid", gap: 8 }}>
                        {validOffers.map((offer) => (
                          <div key={offer.id} style={previewOfferStyle}>
                            <span>{offer.label}</span>
                            <strong>£{money(offer.price)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div style={previewSectionTitleStyle}>
                      Number selection preview
                    </div>
                    <div style={previewNumbersGridStyle}>
                      {numbersPreview.map((n) => (
                        <div key={n} style={previewNumberStyle}>
                          {n}
                        </div>
                      ))}
                    </div>
                    {totalTickets > numbersPreview.length && (
                      <div style={{ ...mutedTextStyle, marginTop: 8 }}>
                        + {totalTickets - numbersPreview.length} more tickets
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Pricing insight"
              subtitle="Quick commercial summary."
            >
              <div style={{ display: "grid", gap: 12 }}>
                <InsightRow
                  label="Base sell-out value"
                  value={`£${money(expectedRevenue)}`}
                />
                <InsightRow
                  label="Best offer"
                  value={
                    bestOffer
                      ? `${bestOffer.label} (£${money(
                          bestOffer.price / bestOffer.quantity
                        )}/ticket)`
                      : "None"
                  }
                />
                <InsightRow label="Colours available" value={`${colours.length}`} />
                <InsightRow
                  label="Configured offers"
                  value={`${validOffers.length}`}
                />
              </div>
            </SectionCard>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={fieldLabelStyle}>{label}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statCardLabelStyle}>{label}</div>
      <div style={statCardValueStyle}>{value}</div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={previewStatStyle}>
      <div style={previewStatLabelStyle}>{label}</div>
      <div style={previewStatValueStyle}>{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  rightAction,
  sticky = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
  sticky?: boolean;
}) {
  return (
    <section
      style={{
        ...sectionStyle,
        position: sticky ? "sticky" : "relative",
        top: sticky ? 24 : undefined,
      }}
    >
      <div style={sectionHeaderStyle}>
        <div>
          <h2 style={sectionTitleStyle}>{title}</h2>
          {subtitle ? <p style={sectionSubtitleStyle}>{subtitle}</p> : null}
        </div>
        {rightAction}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={emptyStateStyle}>{text}</div>;
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={insightRowStyle}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <strong style={{ color: "#111827", textAlign: "right" }}>{value}</strong>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f3f4f6",
  padding: 24,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const loadingCardStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: "60px auto",
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 32,
  textAlign: "center",
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  marginBottom: 24,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 1,
  color: "#6366f1",
  marginBottom: 8,
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: 34,
  lineHeight: 1.05,
  margin: 0,
  color: "#111827",
};

const pageSubtitleStyle: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  color: "#6b7280",
  fontSize: 15,
};

const metaTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 600,
};

const topActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const statCardLabelStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 10,
};

const statCardValueStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1,
};

const layoutStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.5fr) minmax(360px, 0.95fr)",
  gap: 24,
  alignItems: "start",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
};

const sectionStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 22,
  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  color: "#111827",
};

const sectionSubtitleStyle: React.CSSProperties = {
  margin: "6px 0 0 0",
  color: "#6b7280",
  fontSize: 14,
};

const fieldGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr",
  gap: 16,
};

const threeColGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 16,
};

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
  marginBottom: 8,
};

const subtleLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#6b7280",
  marginBottom: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#6b7280",
};

const primaryButtonStyle: React.CSSProperties = {
  background: "#111827",
  color: "#ffffff",
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  background: "#f9fafb",
  color: "#111827",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  padding: "10px 14px",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  background: "#fff1f2",
  color: "#be123c",
  border: "1px solid #fecdd3",
  borderRadius: 12,
  padding: "11px 14px",
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const infoStripStyle: React.CSSProperties = {
  marginTop: 18,
  borderRadius: 16,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  padding: 16,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const infoStripLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  marginBottom: 6,
};

const infoStripValueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#111827",
};

const templateRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const templateButtonStyle: React.CSSProperties = {
  background: "#eef2ff",
  color: "#4338ca",
  border: "1px solid #c7d2fe",
  borderRadius: 999,
  padding: "9px 12px",
  fontWeight: 700,
  cursor: "pointer",
};

const offerCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fafafa",
  borderRadius: 16,
  padding: 16,
};

const offerGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.8fr 0.8fr 0.9fr 120px",
  gap: 12,
  alignItems: "end",
};

const offerMetaStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 600,
};

const swatchGridStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const swatchButtonStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  cursor: "pointer",
};

const customColourRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const selectedColoursWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const selectedColourChipStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};

const chipRemoveButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#6b7280",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
};

const previewCardStyle: React.CSSProperties = {
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};

const previewHeroStyle: React.CSSProperties = {
  height: 220,
  display: "flex",
  alignItems: "flex-end",
};

const previewHeroOverlayStyle: React.CSSProperties = {
  width: "100%",
  padding: 18,
  background: "linear-gradient(180deg, rgba(17,24,39,0) 0%, rgba(17,24,39,0.7) 100%)",
};

const previewSlugStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.85)",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 8,
};

const previewTitleStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.05,
};

const previewBodyStyle: React.CSSProperties = {
  padding: 18,
};

const previewDescriptionStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 0,
  color: "#374151",
  lineHeight: 1.5,
  fontSize: 14,
};

const previewMetaGridStyle: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const previewStatStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const previewStatLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 6,
};

const previewStatValueStyle: React.CSSProperties = {
  fontSize: 18,
  color: "#111827",
  fontWeight: 800,
};

const previewSectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 800,
  marginBottom: 10,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const previewSwatchesStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const previewOfferStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  color: "#111827",
  fontSize: 14,
};

const previewNumbersGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
  gap: 8,
};

const previewNumberStyle: React.CSSProperties = {
  padding: "10px 8px",
  textAlign: "center",
  borderRadius: 10,
  background: "#f3f4f6",
  color: "#111827",
  fontWeight: 700,
  fontSize: 13,
};

const mutedTextStyle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
};

const insightRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid #f3f4f6",
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 14,
  padding: 16,
  color: "#6b7280",
  background: "#fafafa",
};
