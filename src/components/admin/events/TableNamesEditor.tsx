"use client";

import { useMemo, useState, type CSSProperties } from "react";

export default function TableNamesEditor({
  tableNumbers,
  initialTableNames = {},
}: {
  tableNumbers: string[];
  initialTableNames?: Record<string, string>;
}) {
  const sortedTableNumbers = useMemo(() => {
    return tableNumbers.slice().sort((a, b) => {
      const aNumber = Number(a);
      const bNumber = Number(b);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return a.localeCompare(b);
    });
  }, [tableNumbers]);

  const [tableNames, setTableNames] =
    useState<Record<string, string>>(initialTableNames);

  const tableNamesJson = useMemo(() => {
    return JSON.stringify(
      Object.fromEntries(
        Object.entries(tableNames)
          .map(([tableNumber, name]) => [tableNumber, String(name || "").trim()])
          .filter(([, name]) => name),
      ),
    );
  }, [tableNames]);

  function updateTableName(tableNumber: string, value: string) {
    setTableNames((current) => ({
      ...current,
      [tableNumber]: value,
    }));
  }

  if (sortedTableNumbers.length === 0) {
    return (
      <div style={styles.emptyBox}>
        Generate table seats first, then table name fields will appear here.
        <input type="hidden" name="table_names_json" value="{}" />
      </div>
    );
  }

  return (
    <div style={styles.editor}>
      <input type="hidden" name="table_names_json" value={tableNamesJson} />

      <div style={styles.grid}>
        {sortedTableNumbers.map((tableNumber) => (
          <label key={tableNumber} style={styles.row}>
            <span style={styles.label}>Table {tableNumber}</span>
            <input
              value={tableNames[tableNumber] || ""}
              onChange={(event) =>
                updateTableName(tableNumber, event.target.value)
              }
              placeholder="Optional display name"
              style={styles.input}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  editor: {
    display: "grid",
    gap: 12,
  },
  grid: {
    display: "grid",
    gap: 10,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 42,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
  },
};
