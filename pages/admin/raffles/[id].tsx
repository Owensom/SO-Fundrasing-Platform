import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type Offer = {
  id: string;
  label: string;
  price: string;
  quantity: string;
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

function toOptionalNumber(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
  { label: "3 for £5", quantity: "3", price: "5" },
  { label: "5 for £8", quantity: "5", price: "8" },
  { label: "10 for £15", quantity: "10", price: "15" },
  { label: "20 for £25", quantity: "20", price: "25" },
];

export default function AdminRaffleEditPage() {
  const router = useRouter();
  const routeId = typeof router.query.id === "string" ? router.query.id : "";

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [startNumber, setStartNumber] = useState("");
  const [endNumber, setEndNumber] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");

  const [autoSlug, setAutoSlug] = useState(false);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [colours, setColours] = useState<string[]>([]);
  const [customColour, setCustomColour] = useState("#8b5cf6");

  useEffect(() => {
    if (!router.isReady) return;

    const timer = setTimeout(() => {
      setTitle("SO Foundation Demo Raffle");
      setSlug("so-foundation-demo-raffle");
      setDescription(
        "Each colour creates another full ticket range. Example: if the range is 1 to 200 and you add 3 colours, buyers can choose Red 25, Blue 25 and Green 25 as separate tickets.",
      );
      setImageUrl("");
      setStartNumber("1");
      setEndNumber("200");
      setTicketPrice("2");
      setOffers([
        { id: uid(), label: "5 for £8", quantity: "5", price: "8" },
        { id: uid(), label: "10 for £15", quantity: "10", price: "15" },
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

  const parsedStart = useMemo(() => toOptionalNumber(startNumber), [startNumber]);
  const parsedEnd = useMemo(() => toOptionalNumber(endNumber), [endNumber]);
  const parsedTicketPrice = useMemo(
    () => toOptionalNumber(ticketPrice),
    [ticketPrice],
  );

  const numbersPerColour = useMemo(() => {
    if (parsedStart === null || parsedEnd === null) return 0;
    if (parsedEnd < parsedStart) return 0;
    return parsedEnd - parsedStart + 1;
  }, [parsedStart, parsedEnd]);

  const colourCount = colours.length;

  const totalTickets = useMemo(() => {
    return numbersPerColour * colourCount;
  }, [numbersPerColour, colourCount]);

  const expectedRevenue = useMemo(() => {
    if (parsedTicketPrice === null) return 0;
    return totalTickets * parsedTicketPrice;
  }, [totalTickets, parsedTicketPrice]);

  const numberPreview = useMemo(() => {
    if (parsedStart === null || numbersPerColour <= 0) return [];
    const max = Math.min(numbersPerColour, 12);
    return Array.from({ length: max }, (_, i) => parsedStart + i);
  }, [parsedStart, numbersPerColour]);

  const validOffers = useMemo(() => {
    return offers
      .map((offer) => {
        const quantity = toOptionalNumber(offer.quantity);
        const price = toOptionalNumber(offer.price);

        if (!offer.label.trim() || quantity === null || price === null) return null;
        if (quantity <= 0 || price < 0) return null;

        return {
          id: offer.id,
          label: offer.label.trim(),
          quantity,
          price,
        };
      })
      .filter(
        (
          offer,
        ): offer is { id: string; label: string; quantity: number; price: number } =>
          Boolean(offer),
      )
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

  const completionErrors = useMemo(() => {
    const errors: string[] = [];

    if (title.trim() === "") errors.push("Title is required");
    if (slug.trim() === "") errors.push("Slug is required");
    if (parsedStart === null) errors.push("Start number is required");
    if (parsedEnd === null) errors.push("End number is required");
    if (parsedTicketPrice === null) errors.push("Single ticket price is required");
    if (colours.length === 0) errors.push("At least one colour is required");

    if (parsedStart !== null && parsedEnd !== null && parsedEnd < parsedStart) {
      errors.push("End number must be greater than or equal to start number");
    }

    if (parsedTicketPrice !== null && parsedTicketPrice < 0) {
      errors.push("Single ticket price cannot be negative");
    }

    return errors;
  }, [title, slug, parsedStart, parsedEnd, parsedTicketPrice, colours.length]);

  const canComplete = completionErrors.length === 0;

  function addBlankOffer() {
    setOffers((prev) => [...prev, { id: uid(), label: "", quantity: "", price: "" }]);
  }

  function addTemplateOffer(template: {
    label: string;
    quantity: string;
    price: string;
  }) {
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

  function updateOffer(id: string, field: keyof Offer, value: string) {
    setOffers((prev) =>
      prev.map((offer) => (offer.id === id ? { ...offer, [field]: value } : offer)),
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage("");
    setIsUploadingImage(true);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-filename": file.name,
        },
        body: file,
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }

      setImageUrl(data.url);
      setStatusMessage("Background image uploaded");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Upload failed",
      );
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  }

  function buildDraftPayload() {
    return {
      id: routeId,
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      startNumber: parsedStart,
      endNumber: parsedEnd,
      numbersPerColour,
      colourCount,
      totalTickets,
      ticketPrice: parsedTicketPrice,
      offers: validOffers,
      colours,
      status: "draft",
    };
  }

  function buildCompletedPayload() {
    if (
      title.trim() === "" ||
      slug.trim() === "" ||
      parsedStart === null ||
      parsedEnd === null ||
      parsedTicketPrice === null ||
      parsedEnd < parsedStart ||
      parsedTicketPrice < 0 ||
      colours.length === 0
    ) {
      return null;
    }

    return {
      id: routeId,
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      startNumber: parsedStart,
      endNumber: parsedEnd,
      numbersPerColour,
      colourCount,
      totalTickets,
      ticketPrice: parsedTicketPrice,
      offers: validOffers,
      colours,
      status: "complete",
    };
  }

  async function handleSaveDraft(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatusMessage("");
    setIsSavingDraft(true);

    const payload = buildDraftPayload();
    console.log("Save draft payload:", payload);

    setTimeout(() => {
      setIsSavingDraft(false);
      setStatusMessage("Draft saved");
    }, 500);
  }

  async function handleComplete() {
    setStatusMessage("");

    const payload = buildCompletedPayload();
    if (!payload) {
      setStatusMessage("Please complete all required fields before marking complete.");
      return;
    }

    setIsCompleting(true);
    console.log("Complete raffle payload:", payload);

    setTimeout(() => {
      setIsCompleting(false);
      setStatusMessage("Raffle marked complete");
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
      <form onSubmit={handleSaveDraft}>
        <div style={topBarStyle}>
          <div>
            <div style={eyebrowStyle}>Admin</div>
            <h1 style={pageTitleStyle}>Edit raffle</h1>
            <p style={pageSubtitleStyle}>
              Each colour creates another full number range.
            </p>
            <div style={metaTextStyle}>Raffle: {routeId || "demo-raffle"}</div>
          </div>

          <div style={topActionsStyle}>
            <button type="button" style={ghostButtonStyle} onClick={() => router.back()}>
              Back
            </button>
            <button type="submit" style={secondaryButtonStyle} disabled={isSavingDraft}>
              {isSavingDraft ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={handleComplete}
              disabled={isCompleting}
            >
              {isCompleting ? "Completing..." : "Complete raffle"}
            </button>
          </div>
        </div>

        {statusMessage ? <div style={statusBannerStyle}>{statusMessage}</div> : null}

        {!canComplete ? (
          <div style={warningCardStyle}>
            <div style={warningTitleStyle}>Completion checks</div>
            <div style={warningListStyle}>
              {completionErrors.map((error) => (
                <div key={error}>• {error}</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={successCardStyle}>Ready to complete</div>
        )}

        <div style={statsGridStyle}>
          <StatCard
            label="Numbers per colour"
            value={numbersPerColour > 0 ? `${numbersPerColour}` : "—"}
          />
          <StatCard label="Colours" value={`${colourCount}`} />
          <StatCard
            label="Total tickets"
            value={totalTickets > 0 ? `${totalTickets}` : "—"}
          />
          <StatCard
            label="Max revenue"
            value={expectedRevenue > 0 ? `£${money(expectedRevenue)}` : "—"}
          />
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
                <Field label="Background image">
                  <div style={{ display: "grid", gap: 12 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={inputStyle}
                    />

                    {isUploadingImage ? (
                      <div style={uploadingCardStyle}>Uploading image…</div>
                    ) : null}

                    {imageUrl ? (
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "#f9fafb",
                        }}
                      >
                        <img
                          src={imageUrl}
                          alt="Background preview"
                          style={{
                            display: "block",
                            width: "100%",
                            height: 220,
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    ) : (
                      <div style={emptyStateStyle}>No image uploaded yet.</div>
                    )}

                    {imageUrl ? (
                      <button
                        type="button"
                        style={ghostButtonStyle}
                        onClick={() => setImageUrl("")}
                      >
                        Remove image
                      </button>
                    ) : null}
                  </div>
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              title="Ticket setup"
              subtitle="Each colour duplicates this full number range."
            >
              <div style={threeColGridStyle}>
                <Field label="Start number">
                  <input
                    type="number"
                    value={startNumber}
                    onChange={(e) => setStartNumber(e.target.value)}
                    style={inputStyle}
                    placeholder="1"
                  />
                </Field>

                <Field label="End number">
                  <input
                    type="number"
                    value={endNumber}
                    onChange={(e) => setEndNumber(e.target.value)}
                    style={inputStyle}
                    placeholder="200"
                  />
                </Field>

                <Field label="Single ticket price (£)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ticketPrice}
                    onChange={(e) => setTicketPrice(e.target.value)}
                    style={inputStyle}
                    placeholder="2"
                  />
                </Field>
              </div>

              <div style={infoStripStyle}>
                <div>
                  <div style={infoStripLabelStyle}>Numbers per colour</div>
                  <div style={infoStripValueStyle}>
                    {numbersPerColour > 0 ? numbersPerColour : "—"}
                  </div>
                </div>
                <div>
                  <div style={infoStripLabelStyle}>Colours</div>
                  <div style={infoStripValueStyle}>{colourCount}</div>
                </div>
                <div>
                  <div style={infoStripLabelStyle}>Total tickets</div>
                  <div style={infoStripValueStyle}>
                    {totalTickets > 0 ? totalTickets : "—"}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Colour boards"
              subtitle="Each colour below creates another full ticket set."
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
                  <div style={subtleLabelStyle}>Selected colour boards</div>
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
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{colour}</span>
                          <span style={chipMetaTextStyle}>
                            {numbersPerColour > 0 ? `${numbersPerColour} tickets` : "set"}
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

            <SectionCard
              title="Offers"
              subtitle="These can be partially edited. Only valid offers are included on save."
              rightAction={
                <button type="button" style={secondaryButtonStyle} onClick={addBlankOffer}>
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
                    const quantity = toOptionalNumber(offer.quantity);
                    const price = toOptionalNumber(offer.price);
                    const pricePerTicket =
                      quantity !== null && price !== null && quantity > 0
                        ? price / quantity
                        : null;

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
                                updateOffer(offer.id, "quantity", e.target.value)
                              }
                              style={inputStyle}
                              placeholder="10"
                            />
                          </Field>

                          <Field label="Price (£)">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={offer.price}
                              onChange={(e) =>
                                updateOffer(offer.id, "price", e.target.value)
                              }
                              style={inputStyle}
                              placeholder="15"
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
                          <span>
                            {pricePerTicket !== null
                              ? `£${money(pricePerTicket)} per ticket`
                              : "Incomplete offer"}
                          </span>
                          <span>
                            {parsedTicketPrice !== null
                              ? `vs base £${money(parsedTicketPrice)} each`
                              : "Base price not set"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
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
                    background: imageUrl.trim()
                      ? `center / cover no-repeat url(${imageUrl})`
                      : "linear-gradient(135deg, #dbeafe 0%, #ede9fe 50%, #fce7f3 100%)",
                  }}
                >
                  <div style={previewHeroOverlayStyle}>
                    <div style={previewSlugStyle}>/r/{slug || "your-slug"}</div>
                    <div style={previewTitleStyle}>{title || "Your raffle title"}</div>
                  </div>
                </div>

                <div style={previewBodyStyle}>
                  <p style={previewDescriptionStyle}>
                    {description || "Your raffle description will appear here."}
                  </p>

                  <div style={previewMetaGridStyle}>
                    <PreviewStat
                      label="Per colour"
                      value={numbersPerColour > 0 ? `${numbersPerColour}` : "—"}
                    />
                    <PreviewStat label="Colours" value={`${colourCount}`} />
                    <PreviewStat
                      label="Total tickets"
                      value={totalTickets > 0 ? `${totalTickets}` : "—"}
                    />
                    <PreviewStat
                      label="Single"
                      value={
                        parsedTicketPrice !== null ? `£${money(parsedTicketPrice)}` : "—"
                      }
                    />
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div style={previewSectionTitleStyle}>Colour boards</div>
                    {colours.length === 0 ? (
                      <div style={mutedTextStyle}>No colours selected</div>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        {colours.map((colour) => (
                          <div key={colour} style={boardPreviewRowStyle}>
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 999,
                                background: colour,
                                border:
                                  colour === "#ffffff"
                                    ? "1px solid #d1d5db"
                                    : "1px solid transparent",
                              }}
                            />
                            <span style={{ fontWeight: 700 }}>{colour}</span>
                            <span style={{ color: "#6b7280", marginLeft: "auto" }}>
                              {numbersPerColour > 0 ? `${numbersPerColour} tickets` : "set"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div style={previewSectionTitleStyle}>Offers</div>
                    {validOffers.length === 0 ? (
                      <div style={mutedTextStyle}>No valid offers added</div>
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
                    <div style={previewSectionTitleStyle}>Number preview per colour</div>
                    {colours.length === 0 ? (
                      <div style={mutedTextStyle}>Add a colour to create a board</div>
                    ) : (
                      <div style={{ display: "grid", gap: 14 }}>
                        {colours.slice(0, 3).map((colour) => (
                          <div key={colour}>
                            <div style={boardPreviewHeaderStyle}>
                              <div
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 999,
                                  background: colour,
                                  border:
                                    colour === "#ffffff"
                                      ? "1px solid #d1d5db"
                                      : "1px solid transparent",
                                }}
                              />
                              <span>{colour}</span>
                            </div>

                            <div style={previewNumbersGridStyle}>
                              {numberPreview.map((n) => (
                                <div key={`${colour}-${n}`} style={previewNumberStyle}>
                                  {n}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Pricing insight" subtitle="Quick commercial summary.">
              <div style={{ display: "grid", gap: 12 }}>
                <InsightRow
                  label="Numbers per colour"
                  value={numbersPerColour > 0 ? `${numbersPerColour}` : "—"}
                />
                <InsightRow label="Colour boards" value={`${colourCount}`} />
                <InsightRow
                  label="Total ticket inventory"
                  value={totalTickets > 0 ? `${totalTickets}` : "—"}
                />
                <InsightRow
                  label="Base sell-out value"
                  value={expectedRevenue > 0 ? `£${money(expectedRevenue)}` : "—"}
                />
                <InsightRow
                  label="Best offer"
                  value={
                    bestOffer
                      ? `${bestOffer.label} (£${money(
                          bestOffer.price / bestOffer.quantity,
                        )}/ticket)`
                      : "None"
                  }
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

const statusBannerStyle: React.CSSProperties = {
  marginBottom: 16,
  background: "#ecfeff",
  color: "#155e75",
  border: "1px solid #a5f3fc",
  borderRadius: 14,
  padding: "12px 14px",
  fontWeight: 700,
};

const warningCardStyle: React.CSSProperties = {
  marginBottom: 16,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fdba74",
  borderRadius: 14,
  padding: 16,
};

const warningTitleStyle: React.CSSProperties = {
  fontWeight: 800,
  marginBottom: 8,
};

const warningListStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  fontSize: 14,
};

const successCardStyle: React.CSSProperties = {
  marginBottom: 16,
  background: "#ecfdf5",
  color: "#166534",
  border: "1px solid #86efac",
  borderRadius: 14,
  padding: 16,
  fontWeight: 800,
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

const chipMetaTextStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
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
  background:
    "linear-gradient(180deg, rgba(17,24,39,0) 0%, rgba(17,24,39,0.7) 100%)",
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

const boardPreviewRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
};

const boardPreviewHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "#111827",
  marginBottom: 8,
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

const uploadingCardStyle: React.CSSProperties = {
  border: "1px solid #bfdbfe",
  borderRadius: 12,
  padding: 14,
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 700,
};
