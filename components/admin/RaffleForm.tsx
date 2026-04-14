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
      offers: [...prev.offers, makeEmptyOffer(prev.offers.length)].map(
        (offer, index) => ({ ...offer, sortOrder: index })
      ),
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
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              style={textareaStyle}
              placeholder="Describe the raffle"
              rows={4}
            />
          </div>
        </section>

        <section style={cardStyle}>
          <RaffleColoursEditor
            value={form.colours}
            onChange={(next) => update("colours", next)}
          />
        </section>

        <section style={cardStyle}>
          <div style={sectionHeaderRowStyle}>
            <h2 style={sectionTitleStyle}>Offers</h2>
            <button type="button" onClick={addOffer} style={secondaryButtonStyle}>
              + Add offer
            </button>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {form.offers.map((offer, index) => (
              <div key={offer.id ?? index} style={offerCardStyle}>
                <div style={grid5Style}>
                  <div>
                    <label style={labelStyle}>Name</label>
                    <input
                      value={offer.name}
                      onChange={(e) =>
                        updateOffer(index, { name: e.target.value })
                      }
                      style={inputStyle}
                      placeholder="3 Tickets"
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Price (cents)</label>
                    <input
                      type="number"
                      min={0}
                      value={offer.priceCents}
                      onChange={(e) =>
                        updateOffer(index, {
                          priceCents: Number(e.target.value || 0),
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Entry count</label>
                    <input
                      type="number"
                      min={1}
                      value={offer.entryCount}
                      onChange={(e) =>
                        updateOffer(index, {
                          entryCount: Number(e.target.value || 1),
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Sort order</label>
                    <input
                      type="number"
                      min={0}
                      value={offer.sortOrder}
                      onChange={(e) =>
                        updateOffer(index, {
                          sortOrder: Number(e.target.value || 0),
                        })
                      }
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Active</label>
                    <select
                      value={offer.isActive ? "true" : "false"}
                      onChange={(e) =>
                        updateOffer(index, {
                          isActive: e.target.value === "true",
                        })
                      }
                      style={inputStyle}
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => removeOffer(index)}
                    style={dangerButtonStyle}
                    disabled={form.offers.length <= 1}
                  >
                    Remove offer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {(error || success) && (
          <section style={cardStyle}>
            {error ? (
              <div style={errorStyle}>{error}</div>
            ) : (
              <div style={successStyle}>{success}</div>
            )}
          </section>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="submit" disabled={isSaving} style={primaryButtonStyle}>
            {isSaving
              ? "Saving..."
              : mode === "create"
              ? "Create raffle"
              : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 20,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  marginBottom: 16,
  fontSize: 20,
  fontWeight: 700,
};

const sectionHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 16,
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const grid5Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 600,
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 40,
  padding: "0 12px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  fontSize: 14,
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  fontSize: 14,
  boxSizing: "border-box",
  resize: "vertical",
};

const offerCardStyle: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 16,
  background: "#f9fafb",
};

const primaryButtonStyle: React.CSSProperties = {
  height: 42,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #2563eb",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 600,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #dc2626",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: "#fef2f2",
  color: "#b91c1c",
  border: "1px solid #fecaca",
};

const successStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: "#ecfdf5",
  color: "#065f46",
  border: "1px solid #a7f3d0",
};
