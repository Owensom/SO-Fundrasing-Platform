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

function currencySymbol(code: string) {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  return "£";
}

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

  useEffect(() => {
    if (!router.isReady) return;
    if (!routeId) {
      setLoading(false);
      setError("Missing raffle id.");
      return;
    }

    async function load() {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      try {
        const res = await fetch(
          `/api/admin/raffle-details?id=${encodeURIComponent(
            routeId
          )}&tenantSlug=demo-a`
        );

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load raffle");
        }

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
          colours: Array.isArray(raffle?.raffleConfig?.colours)
            ? raffle.raffleConfig.colours
            : [],
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
        colours: form.colours
          .filter((c) => c.name.trim() && c.hex.trim())
          .map((c) => ({
            name: c.name.trim(),
            hex: c.hex.trim(),
          })),
      };

      const res = await fetch("/api/admin/raffles", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
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

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>Loading raffle...</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Edit raffle</h1>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.card}>
            <label style={styles.label}>Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => {
                const nextTitle = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  title: nextTitle,
                  slug: slugTouched ? prev.slug : slugify(nextTitle),
                }));
              }}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.card}>
            <label style={styles.label}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              style={styles.textarea}
              rows={4}
            />
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  updateField("slug", slugify(e.target.value));
                }}
                style={styles.input}
              />
              <div style={styles.helperText}>
                Public URL: /raffles/{form.slug || "your-raffle-slug"}
              </div>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                style={styles.input}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Currency</label>
              <select
                value={form.currencyCode}
                onChange={(e) =>
                  updateField(
                    "currencyCode",
                    e.target.value as FormState["currencyCode"]
                  )
                }
                style={styles.input}
              >
                <option value="GBP">£ GBP</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>
                Single ticket price ({currencySymbol(form.currencyCode)})
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.ticketPrice}
                onChange={(e) => updateField("ticketPrice", e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Total tickets</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.totalTickets}
                onChange={(e) => updateField("totalTickets", e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Sold tickets</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.soldTickets}
                onChange={(e) => updateField("soldTickets", e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div style={styles.card}>
              <label style={styles.label}>Colour selection</label>
              <select
                value={form.colourSelectionMode}
                onChange={(e) =>
                  updateField(
                    "colourSelectionMode",
                    e.target.value as FormState["colourSelectionMode"]
                  )
                }
                style={styles.input}
              >
                <option value="manual">Customer chooses</option>
                <option value="automatic">Automatic</option>
                <option value="both">Customer chooses or automatic</option>
              </select>
            </div>

            <div style={styles.card}>
              <label style={styles.label}>Number selection</label>
              <select
                value={form.numberSelectionMode}
                onChange={(e) =>
                  updateField(
                    "numberSelectionMode",
                    e.target.value as FormState["numberSelectionMode"]
                  )
                }
                style={styles.input}
              >
                <option value="none">No numbers</option>
                <option value="manual">Customer chooses</option>
                <option value="automatic">Automatic</option>
                <option value="both">Customer chooses or automatic</option>
              </select>
            </div>
          </div>

          {showNumberRange ? (
            <div style={styles.grid2}>
              <div style={styles.card}>
                <label style={styles.label}>Number range start</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.numberRangeStart}
                  onChange={(e) => updateField("numberRangeStart", e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.card}>
                <label style={styles.label}>Number range end</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.numberRangeEnd}
                  onChange={(e) => updateField("numberRangeEnd", e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
          ) : null}

          {showColours ? (
            <ColourOptionsEditor
              value={form.colours}
              onChange={(next) => updateField("colours", next)}
            />
          ) : (
            <div style={styles.cardMuted}>
              Colour selection is automatic only, so no manual colour list is required.
            </div>
          )}

          <div style={styles.grid2}>
            <div style={styles.card}>
              <ImageUploadField
                label="Hero image"
                value={form.heroImageUrl}
                onChange={(url) => updateField("heroImageUrl", url)}
              />
            </div>

            <div style={styles.card}>
              <ImageUploadField
                label="Background image"
                value={form.backgroundImageUrl}
                onChange={(url) => updateField("backgroundImageUrl", url)}
              />
            </div>
          </div>

          <div style={styles.actions}>
            <button type="submit" disabled={saving} style={styles.submitButton}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}
          {successMessage ? <div style={styles.success}>{successMessage}</div> : null}
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#f3f4f6",
    minHeight: "100vh",
  },
  container: {
    maxWidth: 980,
    margin: "0 auto",
  },
  heading: {
    marginBottom: 20,
    fontSize: 28,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  cardMuted: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    color: "#6b7280",
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
  },
  input: {
    height: 42,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontSize: 14,
  },
  textarea: {
    borderRadius: 8,
    border: "1px solid #d1d5db",
    padding: 12,
    fontSize: 14,
    resize: "vertical",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
  },
  submitButton: {
    height: 44,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 10,
  },
  success: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#065f46",
    padding: 12,
    borderRadius: 10,
  },
};
