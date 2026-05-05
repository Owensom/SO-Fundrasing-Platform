"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import ImageUploadField from "@/components/ImageUploadField";

type Props = {
  tenantSlug: string;
};

type EventType = "general_admission" | "reserved_seating" | "tables";

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

type TicketTypeRow = {
  id: string;
  name: string;
  description: string;
  price: string;
  capacity: string;
  sort_order: string;
  is_active: boolean;
};

const DEFAULT_TICKETS: TicketTypeRow[] = [
  {
    id: "ticket-standard",
    name: "Standard",
    description: "",
    price: "",
    capacity: "",
    sort_order: "0",
    is_active: true,
  },
  {
    id: "ticket-concession",
    name: "Concession",
    description: "",
    price: "",
    capacity: "",
    sort_order: "1",
    is_active: true,
  },
];

function safeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makePrize(
  id: string,
  position = "1",
  title = "",
  description = "",
): PrizeRow {
  return {
    id,
    position,
    title,
    description,
    is_public: true,
  };
}

function makeTicketType(id: string, sortOrder: number): TicketTypeRow {
  return {
    id,
    name: "",
    description: "",
    price: "",
    capacity: "",
    sort_order: String(sortOrder),
    is_active: true,
  };
}

function buildTableNamesJson(value: string) {
  try {
    const parsed = JSON.parse(value || "{}");

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "{}";
    }

    const clean = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, rawValue]) => [String(key), String(rawValue || "").trim()])
        .filter(([, name]) => name),
    );

    return JSON.stringify(clean);
  } catch {
    return "{}";
  }
}

