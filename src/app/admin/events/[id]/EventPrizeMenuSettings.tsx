"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type {
  EventMenuOption,
  EventPrize,
} from "../../../../../api/_lib/events-repo";

type ServerAction = (formData: FormData) => void | Promise<void>;

type PrizeRow = {
  position: number;
  title: string;
  description: string;
  isPublic: boolean;
};

type MenuRow = {
  name: string;
  description: string;
  isActive: boolean;
};

type Props = {
  eventId: string;
  initialPrizes: EventPrize[];
  initialMenuOptions: EventMenuOption[];
  updatePrizesAction: ServerAction;
  updateMenuOptionsAction: ServerAction;
};

function normaliseInitialPrizes(prizes: EventPrize[]): PrizeRow[] {
  const rows = prizes
    .map((prize, index) => {
      const title = String(prize.title || prize.name || "").trim();

      return {
        position:
          Number.isFinite(Number(prize.position)) && Number(prize.position) > 0
            ? Math.floor(Number(prize.position))
            : index + 1,
        title,
        description: String(prize.description || "").trim(),
        isPublic: prize.isPublic !== false && prize.is_public !== false,
      };
    })
    .filter((prize) => prize.title)
    .sort((a, b) => a.position - b.position);

  return rows.length
    ? rows
    : [
        {
          position: 1,
          title: "",
          description: "",
          isPublic: true,
        },
      ];
}

function normaliseInitialMenuOptions(options: EventMenuOption[]): MenuRow[] {
  const rows = options
    .map((option) => ({
      name: String(option.name || option.title || "").trim(),
      description: String(option.description || "").trim(),
      isActive: option.isActive !== false && option.is_active !== false,
    }))
    .filter((option) => option.name);

  return rows.length
    ? rows
    : [
        {
          name: "",
          description: "",
          isActive: true,
        },
      ];
}

