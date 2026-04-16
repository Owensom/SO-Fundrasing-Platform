import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import ColourOptionsEditor, {
  ColourOption,
} from "../../../components/admin/ColourOptionsEditor";
import ImageUploadField from "../../../components/admin/ImageUploadField";

type FormState = {
  id: string;
  title: string;
  description: string;
  slug: string;
  status: string;
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
};

const INITIAL_STATE: FormState = {
  id: "",
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
};

function slugify(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminRaffleEditPage() {
  const router = useRouter();
  const routeId = typeof router.query.id === "string" ? router.query.id : "";

  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const showColours = useMemo(
    () =>
      form.colourSelectionMode === "manual" ||
      form.colourSelectionMode === "both",
    [form.colourSelectionMode]
  );

  const showNumberRange = useMemo(
    () => form.numberSelectionMode !== "none",
    [form.numberSelectionMode]
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ✅ AUTO-SYNC LOGIC
  useEffect(() => {
    if (!showNumberRange) return;

    const start = Number(form.numberRangeStart || "1");
    const end = Number(form.numberRangeEnd || "0");

    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    if (end < start) return;

    const total = end - start + 1;

    if (String(total) !== form.totalTickets) {
      setForm((prev) => ({
        ...prev,
        totalTickets: String(total),
      }));
    }
  }, [
    form.numberRangeStart,
    form.numberRangeEnd,
    showNumberRange,
  ]);

  useEffect(() => {
    if (!router.isReady) return;
    if (!routeId) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await fetch(
          `/api/admin/raffle-details?id=${encodeURIComponent(
            routeId
          )}&tenantSlug=demo-a`
        );

        const json = await res.json();
        const raffle = json?.raffle;

        setForm({
          id: raffle?.id || "",
          title: raffle?.title || "",
          description: raffle?.description || "",
          slug: raffle?.slug || "",
          status: raffle?.status || "published",
          ticketPrice: String(
            Number(raffle?.raffleConfig?.singleTicketPriceCents || 0) / 100
          ),
          totalTickets: String(raffle?.raffleConfig?.totalTickets || 0),
          soldTickets: String(raffle?.raffleConfig?.soldTickets || 0),
          heroImageUrl: raffle?.heroImageUrl || "",
          backgroundImageUrl: raffle?.raffleConfig?.backgroundImageUrl || "",
          currencyCode: raffle?.raffleConfig?.currencyCode || "GBP",
          colourSelectionMode:
            raffle?.raffleConfig?.colourSelectionMode || "both",
          numberSelectionMode:
            raffle?.raffleConfig?.numberSelectionMode || "none",
          numberRangeStart:
            raffle?.raffleConfig?.numberRangeStart != null
              ? String(raffle.raffleConfig.numberRangeStart)
              : "1",
          numberRangeEnd:
            raffle?.raffleConfig?.numberRangeEnd != null
              ? String(raffle.raffleConfig.numberRangeEnd)
              : "200",
          colours: raffle?.raffleConfig?.colours || [],
        });

        setSlugTouched(false);
      } catch (err: any) {
        setError(err?.message || "Failed to load raffle");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router.isReady, routeId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        id: form.id,
        tenantSlug: "demo-a",
        title: form.title,
        description: form.description,
        slug: slugify(form.slug || form.title),
        status: form.status,
        ticketPrice: Number(form.ticketPrice),
        totalTickets: Number(form.totalTickets),
        soldTickets: Number(form.soldTickets || 0),
        heroImageUrl: form.heroImageUrl || "",
        backgroundImageUrl: form.backgroundImageUrl || "",
        currencyCode: form.currencyCode,
        colourSelectionMode: form.colourSelectionMode,
        numberSelectionMode: form.numberSelectionMode,
        numberRangeStart:
          form.numberSelectionMode === "none"
            ? null
            : Number(form.numberRangeStart),
        numberRangeEnd:
          form.numberSelectionMode === "none"
            ? null
            : Number(form.numberRangeEnd),
        colours: form.colours,
      };

      const res = await fetch("/api/admin/raffles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update raffle");
      }

      setSuccessMessage("Raffle updated successfully.");
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Edit raffle</h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <input
          value={form.title}
          onChange={(e) => {
            const next = e.target.value;
            setForm((prev) => ({
              ...prev,
              title: next,
              slug: slugTouched ? prev.slug : slugify(next),
            }));
          }}
        />

        {showNumberRange && (
          <>
            <input
              type="number"
              value={form.numberRangeStart}
              onChange={(e) =>
                updateField("numberRangeStart", e.target.value)
              }
            />

            <input
              type="number"
              value={form.numberRangeEnd}
              onChange={(e) =>
                updateField("numberRangeEnd", e.target.value)
              }
            />
          </>
        )}

        {/* 🔒 Disabled when using numbers */}
        <input
          type="number"
          value={form.totalTickets}
          disabled={showNumberRange}
        />

        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>

        {error && <div style={{ color: "red" }}>{error}</div>}
        {successMessage && <div style={{ color: "green" }}>{successMessage}</div>}
      </form>
    </div>
  );
}
