"use client";

import { useState } from "react";

type Prize = {
  title?: string;
  name?: string;
  description?: string;
};

type Props = {
  initialPrizes: Prize[];
};

export default function SquaresPrizeSettings({ initialPrizes }: Props) {
  const [rows, setRows] = useState<Prize[]>(
    initialPrizes.length > 0
      ? initialPrizes
      : [{ title: "First prize", description: "" }],
  );

  function updateRow(index: number, field: "title" | "description", value: string) {
    setRows((current) =>
      current.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  function addPrize() {
    setRows((current) => [...current, { title: "", description: "" }]);
  }

  function removePrize(index: number) {
    setRows((current) =>
      current.length <= 1 ? current : current.filter((_, i) => i !== index),
    );
  }

  return (
    <section style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Prize settings</h2>
          <p style={styles.text}>
            Add, edit or remove prizes. Blank prize names are ignored when saved.
          </p>
        </div>

        <button type="button" onClick={addPrize} style={styles.addButton}>
          + Add prize
        </button>
      </div>

      <div style={styles.list}>
        {rows.map((row, index) => (
          <div key={index} style={styles.row}>
            <div style={styles.position}>{index + 1}</div>

            <input
              name="prize_title"
              value={row.title || row.name || ""}
              onChange={(event) => updateRow(index, "title", event.target.value)}
              placeholder={`Prize ${index + 1}`}
              style={styles.input}
            />

            <input
              name="prize_description"
              value={row.description || ""}
              onChange={(event) =>
                updateRow(index, "description", event.target.value)
              }
              placeholder="Description"
              style={styles.input}
            />

            <button
              type="button"
              onClick={() => removePrize(index)}
              style={styles.removeButton}
              disabled={rows.length <= 1}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: "grid",
    gap: 14,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    color: "#0f172a",
  },
  text: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
  },
  addButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "none",
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  list: {
    display: "grid",
    gap: 10,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr) minmax(0, 1.4fr) auto",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  position: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#111827",
  },
  removeButton: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    fontWeight: 800,
    cursor: "pointer",
  },
};
