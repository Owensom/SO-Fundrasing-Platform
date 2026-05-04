"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type Props = {
  tenantSlug: string;
};

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

function safeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makePrize(id: string, position = "1"): PrizeRow {
  return {
    id,
    position,
    title: "",
    description: "",
    is_public: true,
  };
}

export default function NewEventForm({ tenantSlug }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1"),
  ]);

  const prizesValue = useMemo(() => {
    const clean = prizes
      .map((p, i) => ({
        id: p.id,
        position: Number(p.position) || i + 1,
        title: p.title.trim(),
        description: p.description.trim(),
        is_public: p.is_public,
        sort_order: i,
      }))
      .filter((p) => p.title);

    return JSON.stringify(clean);
  }, [prizes]);

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setPrizes((current) =>
      current.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      makePrize(safeId("prize"), String(current.length + 1)),
    ]);
  }

  function removePrize(id: string) {
    setPrizes((current) => current.filter((p) => p.id !== id));
  }

  return (
    <form action="/api/admin/events" method="post" style={styles.form}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="prizes" value={prizesValue} />

      <section style={styles.section}>
        <h2>Create event</h2>

        <input
          name="title"
          placeholder="Event title"
          required
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setSlug(slugify(e.target.value));
          }}
          style={styles.input}
        />

        <input
          name="slug"
          value={slug}
          onChange={(e) => setSlug(slugify(e.target.value))}
          style={styles.input}
        />

        <textarea
          name="description"
          placeholder="Description"
          style={styles.textarea}
        />

        <input name="starts_at" type="datetime-local" style={styles.input} />

        <select name="event_type" style={styles.input}>
          <option value="general_admission">General</option>
          <option value="reserved_seating">Seating</option>
          <option value="tables">Tables</option>
        </select>

        <select name="status" style={styles.input}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </section>

      {/* =======================
          PRIZES (RAFFLE PARITY)
      ======================= */}

      <section style={styles.section}>
        <div style={styles.row}>
          <h2>Prizes</h2>
          <button type="button" onClick={addPrize}>
            + Add prize
          </button>
        </div>

        {prizes.map((p, index) => (
          <div key={p.id} style={styles.card}>
            <div style={styles.row}>
              <strong>Prize {index + 1}</strong>

              <label>
                <input
                  type="checkbox"
                  checked={p.is_public}
                  onChange={(e) =>
                    updatePrize(p.id, { is_public: e.target.checked })
                  }
                />
                Public
              </label>
            </div>

            <input
              value={p.position}
              onChange={(e) =>
                updatePrize(p.id, { position: e.target.value })
              }
              placeholder="Position"
              style={styles.input}
            />

            <input
              value={p.title}
              onChange={(e) =>
                updatePrize(p.id, { title: e.target.value })
              }
              placeholder="Prize title"
              style={styles.input}
            />

            <textarea
              value={p.description}
              onChange={(e) =>
                updatePrize(p.id, { description: e.target.value })
              }
              placeholder="Description"
              style={styles.textarea}
            />

            <button
              type="button"
              onClick={() => removePrize(p.id)}
              disabled={prizes.length === 1}
            >
              Remove
            </button>
          </div>
        ))}
      </section>

      <button type="submit" style={styles.submit}>
        Create event
      </button>
    </form>
  );
}

const styles: Record<string, CSSProperties> = {
  form: { display: "grid", gap: 16 },
  section: {
    padding: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#fff",
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
    marginTop: 8,
  },
  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
    marginTop: 8,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  card: {
    border: "1px solid #eee",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  submit: {
    padding: 14,
    background: "black",
    color: "white",
    borderRadius: 10,
  },
};
