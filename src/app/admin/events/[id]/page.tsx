import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  createEventSeat,
  createEventTicketType,
  deleteEvent,
  deleteEventSeats,
  deleteEventTicketType,
  deleteEventTicketTypes,
  getEventById,
  updateEvent,
  updateEventTicketType,
  type EventType,
} from "../../../../../api/_lib/events-repo";

type PageProps = {
  params: { id: string };
};

/* ================= HELPERS ================= */

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function poundsToCents(value: FormDataEntryValue | null) {
  const number = Number(String(value || "0").replace(",", "."));
  return Math.round(number * 100);
}

function positiveInteger(value: FormDataEntryValue | null, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function eventTypeLabel(type: string) {
  if (type === "reserved_seating") return "Reserved seating";
  if (type === "tables") return "Tables";
  return "General admission";
}

/* ================= SERVER ACTIONS ================= */

async function updateEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const id = String(formData.get("id"));
  const title = String(formData.get("title"));
  const slug = String(formData.get("slug"));
  const description = String(formData.get("description"));
  const imageUrl = String(formData.get("image_url"));
  const location = String(formData.get("location"));
  const startsAt = String(formData.get("starts_at"));
  const endsAt = String(formData.get("ends_at"));
  const currency = String(formData.get("currency") || "GBP");
  const eventType = String(formData.get("event_type")) as EventType;
  const status = String(formData.get("status")) as "draft" | "published" | "closed";

  await updateEvent(id, {
    title,
    slug,
    description: description || null,
    imageUrl: imageUrl || null,
    location: location || null,
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    currency,
    eventType,
    status,
  });

  redirect(`/admin/events/${id}`);
}

/* ================= TICKETS ================= */

async function addTicketTypeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));

  await createEventTicketType({
    eventId,
    name: String(formData.get("name")),
    description: String(formData.get("description")) || null,
    price: poundsToCents(formData.get("price")),
    capacity: positiveInteger(formData.get("capacity"), 0) || null,
    isActive: true,
  });

  redirect(`/admin/events/${eventId}`);
}

async function updateTicketTypeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));
  const id = String(formData.get("ticket_type_id"));

  await updateEventTicketType(id, {
    name: String(formData.get("name")),
    description: String(formData.get("description")) || null,
    price: poundsToCents(formData.get("price")),
    capacity: positiveInteger(formData.get("capacity"), 0) || null,
  });

  redirect(`/admin/events/${eventId}`);
}

async function deleteTicketTypeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));
  const id = String(formData.get("ticket_type_id"));

  await deleteEventTicketType(id);

  redirect(`/admin/events/${eventId}`);
}

async function clearTicketTypesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));
  await deleteEventTicketTypes(eventId);

  redirect(`/admin/events/${eventId}`);
}

/* ================= SEATS ================= */

async function generateSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));
  const rows = String(formData.get("rows")).split(",");
  const seatsPerRow = positiveInteger(formData.get("seats_per_row"), 0);

  for (const row of rows) {
    for (let i = 1; i <= seatsPerRow; i++) {
      await createEventSeat({
        eventId,
        rowLabel: row.trim(),
        seatNumber: String(i),
      });
    }
  }

  redirect(`/admin/events/${eventId}`);
}

async function generateTablesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));
  const tableCount = positiveInteger(formData.get("table_count"), 0);
  const seatsPerTable = positiveInteger(formData.get("seats_per_table"), 0);

  for (let t = 1; t <= tableCount; t++) {
    for (let s = 1; s <= seatsPerTable; s++) {
      await createEventSeat({
        eventId,
        tableNumber: String(t),
        seatNumber: String(s),
      });
    }
  }

  redirect(`/admin/events/${eventId}`);
}

async function clearSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));
  await deleteEventSeats(eventId);

  redirect(`/admin/events/${eventId}`);
}

async function deleteSeatAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id"));
  const id = String(formData.get("seat_id"));

  await deleteEventSeat(id);

  redirect(`/admin/events/${eventId}`);
}

/* ================= DELETE EVENT ================= */

