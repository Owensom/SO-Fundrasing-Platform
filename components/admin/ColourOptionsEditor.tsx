import React from "react";

export type ColourOption = {
  name: string;
  hex: string;
};

type Props = {
  value: ColourOption[];
  onChange: (next: ColourOption[]) => void;
};

const DEFAULT_COLOURS: ColourOption[] = [
  { name: "Red", hex: "#EF4444" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Green", hex: "#22C55E" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Black", hex: "#111827" },
  { name: "White", hex: "#F9FAFB" },
];

function makeEmptyColour(): ColourOption {
  return {
    name: "",
    hex: "#3B82F6",
  };
}

export default function ColourOptionsEditor({ value, onChange }: Props) {
  const colours = Array.isArray(value) ? value : [];

  function updateColour(index: number, patch: Partial<ColourOption>) {
    const next = colours.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    onChange(next);
  }

  function removeColour(index: number) {
    const next = colours.filter((_, i) => i !== index);
    onChange(next);
  }

  function addColour() {
    onChange([...colours, makeEmptyColour()]);
  }

  function addPresetColour(preset: ColourOption) {
    const alreadyExists = colours.some(
      (c) =>
        c.name.trim().toLowerCase() === preset.name.trim().toLowerCase() &&
        c.hex.toLowerCase() === preset.hex.toLowerCase()
    );

    if (alreadyExists) return;

    onChange([...colours, preset]);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.headerRow}>
        <div>
          <h3 style={styles.heading}>Colours</h3>
          <p style={styles.subtext}>
            Add colour names and choose them visually. No hex typing required.
          </p>
        </div>

        <button type="button" onClick={addColour} style={styles.primaryButton}>
          + Add colour
        </button>
      </div>

      <div style={styles.presetBlock}>
        <div style={styles.presetLabel}>Quick add</div>
        <div style={styles.presetGrid}>
          {DEFAULT_COLOURS.map((preset) => (
            <button
              key={`${preset.name}-${preset.hex}`}
              type="button"
              onClick={() => addPresetColour(preset)}
              style={styles.presetButton}
              title={`Add ${preset.name}`}
            >
              <span
                style={{
                  ...styles.swatch,
                  backgroundColor: preset.hex,
                  border:
                    preset.hex.toLowerCase() === "#f9fafb"
                      ? "1px solid #d1d5db"
                      : "1px solid transparent",
                }}
              />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {colours.length === 0 ? (
        <div style={styles.emptyState}>
          No colours yet. Click <strong>Add colour</strong> or choose a preset.
        </div>
      ) : (
        <div style={styles.list}>
          {colours.map((colour, index) => (
            <div key={`${index}-${colour.name}-${colour.hex}`} style={styles.row}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Colour name</label>
                <input
                  type="text"
                  value={colour.name}
                  onChange={(e) =>
                    updateColour(index, { name: e.target.value })
                  }
                  placeholder="e.g. Royal Blue"
                  style={styles.textInput}
                />
              </div>

              <div style={styles.fieldGroupSmall}>
                <label style={styles.label}>Pick colour</label>
                <input
                  type="color"
                  value={colour.hex || "#3B82F6"}
                  onChange={(e) =>
                    updateColour(index, { hex: e.target.value })
                  }
                  style={styles.colorInput}
                />
              </div>

              <div style={styles.fieldGroupSmall}>
                <label style={styles.label}>Preview</label>
                <div
                  style={{
                    ...styles.previewBox,
                    backgroundColor: colour.hex || "#3B82F6",
                    border:
                      (colour.hex || "").toLowerCase() === "#ffffff" ||
                      (colour.hex || "").toLowerCase() === "#f9fafb"
                        ? "1px solid #d1d5db"
                        : "1px solid transparent",
                  }}
                />
              </div>

              <div style={styles.fieldGroupHex}>
                <label style={styles.label}>Saved hex</label>
                <input
                  type="text"
                  value={colour.hex}
                  readOnly
                  style={styles.readonlyInput}
                />
              </div>

              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={() => removeColour(index)}
                  style={styles.removeButton}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
    background: "#ffffff",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  heading: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
  },
  subtext: {
    margin: "6px 0 0",
    color: "#6b7280",
    fontSize: 14,
  },
  presetBlock: {
    marginBottom: 16,
  },
  presetLabel: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 8,
  },
  presetGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  presetButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    border: "1px solid #d1d5db",
    borderRadius: 999,
    background: "#fff",
    cursor: "pointer",
  },
  swatch: {
    width: 16,
    height: 16,
    borderRadius: 999,
    display: "inline-block",
  },
  primaryButton: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  emptyState: {
    padding: 16,
    borderRadius: 10,
    background: "#f9fafb",
    color: "#6b7280",
    fontSize: 14,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 1.5fr) 120px 100px minmax(120px, 1fr) auto",
    gap: 12,
    alignItems: "end",
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#fafafa",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldGroupSmall: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldGroupHex: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
  },
  textInput: {
    height: 40,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
  },
  readonlyInput: {
    height: 40,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "#f3f4f6",
    color: "#374151",
  },
  colorInput: {
    width: 72,
    height: 40,
    padding: 4,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "#fff",
    cursor: "pointer",
  },
  previewBox: {
    width: 48,
    height: 40,
    borderRadius: 8,
  },
  actions: {
    display: "flex",
    alignItems: "center",
  },
  removeButton: {
    height: 40,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #dc2626",
    background: "#fff",
    color: "#dc2626",
    cursor: "pointer",
    fontWeight: 600,
  },
};
