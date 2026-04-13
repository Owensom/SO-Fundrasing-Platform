import React, { useMemo, useState } from "react";
import RaffleColoursEditor, {
  RaffleColourInput,
} from "./RaffleColoursEditor";

export type RaffleOfferInput = {
  id?: string;
  name: string;
  priceCents: number;
  entryCount: number;
  sortOrder: number;
  isActive: boolean;
};

export type RaffleFormValues = {
  id?: string;
  tenantSlug: string;
  title: string;
  slug: string;
  description: string;
  status: "draft" | "active" | "archived";
  colours: RaffleColourInput[];
  offers: RaffleOfferInput[];
};

type Props = {
  mode: "create" | "edit";
  initialValues?: Partial<RaffleFormValues>;
  raffleId?: string;
};

function makeEmptyOffer(sortOrder: number): RaffleOfferInput {
  return {
    name: "",
    priceCents: 500,
    entryCount: 1,
    sortOrder,
    isActive: true,
  };
}

export default function RaffleForm({
  mode,
  initialValues,
  raffleId,
}: Props) {
  const [form, setForm] = useState<RaffleFormValues>({
    id: initialValues?.id,
    tenantSlug: initialValues?.tenantSlug ?? "demo-a",
    title: initialValues?.title ?? "",
    slug: initialValues?.slug ?? "",
    description: initialValues?.description ?? "",
    status: initialValues?.status ?? "draft",
    colours: initialValues?.colours ?? [],
    offers: initialValues?.offers ?? [makeEmptyOffer(0)],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const heading = useMemo(
    () => (mode === "create" ? "Create raffle" : "Edit raffle"),
    [mode]
  );

  function update<K extends keyof RaffleFormValues>(
    key: K,
    value: RaffleFormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateOffer(index: number, patch: Partial<RaffleOfferInput>) {
    setForm((prev) => ({
      ...prev,
      offers: prev.offers.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function addOffer() {
    setForm((prev) => ({
      ...prev,
      offers: [
        ...prev.offers,
        makeEmptyOffer(prev.offers.length),
      ].map((offer, index) => ({ ...offer, sortOrder: index })),
    }));
  }

  function removeOffer(index: number) {
    setForm((prev) => ({
      ...prev,
      offers: prev.offers
        .filter((_, i) => i !== index)
        .map((offer, i) => ({ ...offer, sortOrder: i })),
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    if (!form.slug.trim()) {
      setError("Slug is required.");
      return;
    }

    if (form.colours.some((c) => !c.name.trim())) {
      setError("Every colour must have a name.");
      return;
    }

    if (form.offers.some((o) => !o.name.trim())) {
      setError("Every offer must have a name.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...(mode === "edit" ? { id: raffleId } : {}),
        tenantSlug: form.tenantSlug,
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        status: form.status,
        colours: form.colours.map((c, index) => ({
          id: c.id,
          name: c.name.trim(),
          hex: c.hex,
          sortOrder: index,
          isActive: c.isActive,
        })),
        offers: form.offers.map((o, index) => ({
          id: o.id,
          name: o.name.trim(),
          priceCents: Number(o.priceCents),
          entryCount: Number(o.entryCount),
          sortOrder: index,
          isActive: o.isActive,
        })),
      };

      const res = await fetch("/api/admin/raffles", {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save raffle");
      }

      setSuccess(mode === "create" ? "Raffle created." : "Raffle updated.");
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ marginBottom: 24 }}>{heading}</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 20 }}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Basic details</h2>

          <div style={grid2Style}>
            <div>
              <label style={labelStyle}>Tenant slug</label>
              <input
                value={form.tenantSlug}
                onChange={(e) => update("tenantSlug", e.target.value)}
                style={inputStyle}
                placeholder="demo-a"
              />
            </div>

            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  update(
                    "status",
                    e.target.value as RaffleFormValues["status"]
                  )
                }
                style={inputStyle}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Title</label>
              <input
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                style={inputStyle}
                placeholder="Spring Fundraiser"
              />
            </div>

            <div>
              <label style={labelStyle}>Slug</label>
              <input
                value={form.slug}
                onChange={(e) => update("slug", e.target.value)}
                style={inputStyle}
                placeholder="spring-fundraiser"
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Description</label>
            <textarea
