import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ImageUploadField from "@/components/ImageUploadField";
import {
  createEventSeat,
  createEventTicketType,
  deleteEvent,
  deleteEventSeats,
  deleteEventTicketTypes,
  getEventById,
  updateEvent,
  type EventType,
} from "../../../../../api/_lib/events-repo";

type PageProps = {
  params: {
    id: string;
  };
};

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

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function poundsToCents(value: FormDataEntryValue | null) {
  const number = Number(String(value || "0").replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return 0;
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

function statusLabel(status: string) {
  if (status === "published") return "Published";
  if (status === "closed") return "Closed";
  return "Draft";
}

async function updateEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const id = String(formData.get("id") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const imageUrl = String(formData.get("image_url") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const startsAt = String(formData.get("starts_at") || "").trim();
  const endsAt = String(formData.get("ends_at") || "").trim();
  const currency = String(formData.get("currency") || "GBP").trim() || "GBP";
  const eventType = String(
    formData.get("event_type") || "general_admission",
  ) as EventType;
  const status = String(formData.get("status") || "draft") as
    | "draft"
    | "published"
    | "closed";

  if (!id || !title || !slug) {
    redirect(`/admin/events/${id}?error=missing-required`);
  }

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

  redirect(`/admin/events/${id}?saved=event`);
}

async function addTicketTypeAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const price = poundsToCents(formData.get("price"));
  const capacity = positiveInteger(formData.get("capacity"), 0);
  const sortOrder = positiveInteger(formData.get("sort_order"), 0);

  if (!eventId || !name) {
    redirect(`/admin/events/${eventId}?error=missing-ticket`);
  }

  await createEventTicketType({
    eventId,
    name,
    description: description || null,
    price,
    capacity: capacity || null,
    sortOrder,
    isActive: true,
  });

  redirect(`/admin/events/${eventId}?saved=ticket`);
}

async function clearTicketTypesAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  if (eventId) await deleteEventTicketTypes(eventId);

  redirect(`/admin/events/${eventId}?saved=tickets-cleared`);
}

async function generateSeatsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const section = String(formData.get("section") || "").trim();
  const rowsRaw = String(formData.get("rows") || "").trim();
  const seatsPerRow = positiveInteger(formData.get("seats_per_row"), 0);
  const ticketTypeId =
    String(formData.get("ticket_type_id") || "").trim() || null;
  const clearExisting = String(formData.get("clear_existing") || "") === "yes";

  if (!eventId || !rowsRaw || seatsPerRow <= 0) {
    redirect(`/admin/events/${eventId}?error=missing-seats`);
  }

  if (clearExisting) await deleteEventSeats(eventId);

  const rows = rowsRaw
    .split(",")
    .map((row) => row.trim())
    .filter(Boolean);

  for (const rowLabel of rows) {
    for (let seat = 1; seat <= seatsPerRow; seat += 1) {
      await createEventSeat({
        eventId,
        ticketTypeId,
        section: section || null,
        rowLabel,
        seatNumber: String(seat),
        tableNumber: null,
      });
    }
  }

  redirect(`/admin/events/${eventId}?saved=seats`);
}

async function generateTablesAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const tableCount = positiveInteger(formData.get("table_count"), 0);
  const seatsPerTable = positiveInteger(formData.get("seats_per_table"), 0);
  const ticketTypeId =
    String(formData.get("ticket_type_id") || "").trim() || null;
  const clearExisting = String(formData.get("clear_existing") || "") === "yes";

  if (!eventId || tableCount <= 0 || seatsPerTable <= 0) {
    redirect(`/admin/events/${eventId}?error=missing-tables`);
  }

  if (clearExisting) await deleteEventSeats(eventId);

  for (let table = 1; table <= tableCount; table += 1) {
    for (let seat = 1; seat <= seatsPerTable; seat += 1) {
      await createEventSeat({
        eventId,
        ticketTypeId,
        section: null,
        rowLabel: null,
        seatNumber: String(seat),
        tableNumber: String(table),
      });
    }
  }

  redirect(`/admin/events/${eventId}?saved=tables`);
}

async function clearSeatsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  if (eventId) await deleteEventSeats(eventId);

  redirect(`/admin/events/${eventId}?saved=seats-cleared`);
}

async function deleteEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  if (eventId) await deleteEvent(eventId);

  redirect("/admin/events");
}

