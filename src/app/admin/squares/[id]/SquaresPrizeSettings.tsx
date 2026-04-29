"use client";

import { useState } from "react";

type Prize = {
  title?: string;
  name?: string;
  description?: string;
};

export default function SquaresPrizeSettings({
  initialPrizes,
}: {
  initialPrizes: Prize[];
}) {
  const [prizes, setPrizes] = useState<Prize[]>(
    initialPrizes.length > 0
      ? initialPrizes
      : [{ title: "First prize", description: "" }],
  );

  function updatePrize(index: number, field: keyof Prize, value: string) {
    setPrizes((current) =>
      current.map((prize, prizeIndex) =>
        prizeIndex === index ? { ...prize, [field]: value } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      { title: "", description: "" },
    ]);
  }

  function removePrize(index: number) {
    setPrizes((current) =>
      current.length <= 1
        ? [{ title: "", description: "" }]
        : current.filter((_, prizeIndex) => prizeIndex !== index),
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Prizes</h2>
          <p style={styles.help}>
            Add as many prizes as needed. Blank prize rows are ignored when saved.
          </p>
        </div>

        <button type="button" onClick={addPrize} style={styles.addButton}>
          + Add prize
        </button>
      </div>

      <div style={styles.list}>
        {prizes.map((prize, index) => (
          <div key={index} style={styles.row}>
            <div style={styles.position}>{index + 1}</div>

            <input
              name="prize_title"
              value={prize.title || prize.name || ""}
              onChange={(event) =>
                updatePrize(index, "title", event.target.value)
              }
              placeholder={`Prize ${index + 1}`}
              style={styles.input}
            />

            <input
              name="prize_description"
              value={prize.description || ""}
              onChange={(event) =>
                updatePrize(index, "description", event.target.value)
              }
              placeholder="Optional description"
              style={styles.input}
            />

            <button
              type="button"
              onClick={() => removePrize(index)}
              style={styles.removeButton}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
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
  help: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
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
    gridTemplateColumns: "44px minmax(0, 1fr) minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  position: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
  },
  removeButton: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 800,
    cursor: "pointer",
  },
};
