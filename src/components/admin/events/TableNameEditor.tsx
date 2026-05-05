"use client";

import { useMemo, useState } from "react";

export default function TableNamesEditor({
  tableNumbers,
  initialTableNames = {},
}: {
  tableNumbers: (string | number)[];
  initialTableNames?: Record<string, string>;
}) {
  const sortedTables = useMemo(() => {
    return [...tableNumbers]
      .map((t) => String(t))
      .sort((a, b) => Number(a) - Number(b));
  }, [tableNumbers]);

  const [names, setNames] = useState<Record<string, string>>(
    initialTableNames || {},
  );

  function updateName(table: string, value: string) {
    setNames((current) => ({
      ...current,
      [table]: value,
    }));
  }

  function buildJson() {
    // remove empty values
    const cleaned: Record<string, string> = {};

    Object.entries(names).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        cleaned[key] = trimmed;
      }
    });

    return JSON.stringify(cleaned);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <h3 style={styles.title}>Table names</h3>
        <p style={styles.text}>
          Add friendly names like <strong>VIP</strong>,{" "}
          <strong>Sponsors</strong>, or <strong>Smith Family</strong>.
        </p>
      </div>

      <div style={styles.grid}>
        {sortedTables.map((table) => (
          <div key={table} style={styles.row}>
            <div style={styles.label}>Table {table}</div>

            <input
              value={names[table] || ""}
              onChange={(e) => updateName(table, e.target.value)}
              placeholder="Optional name"
              style={styles.input}
            />
          </div>
        ))}
      </div>

      {/* IMPORTANT: this is what your backend already expects */}
      <input
        type="hidden"
        name="table_names_json"
        value={buildJson()}
      />
    </div>
  );
}

const styles = {
  wrapper: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    display: "grid",
    gap: 14,
  },
  header: {
    display: "grid",
    gap: 4,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  },
  text: {
    margin: 0,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.4,
  },
  grid: {
    display: "grid",
    gap: 10,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "120px 1fr",
    gap: 10,
    alignItems: "center",
  },
  label: {
    fontWeight: 800,
    color: "#334155",
    fontSize: 13,
  },
  input: {
    height: 40,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 10px",
    fontSize: 14,
  },
};
