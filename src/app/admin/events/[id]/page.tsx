import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
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
        <div>
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

      {searchParams?.saved && (
        <div style={styles.successBox}>Saved successfully.</div>
      )}

      {searchParams?.error && (
        <div style={styles.errorBox}>Please check the missing fields and try again.</div>
      )}

      <section id="overview" style={styles.section}>
        <div style={styles.sectionHeader}>
          <p style={styles.sectionEyebrow}>Section 1</p>
          <h2 style={styles.sectionTitle}>Overview</h2>
          <p style={styles.sectionText}>
            Edit the main event details, status and public page settings.
          </p>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Ticket types</p>
            <p style={styles.statValue}>{ticketTypes.length}</p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Seats/tables</p>
            <p style={styles.statValue}>{seats.length}</p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Available</p>
            <p style={styles.statValue}>{availableSeats}</p>
          </div>
          <div style={styles.statBox}>
            <p style={styles.statLabel}>Sold / reserved</p>
            <p style={styles.statValue}>{soldSeats + reservedSeats}</p>
          </div>
        </div>

        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Event details</h3>

          <form action={updateEventAction} style={styles.form}>
            <input type="hidden" name="id" value={event.id} />

            <label style={styles.label}>
              Title
              <input
                name="title"
                required
                defaultValue={event.title}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Slug
              <input
                name="slug"
                required
                defaultValue={event.slug}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Description
              <textarea
                name="description"
                rows={5}
                defaultValue={event.description || ""}
                style={styles.textarea}
              />
            </label>

            <div style={styles.twoCol}>
              <label style={styles.label}>
                Image URL
                <input
                  name="image_url"
                  defaultValue={event.image_url || ""}
                  placeholder="https://..."
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Location
                <input
                  name="location"
                  defaultValue={event.location || ""}
                  style={styles.input}
                />
              </label>
            </div>
                        <div style={styles.twoCol}>
              <label style={styles.label}>
                Starts at
                <input
                  name="starts_at"
                  type="datetime-local"
                  defaultValue={formatDateTimeLocal(event.starts_at)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Ends at
                <input
                  name="ends_at"
                  type="datetime-local"
                  defaultValue={formatDateTimeLocal(event.ends_at)}
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.threeCol}>
              <label style={styles.label}>
                Currency
                <select name="currency" defaultValue={event.currency} style={styles.input}>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>

              <label style={styles.label}>
                Type
                <select
                  name="event_type"
                  defaultValue={event.event_type}
                  style={styles.input}
                >
                  <option value="general_admission">General admission</option>
                  <option value="reserved_seating">Reserved seating</option>
                  <option value="tables">Tables</option>
                </select>
              </label>

              <label style={styles.label}>
                Status
                <select name="status" defaultValue={event.status} style={styles.input}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            </div>

            <button type="submit" style={styles.primaryButton}>
              Save event details
            </button>
          </form>
        </div>
      </section>

      {/* ================= TICKETS ================= */}
      <section id="tickets" style={styles.section}>
        <h2 style={styles.sectionTitle}>Tickets & Prices</h2>

        <div style={styles.twoPanel}>
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Add ticket type</h3>

            <form action={addTicketTypeAction} style={styles.form}>
              <input type="hidden" name="event_id" value={event.id} />

              <input name="name" required placeholder="Standard, VIP..." style={styles.input} />
              <input name="description" placeholder="Optional" style={styles.input} />

              <div style={styles.threeCol}>
                <input name="price" type="number" step="0.01" placeholder="10.00" style={styles.input} />
                <input name="capacity" type="number" placeholder="100" style={styles.input} />
                <input name="sort_order" defaultValue={ticketTypes.length} style={styles.input} />
              </div>

              <button type="submit" style={styles.primaryButton}>
                Add ticket type
              </button>
            </form>
          </div>

          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Current ticket types</h3>

            {ticketTypes.length === 0 ? (
              <p style={styles.emptyText}>No ticket types yet</p>
            ) : (
              ticketTypes.map((t) => (
                <div key={t.id} style={styles.card}>
                  <strong>{t.name}</strong>
                  <span>{event.currency} {moneyFromCents(t.price)}</span>
                </div>
              ))
            )}

            <form action={clearTicketTypesAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={styles.dangerButton}>
                Clear ticket types
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ================= SEATING ================= */}
      <section id="seating" style={styles.section}>
        <h2 style={styles.sectionTitle}>Seating & Tables</h2>

        <div style={styles.twoPanel}>
          <form action={generateSeatsAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <h3 style={styles.panelTitle}>Generate rows</h3>

            <input name="rows" placeholder="A,B,C" style={styles.input} />
            <input name="seats_per_row" type="number" placeholder="10" style={styles.input} />

            <button type="submit" style={styles.primaryButton}>
              Generate seats
            </button>
          </form>

          <form action={generateTablesAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <h3 style={styles.panelTitle}>Generate tables</h3>

            <input name="table_count" type="number" placeholder="10" style={styles.input} />
            <input name="seats_per_table" type="number" placeholder="8" style={styles.input} />

            <button type="submit" style={styles.primaryButton}>
              Generate tables
            </button>
          </form>
        </div>
      </section>

      {/* ================= ORDERS ================= */}
      <section id="orders" style={styles.section}>
        <h2 style={styles.sectionTitle}>Orders</h2>
        <p style={styles.emptyText}>Checkout not connected yet.</p>
      </section>

      {/* ================= DELETE ================= */}
      <section style={styles.section}>
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

/* ================= STYLES ================= */

const styles: Record<string, CSSProperties> = {
  page: { padding: 16, maxWidth: 1100, margin: "0 auto" },

  hero: { display: "flex", justifyContent: "space-between", marginBottom: 20 },
  eyebrow: { fontSize: 12, fontWeight: 900, color: "#2563eb" },
  title: { fontSize: 32, fontWeight: 900 },
  subtle: { fontSize: 14, color: "#64748b" },

  badgeRow: { display: "flex", gap: 8, marginTop: 8 },
  goldBadge: { background: "#facc15", padding: "4px 8px", borderRadius: 999 },
  darkBadge: { background: "#e2e8f0", padding: "4px 8px", borderRadius: 999 },

  heroActions: { display: "flex", gap: 8 },
  primaryLink: { padding: 10, background: "#111827", color: "#fff", borderRadius: 8 },
  secondaryButton: { padding: 10, border: "1px solid #111827", borderRadius: 8 },

  tabs: { display: "flex", gap: 8, marginBottom: 16 },
  tab: { padding: 10, border: "1px solid #ddd", borderRadius: 8 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 24, fontWeight: 900 },

  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 },
  statBox: { padding: 12, border: "1px solid #ddd" },
  statLabel: { fontSize: 12 },
  statValue: { fontSize: 18, fontWeight: 900 },

  panel: { padding: 16, border: "1px solid #ddd", borderRadius: 12 },
  panelTitle: { fontSize: 18, fontWeight: 900 },

  form: { display: "grid", gap: 10 },
  label: { display: "grid", gap: 4 },

  input: { padding: 10, borderRadius: 8, border: "1px solid #ccc" },
  textarea: { padding: 10, borderRadius: 8, border: "1px solid #ccc" },

  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  threeCol: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },

  twoPanel: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },

  primaryButton: {
    padding: 12,
    background: "#111827",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 900,
  },

  dangerButton: {
    padding: 12,
    background: "#ef4444",
    color: "#fff",
    borderRadius: 8,
    fontWeight: 900,
  },

  successBox: { padding: 10, background: "#dcfce7", marginBottom: 10 },
  errorBox: { padding: 10, background: "#fee2e2", marginBottom: 10 },

  card: {
    display: "flex",
    justifyContent: "space-between",
    padding: 10,
    border: "1px solid #ddd",
    marginBottom: 6,
  },

  emptyText: { color: "#64748b" },
};
