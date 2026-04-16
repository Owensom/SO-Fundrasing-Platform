import React, { useMemo, useState } from "react";
import ColourOptionsEditor, {
  ColourOption,
} from "../../../components/admin/ColourOptionsEditor";
import ImageUploadField from "../../../components/admin/ImageUploadField";

type OfferFormRow = {
  label: string;
  tickets: string;
  price: string;
  is_active: boolean;
};

type FormState = {
  title: string;
  description: string;
  slug: string;
  status: "draft" | "published" | "archived";
  ticketPrice: string;
  totalTickets: string;
  soldTickets: string;
  heroImageUrl: string;
  backgroundImageUrl: string;
  currencyCode: "GBP" | "USD" | "EUR";
  colourSelectionMode: "manual" | "automatic" | "both";
  numberSelectionMode: "none" | "manual" | "automatic" | "both";
  numberRangeStart: string;
  numberRangeEnd: string;
  colours: ColourOption[];
  offers: OfferFormRow[];
};

const INITIAL_STATE: FormState = {
  title: "",
  description: "",
  slug: "",
  status: "published",
  ticketPrice: "5.00",
  totalTickets: "100",
  soldTickets: "0",
  heroImageUrl: "",
  backgroundImageUrl: "",
  currencyCode: "GBP",
  colourSelectionMode: "both",
  numberSelectionMode: "both",
  numberRangeStart: "1",
  numberRangeEnd: "200",
  colours: [],
  offers: [
    { label: "3 Tickets", tickets: "3", price: "10.00", is_active: true },
    { label: "10 Tickets", tickets: "10", price: "25.00", is_active: true },
  ],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminCreateRafflePage() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const resolvedSlug = useMemo(() => {
    return form.slug.trim() || slugify(form.title);
  }, [form.slug, form.title]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addOffer() {
    setForm((prev) => ({
      ...prev,
      offers: [
        ...prev.offers,
        { label: "", tickets: "1", price: "1.00", is_active: true },
      ],
    }));
  }

  function removeOffer(index: number) {
    setForm((prev) => ({
      ...prev,
      offers: prev.offers.filter((_, i) => i !== index),
    }));
  }

  function updateOffer<K extends keyof OfferFormRow>(
    index: number,
    key: K,
    value: OfferFormRow[K]
  ) {
    setForm((prev) => ({
      ...prev,
      offers: prev.offers.map((offer, i) =>
        i === index ? { ...offer, [key]: value } : offer
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        slug: resolvedSlug,
        imageUrl: form.heroImageUrl || form.backgroundImageUrl || "",
        ticketPrice: Number(form.ticketPrice),
        totalTickets: Number(form.totalTickets),
        soldTickets: Number(form.soldTickets || 0),
        offers: form.offers.map((o, i) => ({
          label: o.label,
          tickets: Number(o.tickets),
          price: Number(o.price),
          sort_order: i,
          is_active: o.is_active,
        })),
      };

      const res = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      const contentType = res.headers.get("content-type") || "";

      let json: any = null;
      if (contentType.includes("application/json")) {
        json = JSON.parse(raw);
      }

      if (!res.ok) {
        throw new Error(json?.error || raw || "Failed to create raffle");
      }

      if (!json) {
        throw new Error("API did not return JSON.");
      }

      setSuccessMessage("Raffle created successfully.");
      setForm(INITIAL_STATE);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Create raffle</h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => updateField("title", e.target.value)}
        />

        <input
          placeholder="Slug"
          value={form.slug}
          onChange={(e) => updateField("slug", e.target.value)}
        />

        <input
          placeholder="Ticket price"
          value={form.ticketPrice}
          onChange={(e) => updateField("ticketPrice", e.target.value)}
        />

        <input
          placeholder="Total tickets"
          value={form.totalTickets}
          onChange={(e) => updateField("totalTickets", e.target.value)}
        />

        <div>
          <h3>Offers</h3>

          {form.offers.map((offer, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <input
                value={offer.label}
                onChange={(e) =>
                  updateOffer(i, "label", e.target.value)
                }
              />
              <input
                value={offer.tickets}
                onChange={(e) =>
                  updateOffer(i, "tickets", e.target.value)
                }
              />
              <input
                value={offer.price}
                onChange={(e) =>
                  updateOffer(i, "price", e.target.value)
                }
              />
              <button type="button" onClick={() => removeOffer(i)}>
                Remove
              </button>
            </div>
          ))}

          <button type="button" onClick={addOffer}>
            + Add offer
          </button>
        </div>

        <button type="submit">
          {saving ? "Saving..." : "Create raffle"}
        </button>

        {error && <div style={{ color: "red" }}>{error}</div>}
        {successMessage && <div style={{ color: "green" }}>{successMessage}</div>}
      </form>
    </div>
  );
}