async function deleteEventAction(formData: FormData) {
  "use server";

  const id = String(formData.get("event_id"));
  await deleteEvent(id);

  redirect("/admin/events");
}
export default async function AdminEventManagePage({
  params,
}: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const event = await getEventById(params.id);
  if (!event) notFound();

  const ticketTypes = event.ticket_types || [];
  const seats = event.seats || [];

  const availableSeats = seats.filter((seat) => seat.status === "available").length;
  const reservedSeats = seats.filter((seat) => seat.status === "reserved").length;
  const soldSeats = seats.filter((seat) => seat.status === "sold").length;

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Events & Tickets</p>
          <h1 style={styles.title}>{event.title}</h1>
          <p style={styles.subtle}>/e/{event.slug}</p>

          <div style={styles.badgeRow}>
            <span style={styles.goldBadge}>{eventTypeLabel(event.event_type)}</span>
            <span style={styles.darkBadge}>{event.status}</span>
            <span style={styles.darkBadge}>{event.currency}</span>
          </div>
        </div>

        <div style={styles.heroActions}>
          <Link href="/admin/events" style={styles.secondaryButton}>
            Back to events
          </Link>
          <Link href={`/e/${event.slug}`} style={styles.primaryLink}>
            View public page
          </Link>
        </div>
      </section>

      <nav style={styles.tabs}>
        <a href="#overview" style={styles.tab}>Overview</a>
        <a href="#tickets" style={styles.tab}>Tickets & Prices</a>
        <a href="#seating" style={styles.tab}>Seating & Tables</a>
        <a href="#orders" style={styles.tab}>Orders</a>
      </nav>

      <section id="overview" style={styles.section}>
        <h2 style={styles.sectionTitle}>Overview</h2>

        <div style={styles.statsGrid}>
          <SummaryCard label="Ticket types" value={ticketTypes.length} />
          <SummaryCard label="Seats / tables" value={seats.length} />
          <SummaryCard label="Available" value={availableSeats} />
          <SummaryCard label="Sold / reserved" value={soldSeats + reservedSeats} />
        </div>

        <form action={updateEventAction} style={styles.form}>
          <input type="hidden" name="id" value={event.id} />

          <Field label="Title">
            <input name="title" defaultValue={event.title} required style={styles.input} />
          </Field>

          <Field label="Slug">
            <input name="slug" defaultValue={event.slug} required style={styles.input} />
          </Field>

          <Field label="Description">
            <textarea
              name="description"
              defaultValue={event.description || ""}
              rows={4}
              style={styles.textarea}
            />
          </Field>

          <div style={styles.twoCol}>
            <Field label="Image URL">
              <input
                name="image_url"
                defaultValue={event.image_url || ""}
                placeholder="https://..."
                style={styles.input}
              />
            </Field>

            <Field label="Location">
              <input
                name="location"
                defaultValue={event.location || ""}
                style={styles.input}
              />
            </Field>
          </div>

          <div style={styles.twoCol}>
            <Field label="Starts at">
              <input
                name="starts_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(event.starts_at)}
                style={styles.input}
              />
            </Field>

            <Field label="Ends at">
              <input
                name="ends_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(event.ends_at)}
                style={styles.input}
              />
            </Field>
          </div>

          <div style={styles.threeCol}>
            <Field label="Currency">
              <select name="currency" defaultValue={event.currency} style={styles.input}>
                <option value="GBP">GBP</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>

            <Field label="Type">
              <select name="event_type" defaultValue={event.event_type} style={styles.input}>
                <option value="general_admission">General admission</option>
                <option value="reserved_seating">Reserved seating</option>
                <option value="tables">Tables</option>
              </select>
            </Field>

            <Field label="Status">
              <select name="status" defaultValue={event.status} style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
          </div>

          <button type="submit" style={styles.primaryButton}>
            Save event details
          </button>
        </form>
      </section>

      <section id="tickets" style={styles.section}>
        <h2 style={styles.sectionTitle}>Tickets & Prices</h2>

        <div style={styles.twoPanel}>
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Add ticket type</h3>

            <form action={addTicketTypeAction} style={styles.form}>
              <input type="hidden" name="event_id" value={event.id} />

              <Field label="Name">
                <input name="name" required placeholder="Standard, VIP..." style={styles.input} />
              </Field>

              <Field label="Description">
                <input name="description" placeholder="Optional" style={styles.input} />
              </Field>

              <div style={styles.threeCol}>
                <Field label="Price">
                  <input name="price" type="number" step="0.01" placeholder="10.00" style={styles.input} />
                </Field>

                <Field label="Capacity">
                  <input name="capacity" type="number" placeholder="100" style={styles.input} />
                </Field>

                <Field label="Order">
                  <input name="sort_order" type="number" defaultValue={ticketTypes.length} style={styles.input} />
                </Field>
              </div>

              <button type="submit" style={styles.primaryButton}>
                Add ticket type
              </button>
            </form>
          </div>

          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Current ticket types</h3>

            <div style={styles.list}>
              {ticketTypes.length === 0 ? (
                <div style={styles.emptyBox}>No ticket types yet.</div>
              ) : (
                ticketTypes.map((ticketType) => (
                  <div key={ticketType.id} style={styles.editCard}>
                    <form action={updateTicketTypeAction} style={styles.form}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="ticket_type_id" value={ticketType.id} />

                      <Field label="Name">
                        <input name="name" defaultValue={ticketType.name} required style={styles.input} />
                      </Field>

                      <Field label="Description">
                        <input name="description" defaultValue={ticketType.description || ""} style={styles.input} />
                      </Field>

                      <div style={styles.threeCol}>
                        <Field label="Price">
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            defaultValue={moneyFromCents(ticketType.price)}
                            style={styles.input}
                          />
                        </Field>

                        <Field label="Capacity">
                          <input
                            name="capacity"
                            type="number"
                            defaultValue={ticketType.capacity || ""}
                            style={styles.input}
                          />
                        </Field>

                        <Field label="Active">
                          <select
                            name="is_active"
                            defaultValue={ticketType.is_active ? "true" : "false"}
                            style={styles.input}
                          >
                            <option value="true">Active</option>
                            <option value="false">Hidden</option>
                          </select>
                        </Field>
                      </div>

                      <button type="submit" style={styles.primaryButton}>
                        Save ticket type
                      </button>
                    </form>

                    <form action={deleteTicketTypeAction}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="ticket_type_id" value={ticketType.id} />
                      <button type="submit" style={styles.dangerOutlineButton}>
                        Delete ticket type
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>

            <form action={clearTicketTypesAction} style={{ marginTop: 14 }}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={styles.dangerOutlineButton}>
                Clear all ticket types
              </button>
            </form>
          </div>
        </div>
      </section>
            <section id="seating" style={styles.section}>
        <h2 style={styles.sectionTitle}>Seating & Tables</h2>

        <div style={styles.twoPanel}>
          <form action={generateSeatsAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <h3 style={styles.panelTitle}>Generate rows</h3>

            <div style={styles.twoCol}>
              <Field label="Rows">
                <input name="rows" placeholder="A,B,C,D" style={styles.input} />
              </Field>

              <Field label="Seats per row">
                <input
                  name="seats_per_row"
                  type="number"
                  min="1"
                  placeholder="10"
                  style={styles.input}
                />
              </Field>
            </div>

            <button type="submit" style={styles.primaryButton}>
              Generate row seats
            </button>
          </form>

          <form action={generateTablesAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <h3 style={styles.panelTitle}>Generate tables</h3>

            <div style={styles.twoCol}>
              <Field label="Number of tables">
                <input
                  name="table_count"
                  type="number"
                  min="1"
                  placeholder="10"
                  style={styles.input}
                />
              </Field>

              <Field label="Seats per table">
                <input
                  name="seats_per_table"
                  type="number"
                  min="1"
                  placeholder="8"
                  style={styles.input}
                />
              </Field>
            </div>

            <button type="submit" style={styles.primaryButton}>
              Generate tables
            </button>
          </form>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Generated seats</h3>

            <form action={clearSeatsAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={styles.dangerOutlineButton}>
                Clear all seats/tables
              </button>
            </form>
          </div>

          {seats.length === 0 ? (
            <div style={styles.emptyBox}>No seats generated yet.</div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Row</th>
                    <th style={styles.th}>Table</th>
                    <th style={styles.th}>Seat</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {seats.map((seat) => (
                    <tr key={seat.id}>
                      <td style={styles.td}>{seat.row_label || "—"}</td>
                      <td style={styles.td}>{seat.table_number || "—"}</td>
                      <td style={styles.td}>{seat.seat_number || "—"}</td>
                      <td style={styles.td}>{seat.status}</td>
                      <td style={styles.td}>
                        {seat.customer_name || seat.customer_email || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section id="orders" style={styles.section}>
        <h2 style={styles.sectionTitle}>Orders</h2>
        <div style={styles.emptyBox}>Checkout not connected yet.</div>
      </section>

      <section style={styles.dangerSection}>
        <h2 style={styles.sectionTitle}>Danger zone</h2>

        <form action={deleteEventAction}>
          <input type="hidden" name="event_id" value={event.id} />
          <button type="submit" style={styles.dangerButton}>
            Delete event
          </button>
        </form>
      </section>
    </main>
  );
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";

  try {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={styles.statBox}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  eyebrow: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  },
  subtle: {
    margin: "8px 0 0",
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
  heroActions: {
    display: "grid",
    gap: 10,
    minWidth: 150,
  },
  primaryLink: {
    padding: "11px 14px",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 999,
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  },
  secondaryButton: {
    padding: "11px 14px",
    border: "1px solid rgba(255,255,255,0.24)",
    color: "#ffffff",
    borderRadius: 999,
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  tab: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: "0 0 14px",
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.02em",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    padding: 15,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  statValue: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 900,
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  panelTitle: {
    margin: "0 0 12px",
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
  },
  form: {
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
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 12,
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },
  twoPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  primaryButton: {
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerOutlineButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  list: {
    display: "grid",
    gap: 10,
  },
  editCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
  },
  tableWrap: {
    overflow: "auto",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
  },
  table: {
    width: "100%",
    minWidth: 700,
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: 12,
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  td: {
    padding: 12,
    borderTop: "1px solid #e2e8f0",
    color: "#334155",
  },
  dangerSection: {
    padding: 18,
    borderRadius: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
};
