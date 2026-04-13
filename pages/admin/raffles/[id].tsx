import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import ColourOptionsEditor, {
  ColourOption,
} from "../../../components/admin/ColourOptionsEditor";

type RaffleDetails = {
  id: string;
  title: string;
  description?: string;
  colours: ColourOption[];
};

export default function AdminRaffleDetailsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState<RaffleDetails>({
    id: "",
    title: "",
    description: "",
    colours: [],
  });

  useEffect(() => {
    if (!id || typeof id !== "string") return;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `/api/admin/raffle-details?id=${encodeURIComponent(id)}&tenantSlug=demo-a`
        );
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || "Failed to load raffle");
        }

        const raffle = json?.raffle ?? json;

        setForm({
          id: raffle.id,
          title: raffle.title || "",
          description: raffle.description || "",
          colours: Array.isArray(raffle.colours) ? raffle.colours : [],
        });
      } catch (err: any) {
        setError(err.message || "Failed to load raffle");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  function updateField<K extends keyof RaffleDetails>(
    key: K,
    value: RaffleDetails[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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
      setError(err.message || "Something went wrong");
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
              onChange={(e) => updateField("title", e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.card}>
            <label style={styles.label}>Description</label>
            <textarea
              value={form.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              style={styles.textarea}
              rows={4}
            />
          </div>

          <ColourOptionsEditor
            value={form.colours}
            onChange={(next) => updateField("colours", next)}
          />

          <div style={styles.actions}>
            <button type="submit" disabled={saving} style={styles.submitButton}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>

          {error ? <div style={styles.error}>{error}</div> : null}
          {successMessage ? (
            <div style={styles.success}>{successMessage}</div>
          ) : null}
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
    maxWidth: 960,
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
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontWeight: 600,
    fontSize: 14,
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
