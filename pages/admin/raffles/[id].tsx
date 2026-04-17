import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  createRaffle,
  getAdminRaffle,
  listAdminRaffles,
  updateRaffle,
} from "../../../src/api";

type CurrencyCode = "GBP" | "USD" | "EUR";

function currencySymbol(currency: CurrencyCode) {
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  return "£";
}

function formatCurrency(value: number, currency: CurrencyCode) {
  return `${currencySymbol(currency)}${value.toFixed(2)}`;
}

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

function toOptionalNumber(value: string) {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type Offer = {
  id: string;
  label: string;
  price: string;
  quantity: string;
};

export default function AdminRaffleEditPage() {
  const router = useRouter();
  const routeId = typeof router.query.id === "string" ? router.query.id : "";

  const [existingRaffleId, setExistingRaffleId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [startNumber, setStartNumber] = useState("");
  const [endNumber, setEndNumber] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("GBP");

  const [offers, setOffers] = useState<Offer[]>([]);
  const [colours, setColours] = useState<string[]>([]);

  // ---------------- LOAD ----------------

  useEffect(() => {
    if (!router.isReady || !routeId) return;

    async function load() {
      try {
        const raffles = await listAdminRaffles();

        const match = raffles.find(
          (r) => r.slug === routeId || String(r.id) === routeId,
        );

        if (!match?.id) {
          setSlug(routeId);
          setIsLoading(false);
          return;
        }

        const raffle = await getAdminRaffle(String(match.id));

        setExistingRaffleId(String(raffle.id));
        setTitle(raffle.title || "");
        setSlug(raffle.slug || "");
        setDescription(raffle.description || "");
        setImageUrl(raffle.imageUrl || "");
        setStartNumber(String(raffle.startNumber || ""));
        setEndNumber(String(raffle.endNumber || ""));
        setTicketPrice(String(raffle.ticketPrice || ""));
        setCurrency((raffle.currency as CurrencyCode) || "GBP");
        setColours(raffle.colours || []);
        setOffers(
          (raffle.offers || []).map((o) => ({
            id: uid(),
            label: o.label,
            price: String(o.price),
            quantity: String(o.quantity),
          })),
        );
      } catch {
        setSlug(routeId);
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [router.isReady, routeId]);

  // ---------------- CALCS ----------------

  const parsedStart = toOptionalNumber(startNumber);
  const parsedEnd = toOptionalNumber(endNumber);
  const parsedPrice = toOptionalNumber(ticketPrice);

  const numbersPerColour =
    parsedStart !== null && parsedEnd !== null
      ? parsedEnd - parsedStart + 1
      : 0;

  const totalTickets = numbersPerColour * colours.length;

  // ---------------- SAVE ----------------

  async function persist() {
    const payload = {
      title,
      slug,
      description,
      imageUrl,
      startNumber: parsedStart || 0,
      endNumber: parsedEnd || 0,
      numbersPerColour,
      colourCount: colours.length,
      totalTickets,
      currency,
      ticketPrice: parsedPrice || 0,
      offers: offers.map((o) => ({
        label: o.label,
        price: Number(o.price),
        quantity: Number(o.quantity),
      })),
      colours,
      sold: [],
      reserved: [],
    };

    if (existingRaffleId) {
      return updateRaffle(existingRaffleId, payload);
    }

    const all = await listAdminRaffles();
    const match = all.find((r) => r.slug === slug);

    if (match?.id) {
      setExistingRaffleId(String(match.id));
      return updateRaffle(String(match.id), payload);
    }

    const created = await createRaffle(payload);
    setExistingRaffleId(String(created.id));
    return created;
  }

  async function handleSave() {
    setStatus("Saving...");
    try {
      await persist();
      setStatus("Saved");
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  async function handleComplete() {
    setStatus("Completing...");
    try {
      const saved = await persist();
      router.push(`/r/${saved.slug}`);
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  if (isLoading) return <div style={{ padding: 40 }}>Loading…</div>;

  // ---------------- UI ----------------

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1>Edit raffle</h1>

      <div style={{ display: "grid", gap: 12 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSlug(slugify(e.target.value));
          }}
        />

        <input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* IMAGE UPLOAD */}
        <input
          type="file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const res = await fetch("/api/upload", {
              method: "POST",
              headers: { "x-filename": file.name },
              body: file,
            });

            const data = await res.json();
            setImageUrl(data.url);
          }}
        />

        {imageUrl && (
          <img src={imageUrl} style={{ width: "100%", height: 200, objectFit: "cover" }} />
        )}

        {/* NUMBERS + CURRENCY */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <input
            placeholder="Start"
            value={startNumber}
            onChange={(e) => setStartNumber(e.target.value)}
          />

          <input
            placeholder="End"
            value={endNumber}
            onChange={(e) => setEndNumber(e.target.value)}
          />

          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          >
            <option value="GBP">£ GBP</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
          </select>

          <input
            placeholder={`Price (${currencySymbol(currency)})`}
            value={ticketPrice}
            onChange={(e) => setTicketPrice(e.target.value)}
          />
        </div>

        <div>Total tickets: {totalTickets}</div>

        {/* COLOURS */}
        <input
          placeholder="#ff0000"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const val = (e.target as HTMLInputElement).value;
              if (!colours.includes(val)) setColours([...colours, val]);
            }
          }}
        />

        <div style={{ display: "flex", gap: 8 }}>
          {colours.map((c) => (
            <div key={c} style={{ background: c, padding: 10 }}>
              {c}
            </div>
          ))}
        </div>

        {/* BUTTONS */}
        <button onClick={handleSave}>Save</button>
        <button onClick={handleComplete}>Complete</button>

        {status && <div>{status}</div>}
      </div>
    </div>
  );
}
