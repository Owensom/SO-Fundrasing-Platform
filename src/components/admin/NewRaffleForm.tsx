"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";

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

export default function NewRaffleForm({ tenantSlug }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [drawAt, setDrawAt] = useState("");

  const [imageUrl, setImageUrl] = useState("");
  const [imageFocusX, setImageFocusX] = useState(50);
  const [imageFocusY, setImageFocusY] = useState(50);

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
  }, [offers]);

  const prizesValue = useMemo(() => {
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
  }, [prizes]);

  const questionValue = useMemo(() => {
    const text = questionText.trim();
    const answer = questionAnswer.trim();

    if (!text || !answer) return "";

    return JSON.stringify({ text, answer });
  }, [questionText, questionAnswer]);

  const validOffersCount = useMemo(() => {
    try {
      return JSON.parse(offersValue).length;
    } catch {
      return 0;
    }
  }, [offersValue]);

  const publicPrizesCount = useMemo(() => {
    return prizes.filter((prize) => prize.title.trim() && prize.is_public).length;
  }, [prizes]);

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
    <form action="/api/admin/raffles" method="post" style={styles.form}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="image_url" value={imageUrl} />
      <input
        type="hidden"
        name="image_focus_x"
        value={String(imageFocusX)}
      />
      <input
        type="hidden"
        name="image_focus_y"
        value={String(imageFocusY)}
      />
      <input type="hidden" name="colours" value={coloursValue} />
      <input type="hidden" name="offers" value={offersValue} />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="question" value={questionValue} />
      <input type="hidden" name="total_tickets" value={String(totalTickets)} />

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Create raffle</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {title.trim() ? title : "Build a new raffle"}
            </h1>

            <div style={styles.statusPill}>Draft</div>
          </div>

          <p style={styles.heroSlug}>
            /r/{slug.trim() ? slug : "raffle-slug"}
          </p>

          <p style={styles.heroDescription}>
            Set up the public details, raffle image, pricing, ticket colours,
            offers, prizes and optional legal entry question.
          </p>
        </div>

        <div style={styles.heroImageWrap}>
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
            <div style={styles.heroImageEmpty}>🎟️</div>
          )}
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Total tickets" value={totalTickets} />
        <SummaryCard label="Numbers / colour" value={numbersPerColour} />
        <SummaryCard label="Colours" value={selectedColours.length} />
        <SummaryCard label="Offers" value={validOffersCount} />
        <SummaryCard label="Public prizes" value={publicPrizesCount} />
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Create raffle</h2>

            <p style={styles.sectionDescription}>
              Add the same details you can later edit from the raffle editor.
            </p>
          </div>
        </div>
