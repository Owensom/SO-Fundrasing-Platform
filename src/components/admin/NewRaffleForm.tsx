"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  tenantSlug: string;
};

export default function NewRaffleForm({ tenantSlug }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [drawAt, setDrawAt] = useState("");

  useEffect(() => {
    if (!slugEdited) {
      setSlug(
        title
          .toLowerCase()
          .trim()
          .replace(/['"]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      );
    }
  }, [title, slugEdited]);

  return (
    <form action="/api/admin/raffles" method="post" style={styles.form}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />

      <section style={styles.section}>
        <h3 style={styles.sectionTitle}>Public details</h3>

        <div style={styles.twoColumn}>
          <label style={styles.field}>
            Title
            <input
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
            />
          </label>

          <label style={styles.field}>
            Slug
            <input
              name="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value);
              }}
              style={styles.input}
            />
          </label>
        </div>

        <label style={styles.field}>
          Description
          <textarea name="description" rows={4} style={styles.textarea} />
        </label>

        {/* ✅ FIXED ALIGNMENT BLOCK */}
        <div style={styles.twoColumn}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={styles.field}>
              Draw date
              <input
                name="draw_at"
                type="datetime-local"
                value={drawAt}
                onChange={(e) => setDrawAt(e.target.value)}
                style={styles.input}
              />
            </label>

            <div style={styles.helpText}>
              Optional. This will be shown to buyers and in admin.
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={styles.field}>
              Status
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            {/* spacer to align with help text */}
            <div style={{ height: 18 }} />
          </div>
        </div>
      </section>

      <button type="submit" style={styles.submitButton}>
        Create raffle
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: "grid",
    gap: 18,
    marginTop: 24,
    maxWidth: 1040,
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 21,
    color: "#0f172a",
  },
  twoColumn: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
  },
  submitButton: {
    padding: "13px 20px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
  },
};