export default function EventPrizeMenuSettings({
  eventId,
  initialPrizes,
  initialMenuOptions,
  updatePrizesAction,
  updateMenuOptionsAction,
}: Props) {
  const [prizes, setPrizes] = useState<PrizeRow[]>(
    normaliseInitialPrizes(initialPrizes),
  );
  const [menuOptions, setMenuOptions] = useState<MenuRow[]>(
    normaliseInitialMenuOptions(initialMenuOptions),
  );

  function updatePrize(index: number, patch: Partial<PrizeRow>) {
    setPrizes((current) =>
      current.map((prize, currentIndex) =>
        currentIndex === index ? { ...prize, ...patch } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      {
        position: current.length + 1,
        title: "",
        description: "",
        isPublic: true,
      },
    ]);
  }

  function removePrize(index: number) {
    setPrizes((current) => {
      if (current.length <= 1) return current;

      return current
        .filter((_, currentIndex) => currentIndex !== index)
        .map((prize, currentIndex) => ({
          ...prize,
          position: currentIndex + 1,
        }));
    });
  }

  function updateMenuOption(index: number, patch: Partial<MenuRow>) {
    setMenuOptions((current) =>
      current.map((option, currentIndex) =>
        currentIndex === index ? { ...option, ...patch } : option,
      ),
    );
  }

  function addMenuOption() {
    setMenuOptions((current) => [
      ...current,
      {
        name: "",
        description: "",
        isActive: true,
      },
    ]);
  }

  function removeMenuOption(index: number) {
    setMenuOptions((current) => {
      if (current.length <= 1) return current;

      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  return (
    <>
      <section id="prizes" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Prize settings</p>
            <h2 style={styles.sectionTitle}>Prizes</h2>
            <p style={styles.sectionText}>
              Optional prizes shown on the public event page.
            </p>
          </div>

          <button type="button" onClick={addPrize} style={styles.lightButton}>
            + Add prize
          </button>
        </div>

        <form action={updatePrizesAction} style={styles.panel}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="prize_count" value={prizes.length} />

          <div style={styles.list}>
            {prizes.map((prize, index) => (
              <div key={`prize-${index}`} style={styles.row}>
                <div style={styles.rowHeader}>
                  <strong style={styles.rowTitle}>Prize {index + 1}</strong>

                  <label style={styles.checkboxLabel}>
                    <input
                      name={`prize_public_${index}`}
                      type="checkbox"
                      value="true"
                      checked={prize.isPublic}
                      onChange={(event) =>
                        updatePrize(index, {
                          isPublic: event.target.checked,
                        })
                      }
                    />
                    Show publicly
                  </label>
                </div>

                <div style={styles.prizeGrid}>
                  <label style={styles.field}>
                    <span style={styles.label}>Position</span>
                    <input
                      name={`prize_position_${index}`}
                      type="number"
                      min="1"
                      value={prize.position}
                      onChange={(event) =>
                        updatePrize(index, {
                          position: Math.max(
                            1,
                            Math.floor(Number(event.target.value) || 1),
                          ),
                        })
                      }
                      style={styles.input}
                    />
                  </label>

                  <label style={styles.field}>
                    <span style={styles.label}>Prize title</span>
                    <input
                      name={`prize_title_${index}`}
                      value={prize.title}
                      onChange={(event) =>
                        updatePrize(index, {
                          title: event.target.value,
                        })
                      }
                      placeholder="e.g. £500 cash, Luxury hamper, Weekend break"
                      style={styles.input}
                    />
                  </label>
                </div>

                <label style={styles.field}>
                  <span style={styles.label}>Description optional</span>
                  <textarea
                    name={`prize_description_${index}`}
                    rows={2}
                    value={prize.description}
                    onChange={(event) =>
                      updatePrize(index, {
                        description: event.target.value,
                      })
                    }
                    placeholder="Optional extra detail shown publicly"
                    style={styles.textarea}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removePrize(index)}
                  disabled={prizes.length <= 1}
                  style={{
                    ...styles.dangerOutlineButton,
                    opacity: prizes.length <= 1 ? 0.55 : 1,
                    cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Remove prize
                </button>
              </div>
            ))}
          </div>

          <button type="submit" style={styles.primaryButton}>
            Save prizes
          </button>
        </form>
      </section>

      <section id="menu" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Menu settings</p>
            <h2 style={styles.sectionTitle}>Menu options</h2>
            <p style={styles.sectionText}>
              Optional menu choices shown during public checkout.
            </p>
          </div>

          <button
            type="button"
            onClick={addMenuOption}
            style={styles.lightButton}
          >
            + Add menu option
          </button>
        </div>

        <form action={updateMenuOptionsAction} style={styles.panel}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="menu_count" value={menuOptions.length} />

          <div style={styles.list}>
            {menuOptions.map((option, index) => (
              <div key={`menu-${index}`} style={styles.row}>
                <div style={styles.rowHeader}>
                  <strong style={styles.rowTitle}>Menu option {index + 1}</strong>

                  <label style={styles.checkboxLabel}>
                    <input
                      name={`menu_active_${index}`}
                      type="checkbox"
                      value="true"
                      checked={option.isActive}
                      onChange={(event) =>
                        updateMenuOption(index, {
                          isActive: event.target.checked,
                        })
                      }
                    />
                    Active
                  </label>
                </div>

                <label style={styles.field}>
                  <span style={styles.label}>Menu option</span>
                  <input
                    name={`menu_name_${index}`}
                    value={option.name}
                    onChange={(event) =>
                      updateMenuOption(index, {
                        name: event.target.value,
                      })
                    }
                    placeholder="e.g. Chicken, Vegetarian, Vegan"
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.label}>Description optional</span>
                  <textarea
                    name={`menu_description_${index}`}
                    rows={2}
                    value={option.description}
                    onChange={(event) =>
                      updateMenuOption(index, {
                        description: event.target.value,
                      })
                    }
                    placeholder="Optional menu description"
                    style={styles.textarea}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeMenuOption(index)}
                  disabled={menuOptions.length <= 1}
                  style={{
                    ...styles.dangerOutlineButton,
                    opacity: menuOptions.length <= 1 ? 0.55 : 1,
                    cursor: menuOptions.length <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Remove menu option
                </button>
              </div>
            ))}
          </div>

          <button type="submit" style={styles.primaryButton}>
            Save menu options
          </button>
        </form>
      </section>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sectionEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.02em",
  },
  sectionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  panel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  list: {
    display: "grid",
    gap: 12,
  },
  row: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  rowTitle: {
    color: "#0f172a",
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontWeight: 900,
    color: "#334155",
  },
  lightButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  primaryButton: {
    width: "fit-content",
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerOutlineButton: {
    width: "fit-content",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
  },
};