export default function NewEventForm({ tenantSlug }: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [eventType, setEventType] = useState<EventType>("general_admission");

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "", ""),
  ]);

  const [ticketTypes, setTicketTypes] =
    useState<TicketTypeRow[]>(DEFAULT_TICKETS);

  const [rowSection, setRowSection] = useState("");
  const [rowRows, setRowRows] = useState("");
  const [rowSeatsPerRow, setRowSeatsPerRow] = useState("");
  const [rowAislesAfter, setRowAislesAfter] = useState("");
  const [rowInitialTicketTypeId, setRowInitialTicketTypeId] = useState("");

  const [tableCount, setTableCount] = useState("");
  const [tableSeatsPerTable, setTableSeatsPerTable] = useState("");
  const [tableInitialTicketTypeId, setTableInitialTicketTypeId] = useState("");
  const [tableNamesRaw, setTableNamesRaw] = useState("{}");

  const prizesValue = useMemo(() => {
    const clean = prizes
      .map((prize, index) => {
        const position = Number(prize.position);
        const prizeTitle = prize.title.trim();

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title: prizeTitle,
          name: prizeTitle,
          description: prize.description.trim(),
          isPublic: Boolean(prize.is_public),
          is_public: Boolean(prize.is_public),
          sortOrder: index,
          sort_order: index,
        };
      })
      .filter((prize) => prize.title);

    return JSON.stringify(clean);
  }, [prizes]);

  const ticketTypesValue = useMemo(() => {
    const clean = ticketTypes
      .map((ticketType, index) => ({
        id: ticketType.id,
        name: ticketType.name.trim(),
        description: ticketType.description.trim(),
        price: ticketType.price,
        capacity: ticketType.capacity,
        sort_order: ticketType.sort_order || String(index),
        is_active: Boolean(ticketType.is_active),
      }))
      .filter((ticketType) => ticketType.name);

    return JSON.stringify(clean);
  }, [ticketTypes]);

  const rowSeatingValue = useMemo(() => {
    return JSON.stringify({
      section: rowSection.trim(),
      rows: rowRows.trim(),
      seats_per_row: rowSeatsPerRow,
      aisle_after: rowAislesAfter.trim(),
      ticket_type_id: rowInitialTicketTypeId,
    });
  }, [
    rowSection,
    rowRows,
    rowSeatsPerRow,
    rowAislesAfter,
    rowInitialTicketTypeId,
  ]);

  const tableSeatingValue = useMemo(() => {
    return JSON.stringify({
      table_count: tableCount,
      seats_per_table: tableSeatsPerTable,
      ticket_type_id: tableInitialTicketTypeId,
    });
  }, [tableCount, tableSeatsPerTable, tableInitialTicketTypeId]);

  const tableNamesValue = useMemo(() => {
    return buildTableNamesJson(tableNamesRaw);
  }, [tableNamesRaw]);

  function updateTitle(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setPrizes((current) =>
      current.map((prize) =>
        prize.id === id ? { ...prize, ...patch } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      makePrize(safeId("prize"), String(current.length + 1)),
    ]);
  }

  function removePrize(id: string) {
    setPrizes((current) => current.filter((prize) => prize.id !== id));
  }

  function updateTicketType(id: string, patch: Partial<TicketTypeRow>) {
    setTicketTypes((current) =>
      current.map((ticketType) =>
        ticketType.id === id ? { ...ticketType, ...patch } : ticketType,
      ),
    );
  }

  function addTicketType() {
    setTicketTypes((current) => [
      ...current,
      makeTicketType(safeId("ticket"), current.length),
    ]);
  }

  function removeTicketType(id: string) {
    setTicketTypes((current) =>
      current.length <= 1
        ? current
        : current.filter((ticketType) => ticketType.id !== id),
    );

    if (rowInitialTicketTypeId === id) setRowInitialTicketTypeId("");
    if (tableInitialTicketTypeId === id) setTableInitialTicketTypeId("");
  }

  return (
    <form action="/api/admin/events" method="post" style={styles.form}>
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="ticket_types" value={ticketTypesValue} />
      <input type="hidden" name="row_seating" value={rowSeatingValue} />
      <input type="hidden" name="table_seating" value={tableSeatingValue} />
      <input type="hidden" name="table_names_json" value={tableNamesValue} />

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <p style={styles.eyebrow}>Events & Tickets</p>
          <h1 style={styles.title}>{title.trim() ? title : "Create event"}</h1>

          <div style={styles.badgeRow}>
            <span style={styles.goldBadge}>
              {eventType === "reserved_seating"
                ? "Reserved seating"
                : eventType === "tables"
                  ? "Tables"
                  : "General admission"}
            </span>
            <span style={styles.darkBadge}>Draft</span>
          </div>

          <p style={styles.subtle}>
            Public page: <strong>/e/{slug || "event-slug"}</strong>
          </p>
        </div>

        <div style={styles.heroImageWrap}>
          <div style={styles.heroImageEmpty}>🎫</div>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Section 1</p>
            <h2 style={styles.sectionTitle}>Event details</h2>
            <p style={styles.sectionText}>
              Create the event details, upload the image and choose the event
              type.
            </p>
          </div>
        </div>

        <div style={styles.formInner}>
          <Field label="Title">
            <input
              name="title"
              required
              value={title}
              onChange={(event) => updateTitle(event.target.value)}
              style={styles.input}
              placeholder="Summer Gala Night"
            />
          </Field>

          <Field label="Slug">
            <input
              name="slug"
              required
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
              style={styles.input}
              placeholder="summer-gala-night"
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description"
              rows={5}
              style={styles.textarea}
              placeholder="Describe the event..."
            />
          </Field>

          <div style={styles.mediaBox}>
            <div>
              <h3 style={styles.panelTitle}>Event image</h3>
              <p style={styles.sectionText}>
                Upload or replace the public event image.
              </p>

              <ImageUploadField currentImageUrl="" />
            </div>

            <div style={styles.previewBox}>
              <div style={styles.emptyPreview}>🎫</div>
            </div>
          </div>

          <div style={styles.twoCol}>
            <Field label="Location">
              <input
                name="location"
                placeholder="Venue, city or online"
                style={styles.input}
              />
            </Field>

            <Field label="General admission capacity">
              <input
                name="capacity"
                type="number"
                min="0"
                placeholder="Leave blank for unlimited"
                style={styles.input}
              />
            </Field>
          </div>

          <div style={styles.twoCol}>
            <Field label="Starts at">
              <input name="starts_at" type="datetime-local" style={styles.input} />
            </Field>

            <Field label="Ends at">
              <input name="ends_at" type="datetime-local" style={styles.input} />
            </Field>
          </div>

          <div style={styles.threeCol}>
            <Field label="Currency">
              <select name="currency" defaultValue="GBP" style={styles.input}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>

            <Field label="Type">
              <select
                name="event_type"
                value={eventType}
                onChange={(event) => setEventType(event.target.value as EventType)}
                style={styles.input}
              >
                <option value="general_admission">General admission</option>
                <option value="reserved_seating">Reserved seating</option>
                <option value="tables">Tables</option>
              </select>
            </Field>

            <Field label="Status">
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
          </div>
        </div>
      </section>

      <section id="tickets" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Section 2</p>
            <h2 style={styles.sectionTitle}>Tickets & Prices</h2>
            <p style={styles.sectionText}>
              Add public ticket choices now. You can edit them after creation.
            </p>
          </div>

          <button type="button" onClick={addTicketType} style={styles.lightButton}>
            + Add ticket type
          </button>
        </div>

        <div style={styles.list}>
          {ticketTypes.map((ticketType, index) => (
            <div key={ticketType.id} style={styles.editTicketCard}>
              <div style={styles.rowHeader}>
                <strong>Ticket type {index + 1}</strong>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={ticketType.is_active}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Active
                </label>
              </div>

              <div style={styles.twoCol}>
                <Field label="Ticket name">
                  <input
                    value={ticketType.name}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        name: event.target.value,
                      })
                    }
                    placeholder="Standard"
                    style={styles.input}
                  />
                </Field>

                <Field label="Description">
                  <input
                    value={ticketType.description}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        description: event.target.value,
                      })
                    }
                    placeholder="Optional description"
                    style={styles.input}
                  />
                </Field>
              </div>

              <div style={styles.threeCol}>
                <Field label="Price">
                  <input
                    value={ticketType.price}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        price: event.target.value,
                      })
                    }
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10.00"
                    style={styles.input}
                  />
                </Field>

                <Field label="Ticket limit">
                  <input
                    value={ticketType.capacity}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        capacity: event.target.value,
                      })
                    }
                    type="number"
                    min="0"
                    placeholder="Leave blank for unlimited"
                    style={styles.input}
                  />
                </Field>

                <Field label="Order">
                  <input
                    value={ticketType.sort_order}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        sort_order: event.target.value,
                      })
                    }
                    type="number"
                    min="0"
                    style={styles.input}
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={() => removeTicketType(ticketType.id)}
                disabled={ticketTypes.length <= 1}
                style={{
                  ...styles.dangerOutlineButton,
                  opacity: ticketTypes.length <= 1 ? 0.55 : 1,
                  cursor: ticketTypes.length <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Delete this ticket type
              </button>
            </div>
          ))}
        </div>
      </section>

      {eventType === "reserved_seating" && (
        <section id="row-seating" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.sectionEyebrow}>Section 3</p>
              <h2 style={styles.sectionTitle}>Row Seating</h2>
              <p style={styles.sectionText}>
                Generate initial row seats during creation. You can fine-tune
                them in Seat Manager after creation.
              </p>
            </div>
          </div>

          <div style={styles.twoPanel}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Generate row seating</h3>

              <div style={styles.formInner}>
                <Field label="Initial marking">
                  <select
                    value={rowInitialTicketTypeId}
                    onChange={(event) =>
                      setRowInitialTicketTypeId(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="">Normal public seats</option>
                    {ticketTypes
                      .filter((ticketType) => ticketType.name.trim())
                      .map((ticketType) => (
                        <option key={ticketType.id} value={ticketType.id}>
                          {ticketType.name}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Section">
                  <input
                    value={rowSection}
                    onChange={(event) => setRowSection(event.target.value)}
                    placeholder="Main, VIP, Balcony, Left, Centre..."
                    style={styles.input}
                  />
                </Field>

                <Field label="Rows">
                  <input
                    value={rowRows}
                    onChange={(event) => setRowRows(event.target.value)}
                    placeholder="1-10 or A-C or 1-3,8-10"
                    style={styles.input}
                  />
                </Field>

                <div style={styles.twoCol}>
                  <Field label="Seats per row">
                    <input
                      value={rowSeatsPerRow}
                      onChange={(event) =>
                        setRowSeatsPerRow(event.target.value)
                      }
                      type="number"
                      min="1"
                      placeholder="40"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Aisles after seats">
                    <input
                      value={rowAislesAfter}
                      onChange={(event) =>
                        setRowAislesAfter(event.target.value)
                      }
                      placeholder="10,20,30"
                      style={styles.input}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Row seating summary</h3>
              <p style={styles.sectionText}>
                Leave these blank if you want to create the event first and
                generate row seats later.
              </p>
            </div>
          </div>
        </section>
      )}

      {eventType === "tables" && (
        <section id="table-seating" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.sectionEyebrow}>Section 3</p>
              <h2 style={styles.sectionTitle}>Table Seating</h2>
              <p style={styles.sectionText}>
                Generate initial table seats during creation. You can name tables
                now or fine-tune them later in Seat Manager after creation.
              </p>
            </div>
          </div>

          <div style={styles.twoPanel}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Generate table seating</h3>

              <div style={styles.formInner}>
                <Field label="Initial marking">
                  <select
                    value={tableInitialTicketTypeId}
                    onChange={(event) =>
                      setTableInitialTicketTypeId(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="">Normal public seats</option>
                    {ticketTypes
                      .filter((ticketType) => ticketType.name.trim())
                      .map((ticketType) => (
                        <option key={ticketType.id} value={ticketType.id}>
                          {ticketType.name}
                        </option>
                      ))}
                  </select>
                </Field>

                <div style={styles.twoCol}>
                  <Field label="Number of tables">
                    <input
                      value={tableCount}
                      onChange={(event) => setTableCount(event.target.value)}
                      type="number"
                      min="1"
                      placeholder="10"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Seats per table">
                    <input
                      value={tableSeatsPerTable}
                      onChange={(event) =>
                        setTableSeatsPerTable(event.target.value)
                      }
                      type="number"
                      min="1"
                      placeholder="8"
                      style={styles.input}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Table seating summary</h3>
              <p style={styles.sectionText}>
                Leave these blank if you want to create the event first and
                generate table seats later.
              </p>
            </div>
          </div>

          <div style={{ ...styles.panel, marginTop: 16 }}>
            <h3 style={styles.panelTitle}>Table names optional</h3>
            <p style={styles.sectionText}>
              Add names for tables before they go public. Use table numbers as
              keys. You can also edit these later on the event manage page.
            </p>

            <textarea
              value={tableNamesRaw}
              onChange={(event) => setTableNamesRaw(event.target.value)}
              placeholder='{"1": "VIP", "2": "Sponsors", "3": "Smith Family"}'
              rows={6}
              style={{
                ...styles.textarea,
                marginTop: 12,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
            />

            <p style={styles.sectionText}>
              Example: {"{ \"1\": \"VIP\", \"2\": \"Sponsors\", \"3\": \"Smith Family\" }"}
            </p>
          </div>
        </section>
      )}

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>
              {eventType === "general_admission" ? "Section 3" : "Section 4"}
            </p>
            <h2 style={styles.sectionTitle}>Prize settings</h2>
            <p style={styles.sectionText}>
              Choose which prizes are visible on the public event page.
            </p>
          </div>

          <button type="button" onClick={addPrize} style={styles.lightButton}>
            + Add prize
          </button>
        </div>

        <div style={styles.prizeList}>
          {prizes.map((prize, index) => (
            <div key={prize.id} style={styles.prizeRow}>
              <div style={styles.rowHeader}>
                <strong>Prize {index + 1}</strong>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={prize.is_public}
                    onChange={(event) =>
                      updatePrize(prize.id, {
                        is_public: event.target.checked,
                      })
                    }
                  />
                  Show publicly
                </label>
              </div>

              <div style={styles.prizeGrid}>
                <Field label="Position">
                  <input
                    value={prize.position}
                    onChange={(event) =>
                      updatePrize(prize.id, {
                        position: event.target.value,
                      })
                    }
                    type="number"
                    min="1"
                    step="1"
                    style={styles.input}
                  />
                </Field>

                <Field label="Prize title">
                  <input
                    value={prize.title}
                    onChange={(event) =>
                      updatePrize(prize.id, { title: event.target.value })
                    }
                    placeholder="Prize title"
                    style={styles.input}
                  />
                </Field>
              </div>

              <Field label="Description optional">
                <textarea
                  value={prize.description}
                  onChange={(event) =>
                    updatePrize(prize.id, {
                      description: event.target.value,
                    })
                  }
                  rows={2}
                  style={styles.textarea}
                />
              </Field>

              <button
                type="button"
                onClick={() => removePrize(prize.id)}
                disabled={prizes.length <= 1}
                style={{
                  ...styles.dangerOutlineButton,
                  cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                  opacity: prizes.length <= 1 ? 0.55 : 1,
                }}
              >
                Remove prize
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.submitBar}>
        <div>
          <strong style={{ color: "#0f172a" }}>Create event</strong>
          <div style={styles.mutedSmall}>
            After creation you’ll be taken to the full event manage page.
          </div>
        </div>

        <button type="submit" style={styles.primaryButton}>
          Create event
        </button>
      </section>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  form: {
    display: "grid",
    gap: 16,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 240px",
    gap: 18,
    alignItems: "stretch",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    marginBottom: 0,
  },
  heroContent: { minWidth: 0 },
  eyebrow: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "0 0 10px",
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  },
  subtle: {
    margin: "12px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
  },
  badgeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  goldBadge: {
    background: "#facc15",
    color: "#111827",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },
  darkBadge: {
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },
  heroImageWrap: {
    borderRadius: 18,
    background: "#1e293b",
    border: "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    minHeight: 150,
  },
  heroImageEmpty: {
    height: "100%",
    minHeight: 150,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 42,
    color: "#94a3b8",
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
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
  formInner: {
    display: "grid",
    gap: 14,
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
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(180px, 260px)",
    gap: 16,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  previewBox: {
    height: 220,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  emptyPreview: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 42,
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 0,
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  twoPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
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
  list: {
    display: "grid",
    gap: 10,
  },
  editTicketCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#f8fafc",
  },
  prizeList: {
    display: "grid",
    gap: 12,
  },
  prizeRow: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#f8fafc",
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  prizeGrid: {
    display: "grid",
    gridTemplateColumns: "110px minmax(0, 1fr)",
    gap: 12,
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontWeight: 900,
    color: "#334155",
  },
  dangerOutlineButton: {
    width: "fit-content",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  primaryButton: {
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
};

