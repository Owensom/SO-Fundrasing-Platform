"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";

type Props = {
  tenantSlug: string;
  subscriptionTier?: string | null;
  customImagesAllowed?: boolean;
};

type RaffleSubtype = "standard" | "fifty_fifty";

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

const DEFAULT_TICKET_IMAGE = "/brand/so-default-raffles.png";

function safeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function colourToCss(colour: string) {
  const clean = colour.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(clean)) return clean;

  const map: Record<string, string> = {
    red: "#ef4444",
    blue: "#2563eb",
    green: "#16a34a",
    yellow: "#facc15",
    orange: "#f97316",
    purple: "#7c3aed",
    pink: "#ec4899",
    black: "#111827",
    white: "#ffffff",
    gold: "#d97706",
    silver: "#94a3b8",
  };

  return map[clean.toLowerCase()] || "#1683f8";
}

function formatPreviewMoney(value: string, currency: string) {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} ${
      currency || "GBP"
    }`;
  }
}

export default function NewRaffleForm({
  tenantSlug,
  subscriptionTier,
  customImagesAllowed,
}: Props) {
  const [raffleSubtype, setRaffleSubtype] =
    useState<RaffleSubtype>("standard");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [drawAt, setDrawAt] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imageFocusX, setImageFocusX] = useState(50);
  const [imageFocusY, setImageFocusY] = useState(50);

  const [ticketPrice, setTicketPrice] = useState("5");
  const [currency, setCurrency] = useState("GBP");
  const [status, setStatus] = useState("draft");

  const [startNumber, setStartNumber] = useState("1");
  const [endNumber, setEndNumber] = useState("10");

  const [selectedColours, setSelectedColours] = useState<string[]>([
    "Red",
    "Blue",
  ]);
  const [customColour, setCustomColour] = useState("");

  const [questionText, setQuestionText] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");

  const [offers, setOffers] = useState<OfferRow[]>([
    makeOffer("offer-1", "3 for 12", "12", "3"),
    makeOffer("offer-2", "5 for 18", "18", "5"),
  ]);

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "", ""),
  ]);

  const isFiftyFifty = raffleSubtype === "fifty_fifty";

  useEffect(() => {
    if (!slugEdited) {
      setSlug(slugify(title));
    }
  }, [title, slugEdited]);

  const numbersPerColour = useMemo(() => {
    const start = toInt(startNumber, 1);
    const end = toInt(endNumber, 1);

    return end >= start ? end - start + 1 : 0;
  }, [startNumber, endNumber]);

  const totalTickets = useMemo(() => {
    return numbersPerColour * selectedColours.length;
  }, [numbersPerColour, selectedColours.length]);

  const coloursValue = useMemo(
    () => selectedColours.join(","),
    [selectedColours],
  );

  const offersValue = useMemo(() => {
    if (isFiftyFifty) return "[]";

    const clean = offers
      .map((offer, index) => ({
        id: offer.id,
        label: offer.label.trim(),
        price: Number(offer.price),
        quantity: Number(offer.quantity),
        tickets: Number(offer.quantity),
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
  }, [offers, isFiftyFifty]);

  const prizesValue = useMemo(() => {
    if (isFiftyFifty) return "[]";

    const clean = prizes
      .map((prize, index) => {
        const position = Number(prize.position);
        const title = prize.title.trim();

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title,
          name: title,
          description: prize.description.trim(),
          isPublic: Boolean(prize.is_public),
          is_public: Boolean(prize.is_public),
          sortOrder: index,
          sort_order: index,
        };
      })
      .filter((prize) => prize.title);

    return JSON.stringify(clean);
  }, [prizes, isFiftyFifty]);

  const questionValue = useMemo(() => {
    const text = questionText.trim();
    const answer = questionAnswer.trim();

    if (!text || !answer) return "";

    return JSON.stringify({ text, answer });
  }, [questionText, questionAnswer]);

  const validOffersCount = useMemo(() => {
    if (isFiftyFifty) return 0;

    try {
      return JSON.parse(offersValue).length;
    } catch {
      return 0;
    }
  }, [offersValue, isFiftyFifty]);

  const publicPrizesCount = useMemo(() => {
    if (isFiftyFifty) return 0;

    return prizes.filter((prize) => prize.title.trim() && prize.is_public).length;
  }, [prizes, isFiftyFifty]);

  const featuredOffer = useMemo(() => {
    if (isFiftyFifty) return null;

    return offers.find(
      (offer) =>
        offer.is_active &&
        offer.label.trim() &&
        Number(offer.price) > 0 &&
        Number(offer.quantity) > 0,
    );
  }, [offers, isFiftyFifty]);

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
    setOffers((current) => [...current, makeOffer(safeId("offer"))]);
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
      makePrize(safeId("prize"), String(current.length + 1)),
    ]);
  }

  function removePrize(id: string) {
    setPrizes((current) => current.filter((prize) => prize.id !== id));
  }

  return (
    <form
      className="new-raffle-form"
      action="/api/admin/raffles"
      method="post"
      style={styles.form}
    >
      <style>{responsiveStyles}</style>

      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="raffle_subtype" value={raffleSubtype} />
      <input type="hidden" name="colours" value={coloursValue} />
      <input type="hidden" name="offers" value={offersValue} />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="question" value={questionValue} />
      <input type="hidden" name="total_tickets" value={String(totalTickets)} />

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>
            {isFiftyFifty ? "50/50 raffle builder" : "Raffle builder"}
          </div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {title.trim()
                ? title
                : isFiftyFifty
                  ? "Build a 50/50 raffle campaign"
                  : "Build a premium raffle campaign"}
            </h1>

            <div style={styles.statusPill}>
              {isFiftyFifty ? "50/50" : status || "draft"}
            </div>
          </div>

          <p style={styles.heroSlug}>
            /r/{slug.trim() ? slug : "raffle-slug"}
          </p>

          <p style={styles.heroDescription}>
            {isFiftyFifty
              ? "Create a 50/50 raffle using the existing raffle legal framework. Half the paid ticket pot goes to the winner and half supports the cause."
              : "Create the public campaign, configure ticket sales, add offers, showcase prizes and keep legal entry requirements in one place."}
          </p>

          <div style={styles.heroMetricGrid}>
            <HeroMetric
              label="Ticket price"
              value={formatPreviewMoney(ticketPrice, currency)}
            />
            <HeroMetric label="Total tickets" value={totalTickets} />
            <HeroMetric label="Type" value={isFiftyFifty ? "50/50" : "Standard"} />
            <HeroMetric
              label={isFiftyFifty ? "Winner share" : "Offers"}
              value={isFiftyFifty ? "50%" : validOffersCount}
            />
          </div>
        </div>

        <div style={styles.previewShell}>
          <div style={styles.previewBadge}>Public preview</div>

          <div style={styles.previewImageWrap}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Raffle preview"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                  display: "block",
                }}
              />
            ) : (
              <img
                src={DEFAULT_TICKET_IMAGE}
                alt="Ticket placeholder"
                style={styles.placeholderImage}
              />
            )}
          </div>

          <div style={styles.previewCardBody}>
            <div style={styles.previewTitle}>
              {title.trim() ? title : "Your raffle title"}
            </div>

            <div style={styles.previewText}>
              {description.trim()
                ? description.trim().slice(0, 92)
                : isFiftyFifty
                  ? "Half the paid ticket pot goes to the winner. Half supports the cause."
                  : "A short public summary of your raffle will appear here."}
              {description.trim().length > 92 ? "…" : ""}
            </div>

            <div style={styles.previewBottom}>
              <span>{formatPreviewMoney(ticketPrice, currency)} per ticket</span>
              <span>
                {isFiftyFifty ? "50/50 prize pot" : `${totalTickets} tickets`}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="Raffle type"
          value={isFiftyFifty ? "50/50" : "Standard"}
        />
        <SummaryCard label="Total tickets" value={totalTickets} />
        <SummaryCard label="Numbers / colour" value={numbersPerColour} />
        <SummaryCard label="Colours" value={selectedColours.length} />
        <SummaryCard
          label={isFiftyFifty ? "Winner share" : "Public prizes"}
          value={isFiftyFifty ? "50%" : publicPrizesCount}
        />
      </section>

      <section style={styles.builderGrid}>
        <div style={styles.mainColumn}>
          <section style={styles.section}>
            <SectionHeader
              eyebrow="Section 1"
              title="Campaign basics"
              description="Set the public title, slug, description and image that buyers see first."
            />

            <div style={styles.formInner}>
              <div style={styles.twoColumn}>
                <Field label="Title">
                  <input
                    name="title"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    style={styles.input}
                    placeholder={
                      isFiftyFifty
                        ? "Autumn 50/50 Raffle"
                        : "Spring Cash Raffle"
                    }
                  />
                </Field>

                <Field label="Slug">
                  <input
                    name="slug"
                    required
                    value={slug}
                    onChange={(event) => {
                      setSlugEdited(true);
                      setSlug(slugify(event.target.value));
                    }}
                    style={styles.input}
                    placeholder={
                      isFiftyFifty
                        ? "autumn-50-50-raffle"
                        : "spring-cash-raffle"
                    }
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  name="description"
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  style={styles.textarea}
                  placeholder={
                    isFiftyFifty
                      ? "Half the paid ticket pot goes to the winner. Half supports the cause."
                      : "Describe the raffle..."
                  }
                />
              </Field>

              <div style={styles.mediaBox}>
                <div style={styles.mediaControls}>
                  <h3 style={styles.subTitle}>Campaign image</h3>

                  <p style={styles.sectionDescription}>
                    Upload or replace the public image, then choose the crop
                    focus.
                  </p>

                  <ImageFocusUploadField
                    currentImageUrl={imageUrl}
                    currentFocusX={imageFocusX}
                    currentFocusY={imageFocusY}
                    label="Raffle image"
                    previewAlt={title.trim() || "Raffle preview"}
                    onImageUrlChange={setImageUrl}
                    onFocusXChange={setImageFocusX}
                    onFocusYChange={setImageFocusY}
                    subscriptionTier={subscriptionTier}
                    customImagesAllowed={customImagesAllowed}
                  />
                </div>

                <div style={styles.previewBox}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Raffle preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: `${imageFocusX}% ${imageFocusY}%`,
                        display: "block",
                      }}
                    />
                  ) : (
                    <img
                      src={DEFAULT_TICKET_IMAGE}
                      alt="Ticket placeholder"
                      style={styles.previewPlaceholderImage}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <SectionHeader
              eyebrow="Section 2"
              title="Raffle type & ticket setup"
              description="Choose the raffle type, then configure ticket price, draw date, currency, status and number range."
            />

            <div style={styles.formInner}>
              <div className="new-raffle-subtype-grid" style={styles.subtypeGrid}>
                <button
                  type="button"
                  onClick={() => setRaffleSubtype("standard")}
                  style={{
                    ...styles.subtypeCard,
                    borderColor:
                      raffleSubtype === "standard" ? "#1683f8" : "#e2e8f0",
                    background:
                      raffleSubtype === "standard" ? "#eff6ff" : "#ffffff",
                  }}
                >
                  <span style={styles.subtypeTitle}>Standard raffle</span>
                  <span style={styles.subtypeText}>
                    Fixed prizes, optional bundle offers and the existing raffle
                    draw flow.
                  </span>
                  <span style={styles.subtypeBadge}>
                    {raffleSubtype === "standard" ? "Selected" : "Choose"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setRaffleSubtype("fifty_fifty")}
                  style={{
                    ...styles.subtypeCard,
                    borderColor:
                      raffleSubtype === "fifty_fifty" ? "#d97706" : "#e2e8f0",
                    background:
                      raffleSubtype === "fifty_fifty" ? "#fffbeb" : "#ffffff",
                  }}
                >
                  <span style={styles.subtypeTitle}>50/50 raffle</span>
                  <span style={styles.subtypeText}>
                    Half the paid ticket pot goes to the winner and half supports
                    the cause.
                  </span>
                  <span
                    style={{
                      ...styles.subtypeBadge,
                      background:
                        raffleSubtype === "fifty_fifty" ? "#fef3c7" : "#f8fafc",
                      color:
                        raffleSubtype === "fifty_fifty" ? "#92400e" : "#334155",
                      borderColor:
                        raffleSubtype === "fifty_fifty" ? "#facc15" : "#e2e8f0",
                    }}
                  >
                    {raffleSubtype === "fifty_fifty" ? "Selected" : "Choose"}
                  </span>
                </button>
              </div>

              {isFiftyFifty ? (
                <div style={styles.fiftyFiftyInfo}>
                  <strong>50/50 setup</strong>
                  <span>
                    This raffle keeps the existing legal entry question, free
                    entry structure, terms acceptance and raffle checkout flow.
                    Bundle offers and fixed prize setup are disabled for this
                    first 50/50 release.
                  </span>
                </div>
              ) : null}

              <Field label="Draw date">
                <input
                  name="draw_at"
                  type="datetime-local"
                  value={drawAt}
                  onChange={(event) => setDrawAt(event.target.value)}
                  style={styles.input}
                />
              </Field>

              <div style={styles.threeColumn}>
                <Field label="Ticket price">
                  <input
                    name="ticket_price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={ticketPrice}
                    onChange={(event) => setTicketPrice(event.target.value)}
                    style={styles.input}
                  />
                </Field>

                <Field label="Currency">
                  <select
                    name="currency"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    style={styles.input}
                  >
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>

                <Field label="Status">
                  <select
                    name="status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    style={styles.input}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                  </select>
                </Field>
              </div>

              <div style={styles.twoColumn}>
                <Field label="Start number">
                  <input
                    name="startNumber"
                    type="number"
                    min="0"
                    step="1"
                    value={startNumber}
                    onChange={(event) => setStartNumber(event.target.value)}
                    style={styles.input}
                  />
                </Field>

                <Field label="End number">
                  <input
                    name="endNumber"
                    type="number"
                    min="0"
                    step="1"
                    value={endNumber}
                    onChange={(event) => setEndNumber(event.target.value)}
                    style={styles.input}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <SectionHeader
              eyebrow="Section 3"
              title="Sales setup"
              description={
                isFiftyFifty
                  ? "Set ticket colours. Bundle offers are disabled for 50/50 raffles in this release."
                  : "Set ticket colours and bundle offers that encourage buyers to purchase more."
              }
            />

            <div style={styles.formInner}>
              <section style={styles.innerPanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <h3 style={styles.subTitle}>Ticket colours</h3>

                    <p style={styles.sectionDescription}>
                      Preset colour buttons plus optional custom colours.
                    </p>
                  </div>
                </div>

                <div style={styles.colourGrid}>
                  {PRESET_COLOURS.map((colour) => {
                    const active = selectedColours.includes(colour);
                    const cssColour = colourToCss(colour);

                    return (
                      <button
                        key={colour}
                        type="button"
                        onClick={() => toggleColour(colour)}
                        style={{
                          ...styles.colourPill,
                          background: active
                            ? `linear-gradient(135deg, ${cssColour}, #0f172a)`
                            : "#ffffff",
                          color:
                            active || colour.toLowerCase() !== "white"
                              ? active
                                ? "#ffffff"
                                : "#0f172a"
                              : "#0f172a",
                          borderColor: active ? cssColour : "#dbe3ef",
                          boxShadow: active
                            ? "0 10px 18px rgba(15,23,42,0.16)"
                            : "none",
                        }}
                      >
                        <span
                          style={{
                            ...styles.colourDot,
                            background: cssColour,
                            borderColor:
                              colour.toLowerCase() === "white"
                                ? "#cbd5e1"
                                : cssColour,
                          }}
                        />

                        {active ? "✓ " : ""}
                        {colour}
                      </button>
                    );
                  })}
                </div>

                <div style={styles.inlineControls}>
                  <input
                    value={customColour}
                    onChange={(event) => setCustomColour(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCustomColour();
                      }
                    }}
                    style={{ ...styles.input, flex: "1 1 240px" }}
                    placeholder="Gold, Silver, #00ff00"
                  />

                  <button
                    type="button"
                    onClick={addCustomColour}
                    style={styles.lightButton}
                  >
                    Add colour
                  </button>
                </div>

                <p style={styles.helpText}>
                  Selected:{" "}
                  {selectedColours.length
                    ? selectedColours.join(", ")
                    : "None"}
                </p>
              </section>

              {isFiftyFifty ? (
                <section style={styles.disabledPanel}>
                  <div style={styles.disabledEyebrow}>Disabled for 50/50</div>
                  <h3 style={styles.subTitle}>Bundle offers</h3>
                  <p style={styles.sectionDescription}>
                    Bundle offers are disabled for 50/50 raffles in this first
                    release so the cash prize pot remains simple and transparent.
                  </p>
                </section>
              ) : (
                <section style={styles.innerPanel}>
                  <div style={styles.innerHeader}>
                    <div>
                      <h3 style={styles.subTitle}>Offers</h3>

                      <p style={styles.sectionDescription}>
                        Optional bundle pricing. Example: 3 tickets for 12.00.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={addOffer}
                      style={styles.lightButton}
                    >
                      + Add offer
                    </button>
                  </div>

                  <div style={styles.offerList}>
                    {offers.map((offer, index) => (
                      <div key={offer.id} style={styles.offerCard}>
                        <div style={styles.offerCardTop}>
                          <div>
                            <div style={styles.offerBadge}>
                              {index === 0
                                ? "Featured offer"
                                : `Offer ${index + 1}`}
                            </div>

                            <div style={styles.offerTitle}>
                              {offer.label.trim() || "Bundle offer"}
                            </div>
                          </div>

                          <label style={styles.checkboxLabel}>
                            <input
                              type="checkbox"
                              checked={offer.is_active}
                              onChange={(event) =>
                                updateOffer(offer.id, {
                                  is_active: event.target.checked,
                                })
                              }
                            />
                            Use
                          </label>
                        </div>

                        <div style={styles.offerGrid}>
                          <Field label="Label">
                            <input
                              value={offer.label}
                              onChange={(event) =>
                                updateOffer(offer.id, {
                                  label: event.target.value,
                                })
                              }
                              placeholder="3 for 12"
                              style={styles.input}
                            />
                          </Field>

                          <Field label="Number of tickets">
                            <input
                              value={offer.quantity}
                              onChange={(event) =>
                                updateOffer(offer.id, {
                                  quantity: event.target.value,
                                })
                              }
                              type="number"
                              min="1"
                              step="1"
                              placeholder="3"
                              style={styles.input}
                            />
                          </Field>

                          <Field label="Total offer price">
                            <input
                              value={offer.price}
                              onChange={(event) =>
                                updateOffer(offer.id, {
                                  price: event.target.value,
                                })
                              }
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="12.00"
                              style={styles.input}
                            />
                          </Field>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeOffer(offer.id)}
                          disabled={offers.length <= 1}
                          style={{
                            ...styles.dangerButton,
                            cursor:
                              offers.length <= 1 ? "not-allowed" : "pointer",
                            opacity: offers.length <= 1 ? 0.55 : 1,
                          }}
                        >
                          Remove offer
                        </button>
                      </div>
                    ))}
                  </div>

                  <p style={styles.helpText}>
                    Leave unused rows blank. Save the raffle to apply changes.
                  </p>
                </section>
              )}
            </div>
          </section>

          <section style={styles.section}>
            <SectionHeader
              eyebrow="Section 4"
              title={isFiftyFifty ? "50/50 prize setup" : "Prize setup"}
              description={
                isFiftyFifty
                  ? "The winner prize is calculated automatically from paid ticket sales."
                  : "Add prizes and choose which ones appear publicly on the campaign page."
              }
            />

            {isFiftyFifty ? (
              <div style={styles.fiftyFiftyPrizePanel}>
                <div style={styles.fiftyFiftyPrizeStat}>
                  <span>Winner share</span>
                  <strong>50%</strong>
                </div>

                <div style={styles.fiftyFiftyPrizeStat}>
                  <span>Cause share</span>
                  <strong>50%</strong>
                </div>

                <p style={styles.helpText}>
                  The final prize amount will be calculated from paid ticket
                  sales and snapshotted at draw time. Manual prize rows are not
                  used for 50/50 raffles.
                </p>
              </div>
            ) : (
              <div style={styles.prizePanel}>
                <div style={styles.innerHeader}>
                  <div>
                    <h3 style={styles.subTitle}>Public prize list</h3>

                    <p style={styles.sectionDescription}>
                      These prizes can also be used later during winner draws.
                    </p>
                  </div>

                  <button type="button" onClick={addPrize} style={styles.goldButton}>
                    + Add prize
                  </button>
                </div>

                <div style={styles.prizeList}>
                  {prizes.map((prize, index) => (
                    <div key={prize.id} style={styles.prizeRow}>
                      <div style={styles.rowHeader}>
                        <strong>Prize {index + 1}</strong>

                        <label style={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={prize.is_public}
                            onChange={(event) =>
                              updatePrize(prize.id, {
                                is_public: event.target.checked,
                              })
                            }
                          />
                          Show publicly
                        </label>
                      </div>

                      <div style={styles.prizeGrid}>
                        <Field label="Position">
                          <input
                            value={prize.position}
                            onChange={(event) =>
                              updatePrize(prize.id, {
                                position: event.target.value,
                              })
                            }
                            type="number"
                            min="1"
                            step="1"
                            style={styles.input}
                          />
                        </Field>

                        <Field label="Prize title">
                          <input
                            value={prize.title}
                            onChange={(event) =>
                              updatePrize(prize.id, { title: event.target.value })
                            }
                            placeholder="Prize title"
                            style={styles.input}
                          />
                        </Field>
                      </div>

                      <Field label="Description optional">
                        <textarea
                          value={prize.description}
                          onChange={(event) =>
                            updatePrize(prize.id, {
                              description: event.target.value,
                            })
                          }
                          rows={2}
                          style={styles.textarea}
                        />
                      </Field>

                      <button
                        type="button"
                        onClick={() => removePrize(prize.id)}
                        disabled={prizes.length <= 1}
                        style={{
                          ...styles.dangerButton,
                          cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                          opacity: prizes.length <= 1 ? 0.55 : 1,
                        }}
                      >
                        Remove prize
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <details style={styles.legalDetails}>
            <summary style={styles.legalSummary}>
              <div>
                <div style={styles.legalEyebrow}>Section 5</div>

                <h2 style={styles.legalTitle}>Legal entry question</h2>

                <p style={styles.legalText}>
                  Optional skill-based question for the public checkout flow.
                  {isFiftyFifty
                    ? " 50/50 raffles use this same raffle legal structure."
                    : ""}
                </p>
              </div>

              <span style={styles.legalToggle}>Open / close</span>
            </summary>

            <div style={styles.legalBody}>
              <div style={styles.twoColumn}>
                <Field label="Question">
                  <input
                    name="question_text_preview"
                    value={questionText}
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder="e.g. What colour is a London taxi?"
                    style={styles.input}
                  />
                </Field>

                <Field label="Correct answer">
                  <input
                    name="question_answer_preview"
                    value={questionAnswer}
                    onChange={(event) => setQuestionAnswer(event.target.value)}
                    placeholder="e.g. black"
                    style={styles.input}
                  />
                </Field>
              </div>

              <p style={styles.helpText}>
                The public raffle page requires this answer before checkout when
                a question is set.
              </p>
            </div>
          </details>

          <section style={styles.submitBar}>
            <div style={styles.submitText}>
              <strong style={{ color: "#0f172a" }}>Create raffle</strong>

              <div style={styles.mutedSmall}>
                Save as draft first if you want to review before publishing.
              </div>
            </div>

            <button type="submit" style={styles.submitButton}>
              Create raffle
            </button>
          </section>
        </div>

        <aside style={styles.sideColumn}>
          <div style={styles.sideCard}>
            <div style={styles.sideEyebrow}>Campaign readiness</div>

            <h3 style={styles.sideTitle}>Before publishing</h3>

            <div style={styles.checkList}>
              <CheckItem done={Boolean(title.trim())}>
                Add campaign title
              </CheckItem>

              <CheckItem done={Boolean(slug.trim())}>
                Confirm public slug
              </CheckItem>

              <CheckItem done={Boolean(description.trim())}>
                Add description
              </CheckItem>

              <CheckItem done={totalTickets > 0}>
                Set available tickets
              </CheckItem>

              <CheckItem done={selectedColours.length > 0}>
                Choose ticket colours
              </CheckItem>

              <CheckItem done={isFiftyFifty || publicPrizesCount > 0}>
                {isFiftyFifty ? "50/50 prize pot enabled" : "Add public prize"}
              </CheckItem>
            </div>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.sideEyebrow}>
              {isFiftyFifty ? "50/50 preview" : "Public offer preview"}
            </div>

            <h3 style={styles.sideTitle}>
              {isFiftyFifty
                ? "50% to winner"
                : featuredOffer?.label?.trim() || "No active offer yet"}
            </h3>

            <p style={styles.sideText}>
              {isFiftyFifty
                ? "The public page will show the estimated winner prize once paid ticket sales are available."
                : featuredOffer
                  ? `${featuredOffer.quantity || "0"} tickets for ${formatPreviewMoney(
                      featuredOffer.price,
                      currency,
                    )}`
                  : "Add an offer to show a highlighted bundle for buyers."}
            </p>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.sideEyebrow}>Ticket colour preview</div>

            <div style={styles.sideColourGrid}>
              {selectedColours.length ? (
                selectedColours.slice(0, 12).map((colour) => (
                  <div key={colour} style={styles.sideColourItem}>
                    <span
                      style={{
                        ...styles.sideColourDot,
                        background: colourToCss(colour),
                      }}
                    />
                    <span>{colour}</span>
                  </div>
                ))
              ) : (
                <p style={styles.sideText}>No colours selected.</p>
              )}
            </div>
          </div>
        </aside>
      </section>
    </form>
  );
}

function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetric}>
      <div style={styles.heroMetricLabel}>{label}</div>
      <div style={styles.heroMetricValue}>{value}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div style={styles.sectionHeader}>
      <div>
        <div style={styles.sectionEyebrow}>{eyebrow}</div>
        <h2 style={styles.sectionTitle}>{title}</h2>
        <p style={styles.sectionDescription}>{description}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

function CheckItem({
  done,
  children,
}: {
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div style={styles.checkItem}>
      <span
        style={{
          ...styles.checkIcon,
          background: done ? "#16a34a" : "#e2e8f0",
          color: done ? "#ffffff" : "#64748b",
        }}
      >
        {done ? "✓" : "•"}
      </span>

      <span>{children}</span>
    </div>
  );
}

const responsiveStyles = `
  .new-raffle-form,
  .new-raffle-form * {
    box-sizing: border-box;
  }

  .new-raffle-form {
    overflow-x: hidden;
  }

  .new-raffle-form img,
  .new-raffle-form input,
  .new-raffle-form textarea,
  .new-raffle-form select,
  .new-raffle-form button {
    max-width: 100%;
  }

  @media (max-width: 760px) {
    .new-raffle-form {
      width: 100% !important;
      max-width: 100% !important;
    }

    .new-raffle-form [style*="grid-template-columns"] {
      grid-template-columns: 1fr !important;
    }

    .new-raffle-form [style*="position: sticky"] {
      position: static !important;
      top: auto !important;
    }

    .new-raffle-form section,
    .new-raffle-form aside,
    .new-raffle-form div,
    .new-raffle-form label {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .new-raffle-form input[type="datetime-local"] {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      display: block !important;
      box-sizing: border-box !important;
      appearance: none !important;
      -webkit-appearance: none !important;
    }

    .new-raffle-form input[name="draw_at"] {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      overflow: hidden !important;
    }

    .new-raffle-form h1 {
      font-size: clamp(34px, 12vw, 46px) !important;
      line-height: 1.02 !important;
      letter-spacing: -0.055em !important;
      overflow-wrap: anywhere !important;
      word-break: normal !important;
    }

    .new-raffle-form h2 {
      font-size: clamp(28px, 9vw, 36px) !important;
      line-height: 1.05 !important;
      overflow-wrap: anywhere !important;
    }

    .new-raffle-form h3 {
      overflow-wrap: anywhere !important;
    }

    .new-raffle-form p,
    .new-raffle-form span,
    .new-raffle-form strong {
      overflow-wrap: anywhere !important;
    }

    .new-raffle-form [style*="height: 220px"] {
      height: auto !important;
      min-height: 190px !important;
      aspect-ratio: 16 / 10 !important;
    }

    .new-raffle-form [style*="display: flex"] {
      flex-wrap: wrap !important;
    }

    .new-raffle-form button,
    .new-raffle-form a {
      min-height: 46px !important;
    }

    .new-raffle-subtype-grid {
      grid-template-columns: 1fr !important;
    }
  }

  @media (max-width: 520px) {
    .new-raffle-form {
      gap: 14px !important;
    }

    .new-raffle-form section,
    .new-raffle-form details {
      border-radius: 22px !important;
    }

    .new-raffle-form input,
    .new-raffle-form textarea,
    .new-raffle-form select {
      font-size: 16px !important;
    }

    .new-raffle-form button {
      width: 100% !important;
      justify-content: center !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  form: {
    display: "grid",
    gap: 16,
    marginTop: 0,
    width: "100%",
    maxWidth: "100%",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, 0.85fr)",
    gap: 20,
    alignItems: "stretch",
    padding: "clamp(20px, 4vw, 26px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12,
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 5vw, 48px)",
    lineHeight: 1.02,
    letterSpacing: "-0.06em",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    maxWidth: 680,
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
  },
  heroSlug: {
    margin: "10px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 800,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "14px 0 0",
    color: "#dbeafe",
    lineHeight: 1.65,
    maxWidth: 720,
    overflowWrap: "anywhere",
    fontSize: 16,
  },
  heroMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 22,
  },
  heroMetric: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  heroMetricLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetricValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  previewShell: {
    display: "grid",
    alignContent: "start",
    gap: 12,
    borderRadius: 24,
    padding: 14,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  previewBadge: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  previewImageWrap: {
    height: 220,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderImage: {
    width: "min(78%, 210px)",
    height: "min(78%, 210px)",
    objectFit: "contain",
    display: "block",
  },
  previewCardBody: {
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  previewText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  },
  previewBottom: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 12,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    marginTop: 5,
    wordBreak: "break-word",
  },
  builderGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 300px",
    gap: 16,
    alignItems: "start",
  },
  mainColumn: {
    display: "grid",
    gap: 16,
    minWidth: 0,
  },
  sideColumn: {
    display: "grid",
    gap: 16,
    position: "sticky",
    top: 16,
    minWidth: 0,
  },
  sideCard: {
    padding: 16,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  sideEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sideTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.02em",
  },
  sideText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  checkList: {
    display: "grid",
    gap: 10,
    marginTop: 14,
  },
  checkItem: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    color: "#334155",
    fontSize: 14,
    fontWeight: 800,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
    flexShrink: 0,
  },
  sideColourGrid: {
    display: "grid",
    gap: 8,
    marginTop: 12,
  },
  sideColourItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#334155",
    fontSize: 14,
    fontWeight: 800,
  },
  sideColourDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    border: "1px solid #cbd5e1",
  },
  section: {
    padding: "clamp(16px, 4vw, 20px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.03em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  formInner: {
    display: "grid",
    gap: 16,
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  threeColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))",
    gap: 12,
  },
  subtypeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  subtypeCard: {
    display: "grid",
    gap: 8,
    textAlign: "left",
    padding: 16,
    borderRadius: 20,
    border: "1px solid",
    cursor: "pointer",
    color: "#0f172a",
  },
  subtypeTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  subtypeText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 750,
  },
  subtypeBadge: {
    justifySelf: "start",
    marginTop: 4,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  fiftyFiftyInfo: {
    display: "grid",
    gap: 6,
    padding: 16,
    borderRadius: 20,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 800,
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 46,
    padding: "11px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 16,
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: {
    minWidth: 0,
  },
  subTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    letterSpacing: "-0.01em",
  },
  previewBox: {
    height: 220,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholderImage: {
    width: "min(78%, 190px)",
    height: "min(78%, 190px)",
    objectFit: "contain",
    display: "block",
  },
  innerPanel: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },
  disabledPanel: {
    display: "grid",
    gap: 8,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    minWidth: 0,
    overflow: "hidden",
  },
  disabledEyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  prizePanel: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #f8fafc 100%)",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },
  fiftyFiftyPrizePanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
    gap: 12,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 48%, #f8fafc 100%)",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },
  fiftyFiftyPrizeStat: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #fde68a",
    color: "#92400e",
  },
  innerHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  colourGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  colourPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 900,
    border: "1px solid",
    transition: "transform 0.16s ease, box-shadow 0.16s ease",
  },
  colourDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-block",
  },
  inlineControls: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  lightButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  goldButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #facc15",
    background: "#fef3c7",
    color: "#92400e",
    cursor: "pointer",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  offerList: {
    display: "grid",
    gap: 12,
  },
  offerCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#ffffff",
    minWidth: 0,
  },
  offerCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  offerBadge: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  offerTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    marginTop: 4,
  },
  offerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))",
    gap: 10,
    alignItems: "end",
  },
  checkboxLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    fontWeight: 900,
    color: "#334155",
    cursor: "pointer",
  },
  dangerButton: {
    width: "fit-content",
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
  },
  prizeList: {
    display: "grid",
    gap: 12,
  },
  prizeRow: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #fde68a",
    borderRadius: 18,
    background: "#ffffff",
    minWidth: 0,
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(96px, 120px) minmax(0, 1fr)",
    gap: 12,
  },
  legalDetails: {
    padding: "clamp(16px, 4vw, 20px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  legalSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
  },
  legalEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  legalTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.03em",
  },
  legalText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  legalToggle: {
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    flexShrink: 0,
  },
  legalBody: {
    marginTop: 16,
    display: "grid",
    gap: 12,
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    margin: 0,
    overflowWrap: "anywhere",
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  submitText: {
    minWidth: 0,
    flex: "1 1 240px",
  },
  submitButton: {
    padding: "13px 20px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
};
