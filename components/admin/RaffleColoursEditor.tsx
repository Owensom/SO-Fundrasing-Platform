import React from "react";

export type RaffleColourInput = {
  id?: string;
  name: string;
  hex: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = {
  value: RaffleColourInput[];
  onChange: (next: RaffleColourInput[]) => void;
};

const COLOUR_PRESETS: Array<{ name: string; hex: string }> = [
  { name: "Red", hex: "#EF4444" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Green", hex: "#22C55E" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Orange", hex: "#F97316" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Black", hex: "#111827" },
  { name: "White", hex: "#F9FAFB" },
  { name: "Grey", hex: "#6B7280" },
  { name: "Gold", hex: "#D4AF37" },
  { name: "Silver", hex: "#C0C0C0" },
];

function makeEmptyColour(sortOrder: number): RaffleColourInput {
  return {
    name: "",
    hex: "#3B82F6",
    sortOrder,
    isActive: true,
  };
}

function normaliseSortOrder(items: RaffleColourInput[]): RaffleColourInput[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));
}

export default function RaffleColoursEditor({ value, onChange }: Props) {
  const colours = Array.isArray(value) ? value : [];

  function updateRow(index: number, patch: Partial<RaffleColourInput>) {
    const next = colours.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    onChange(normaliseSortOrder(next));
  }

  function addColour() {
    const next = [...colours, makeEmptyColour(colours.length)];
    onChange(normaliseSortOrder(next));
  }

  function removeColour(index: number) {
    const next = colours.filter((_, i) => i !== index);
    onChange(normaliseSortOrder(next));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...colours];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(normaliseSortOrder(next));
  }

  function moveDown(index: number) {
    if (index >= colours.length - 1) return;
    const next = [...colours];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(normaliseSortOrder(next));
  }

  function applyPreset(index: number, presetValue: string) {
    if (!presetValue) return;

    const preset = COLOUR_PRESETS.find((p) => `${p.name}|${p.hex}` === presetValue);
    if (!preset) return;

    updateRow(index, {
      name: preset.name,
      hex: preset.hex,
    });
  }

  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18 }}>Colours</h3>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
            Add/remove colours visually. No hex typing required.
          </p>
        </div>

        <button
          type="button"
          onClick={addColour}
          style={buttonStyle()}
        >
          Add colour
        </button>
      </div>

      {colours.length === 0 ? (
        <div
          style={{
            padding: 16,
            border: "1px dashed #d1d5db",
            borderRadius: 10,
            color: "#6b7280",
          }}
        >
          No colours yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {colours.map((colour, index) => (
            <div
              key={colour.id ?? `${index}-${colour.name}-${colour.hex}`}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 12,
                display: "grid",
                gap: 12,
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr) 120px 120px",
                }}
              >
                <div>
                  <label style={labelStyle}>Colour name</label>
                  <input
                    type="text"
                    value={colour.name}
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                    placeholder="e.g. Royal Blue"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Preset</label>
                  <select
                    value=""
                    onChange={(e) => {
                      applyPreset(index, e.target.value);
                      e.currentTarget.value = "";
                    }}
                    style={inputStyle}
                  >
                    <option value="">Choose preset…</option>
                    {COLOUR_PRESETS.map((preset) => (
                      <option
                        key={`${preset.name}-${preset.hex}`}
                        value={`${preset.name}|${preset.hex}`}
                      >
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Swatch</label>
                  <input
                    type="color"
                    value={colour.hex}
                    onChange={(e) => updateRow(index, { hex: e.target.value })}
                    style={{
                      width: "100%",
                      height: 42,
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Active</label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      height: 42,
                      border: "1px solid #d1d5db",
                      borderRadius: 8,
                      padding: "0 12px",
                      background: "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={colour.isActive}
                      onChange={(e) =>
                        updateRow(index, { isActive: e.target.checked })
                      }
                    />
                    Enabled
                  </label>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    aria-hidden
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      border: "1px solid #d1d5db",
                      background: colour.hex || "#ffffff",
                    }}
                  />
                  <div style={{ color: "#374151", fontSize: 14 }}>
                    <strong>{colour.name || "Unnamed colour"}</strong>
                    <span style={{ color: "#6b7280", marginLeft: 8 }}>
                      {colour.hex}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    style={buttonStyle(index === 0)}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === colours.length - 1}
                    style={buttonStyle(index === colours.length - 1)}
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() => removeColour(index)}
                    style={dangerButtonStyle}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 14,
  background: "#fff",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  color: "#374151",
  fontWeight: 600,
};

function buttonStyle(disabled = false): React.CSSProperties {
  return {
    height: 38,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: disabled ? "#f3f4f6" : "#fff",
    color: disabled ? "#9ca3af" : "#111827",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const dangerButtonStyle: React.CSSProperties = {
  height: 38,
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#b91c1c",
  cursor: "pointer",
};