export default async function AdminEventManagePage({
  params,
  searchParams,
}: PageProps & {
  searchParams?: {
    saved?: string;
    error?: string;
  };
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const event = await getEventById(params.id);
  if (!event) notFound();

  const ticketTypes = event.ticket_types || [];
  const seats = event.seats || [];
  const soldSeats = seats.filter((seat) => seat.status === "sold").length;
  const reservedSeats = seats.filter((seat) => seat.status === "reserved").length;
  const availableSeats = seats.filter((seat) => seat.status === "available").length;

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <p style={styles.eyebrow}>Events & Tickets</p>
          <h1 style={styles.title}>{event.title}</h1>

          <div style={styles.badgeRow}>
            <span style={styles.goldBadge}>{eventTypeLabel(event.event_type)}</span>
            <span style={styles.darkBadge}>{statusLabel(event.status)}</span>
            <span style={styles.darkBadge}>{event.currency}</span>
          </div>

          <p style={styles.subtle}>
            Public page: <strong>/e/{event.slug}</strong>
          </p>
        </div>

        <div style={styles.heroImageWrap}>
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              style={styles.heroImage}
            />
          ) : (
            <div style={styles.heroImageEmpty}>🎫</div>
          )}
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
        <a href="#overview" style={styles.tab}>
          Overview
        </a>
        <a href="#tickets" style={styles.tab}>
          Tickets & Prices
        </a>
        <a href="#seating" style={styles.tab}>
          Seating & Tables
        </a>
        <a href="#orders" style={styles.tab}>
          Orders
        </a>
      </nav>

      {searchParams?.saved && (
        <div style={styles.successBox}>Saved successfully.</div>
      )}

      {searchParams?.error && (
        <div style={styles.errorBox}>
          Please check the missing fields and try again.
        </div>
      )}

      <section id="overview" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Section 1</p>
            <h2 style={styles.sectionTitle}>Overview</h2>
            <p style={styles.sectionText}>
              Edit the main event details, image, status and public page settings.
            </p>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <SummaryCard label="Ticket types" value={ticketTypes.length} />
          <SummaryCard label="Seats/tables" value={seats.length} />
          <SummaryCard label="Available" value={availableSeats} />
          <SummaryCard label="Sold / reserved" value={soldSeats + reservedSeats} />
        </div>

        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Event details</h3>

          <form action={updateEventAction} style={styles.form}>
            <input type="hidden" name="id" value={event.id} />

            <Field label="Title">
              <input
                name="title"
                required
                defaultValue={event.title}
                style={styles.input}
              />
            </Field>

            <Field label="Slug">
              <input
                name="slug"
                required
                defaultValue={event.slug}
                style={styles.input}
              />
            </Field>

            <Field label="Description">
              <textarea
                name="description"
                rows={5}
                defaultValue={event.description || ""}
                style={styles.textarea}
              />
            </Field>

            <div style={styles.mediaBox}>
              <div>
                <h3 style={styles.panelTitle}>Event image</h3>
                <p style={styles.sectionText}>
                  Upload or replace the public event image.
                </p>

                <ImageUploadField currentImageUrl={event.image_url ?? ""} />
              </div>

              <div style={styles.previewBox}>
                {event.image_url ? (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    style={styles.previewImage}
                  />
                ) : (
                  <div style={styles.emptyPreview}>🎫</div>
                )}
              </div>
            </div>

            <div style={styles.twoCol}>
              <Field label="Location">
                <input
                  name="location"
                  defaultValue={event.location || ""}
                  style={styles.input}
                />
              </Field>

              <Field label="Currency">
                <select
                  name="currency"
                  defaultValue={event.currency}
                  style={styles.input}
                >
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
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

            <div style={styles.twoCol}>
              <Field label="Type">
                <select
                  name="event_type"
                  defaultValue={event.event_type}
                  style={styles.input}
                >
                  <option value="general_admission">General admission</option>
                  <option value="reserved_seating">Reserved seating</option>
                  <option value="tables">Tables</option>
                </select>
              </Field>

              <Field label="Status">
                <select
                  name="status"
                  defaultValue={event.status}
                  style={styles.input}
                >
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
        </div>
      </section>

      <section id="tickets" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Section 2</p>
            <h2 style={styles.sectionTitle}>Tickets & Prices</h2>
            <p style={styles.sectionText}>
              Add ticket types, prices and capacity. These power admission,
              reserved seating and table seat prices.
            </p>
          </div>
        </div>

        <div style={styles.twoPanel}>
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Add ticket type</h3>

            <form action={addTicketTypeAction} style={styles.form}>
              <input type="hidden" name="event_id" value={event.id} />

              <Field label="Ticket name">
                <input
                  name="name"
                  required
                  placeholder="Standard, VIP, Adult, Child..."
                  style={styles.input}
                />
              </Field>

              <Field label="Description">
                <input
                  name="description"
                  placeholder="Optional"
                  style={styles.input}
                />
              </Field>

              <div style={styles.threeCol}>
                <Field label="Price">
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="10.00"
                    style={styles.input}
                  />
                </Field>

                <Field label="Capacity">
                  <input
                    name="capacity"
                    type="number"
                    min="0"
                    placeholder="100"
                    style={styles.input}
                  />
                </Field>

                <Field label="Order">
                  <input
                    name="sort_order"
                    type="number"
                    min="0"
                    defaultValue={ticketTypes.length}
                    style={styles.input}
                  />
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
                  <div key={ticketType.id} style={styles.ticketCard}>
                    <div>
                      <strong style={styles.cardTitle}>{ticketType.name}</strong>
                      {ticketType.description && (
                        <p style={styles.cardText}>{ticketType.description}</p>
                      )}
                      <p style={styles.cardText}>
                        Capacity: {ticketType.capacity || "Unlimited"}
                      </p>
                    </div>

                    <span style={styles.priceBadge}>
                      {event.currency} {moneyFromCents(ticketType.price)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <form action={clearTicketTypesAction} style={{ marginTop: 14 }}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={styles.dangerOutlineButton}>
                Clear ticket types
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="seating" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Section 3</p>
            <h2 style={styles.sectionTitle}>Seating & Tables</h2>
            <p style={styles.sectionText}>
              Generate rows, numbered seats, tables and table seats.
            </p>
          </div>
        </div>

        <div style={styles.twoPanel}>
          <form action={generateSeatsAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <h3 style={styles.panelTitle}>Generate rows</h3>

            <Field label="Ticket type">
              <select name="ticket_type_id" style={styles.input}>
                <option value="">No linked ticket type</option>
                {ticketTypes.map((ticketType) => (
                  <option key={ticketType.id} value={ticketType.id}>
                    {ticketType.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Section">
              <input
                name="section"
                placeholder="Main hall, balcony, screen 1..."
                style={styles.input}
              />
            </Field>

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

            <label style={styles.checkboxLabel}>
              <input type="checkbox" name="clear_existing" value="yes" />
              Clear existing seats before generating
            </label>

            <button type="submit" style={styles.primaryButton}>
              Generate row seats
            </button>
          </form>

          <form action={generateTablesAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <h3 style={styles.panelTitle}>Generate tables</h3>

            <Field label="Ticket type">
              <select name="ticket_type_id" style={styles.input}>
                <option value="">No linked ticket type</option>
                {ticketTypes.map((ticketType) => (
                  <option key={ticketType.id} value={ticketType.id}>
                    {ticketType.name}
                  </option>
                ))}
              </select>
            </Field>

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

            <label style={styles.checkboxLabel}>
              <input type="checkbox" name="clear_existing" value="yes" />
              Clear existing seats before generating
            </label>

            <button type="submit" style={styles.primaryButton}>
              Generate tables
            </button>
          </form>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Seats / table seats</h3>

            <form action={clearSeatsAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={styles.dangerOutlineButton}>
                Clear seats/tables
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
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Section</th>
                    <th style={styles.th}>Row</th>
                    <th style={styles.th}>Table</th>
                    <th style={styles.th}>Seat</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Customer</th>
                  </tr>
                </thead>
                <tbody>
                  {seats.map((seat) => {
                    const ticketType = ticketTypes.find(
                      (item) => item.id === seat.ticket_type_id,
                    );

                    return (
                      <tr key={seat.id}>
                        <td style={styles.td}>{ticketType?.name || "—"}</td>
                        <td style={styles.td}>{seat.section || "—"}</td>
                        <td style={styles.td}>{seat.row_label || "—"}</td>
                        <td style={styles.td}>{seat.table_number || "—"}</td>
                        <td style={styles.td}>{seat.seat_number || "—"}</td>
                        <td style={styles.td}>
                          <span style={styles.statusBadge}>{seat.status}</span>
                        </td>
                        <td style={styles.td}>
                          {seat.customer_name || seat.customer_email || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section id="orders" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Section 4</p>
            <h2 style={styles.sectionTitle}>Orders</h2>
            <p style={styles.sectionText}>
              Event orders will appear here once checkout is connected.
            </p>
          </div>
        </div>

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
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 240px auto",
    gap: 18,
    alignItems: "stretch",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    marginBottom: 16,
  },
  heroContent: {
    minWidth: 0,
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
  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
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
  heroActions: {
    display: "grid",
    gap: 10,
    alignContent: "start",
    minWidth: 140,
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
  sectionHeader: {
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
    margin: 0,
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
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.5fr) minmax(180px, 260px)",
    gap: 16,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  previewBox: {
    height: 220,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  emptyPreview: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 42,
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
  successBox: {
    padding: 12,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 16,
    marginBottom: 12,
    fontWeight: 900,
  },
  errorBox: {
    padding: 12,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 16,
    marginBottom: 12,
    fontWeight: 900,
  },
  list: {
    display: "grid",
    gap: 10,
  },
  ticketCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#ffffff",
  },
  cardTitle: {
    color: "#0f172a",
    fontSize: 16,
  },
  cardText: {
    color: "#64748b",
    fontSize: 13,
    margin: "4px 0 0",
  },
  priceBadge: {
    whiteSpace: "nowrap",
    background: "#facc15",
    color: "#111827",
    borderRadius: 999,
    padding: "7px 10px",
    fontWeight: 900,
    height: "fit-content",
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontWeight: 900,
    color: "#334155",
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
    minWidth: 780,
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
  statusBadge: {
    display: "inline-flex",
    padding: "5px 8px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  dangerSection: {
    padding: 18,
    borderRadius: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
};
