import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ImageUploadField from "@/components/ImageUploadField";
import AdminSeatManager from "@/components/admin/events/AdminSeatManager";
import {
  createEventSeat,
  createEventTicketType,
  deleteEvent,
  deleteEventRowsByKeys,
  deleteEventRowSeats,
  deleteEventSeatsByIds,
  deleteEventTableSeats,
  deleteEventTicketType,
  deleteEventTicketTypes,
  getEventById,
  updateEvent,
  updateEventSeatsTicketType,
  updateEventTicketType,
  type EventType,
} from "../../../../../api/_lib/events-repo";

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    saved?: string;
    error?: string;
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

function parseAisleAfterList(value: FormDataEntryValue | null) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((number) => Number.isFinite(number) && number > 0)
        .map((number) => Math.floor(number)),
    ),
  );
}

function parseJsonStringArray(value: FormDataEntryValue | null): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function expandRows(value: string): string[] {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const rows: string[] = [];

  for (const part of parts) {
    if (part.includes("-")) {
      const [rawStart, rawEnd] = part.split("-").map((item) => item.trim());

      const startNumber = Number(rawStart);
      const endNumber = Number(rawEnd);

      if (Number.isFinite(startNumber) && Number.isFinite(endNumber)) {
        const start = Math.min(startNumber, endNumber);
        const end = Math.max(startNumber, endNumber);

        for (let row = start; row <= end; row += 1) {
          rows.push(String(row));
        }

        continue;
      }

      if (
        rawStart.length === 1 &&
        rawEnd.length === 1 &&
        /^[A-Za-z]$/.test(rawStart) &&
        /^[A-Za-z]$/.test(rawEnd)
      ) {
        const start = Math.min(
          rawStart.toUpperCase().charCodeAt(0),
          rawEnd.toUpperCase().charCodeAt(0),
        );
        const end = Math.max(
          rawStart.toUpperCase().charCodeAt(0),
          rawEnd.toUpperCase().charCodeAt(0),
        );

        for (let code = start; code <= end; code += 1) {
          rows.push(String.fromCharCode(code));
        }

        continue;
      }
    }

    rows.push(part);
  }

  return Array.from(new Set(rows));
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
  const capacity = positiveInteger(formData.get("capacity"), 0);
  const currency = String(formData.get("currency") || "GBP").trim() || "GBP";
  const eventType = String(
    formData.get("event_type") || "general_admission",
  ) as EventType;
  const status = String(formData.get("status") || "draft") as
    | "draft"
    | "published"
    | "closed";

  if (!id || !title || !slug) {
    redirect(`/admin/events/${id}?error=missing-required#overview`);
  }

  await updateEvent(id, {
    title,
    slug,
    description: description || null,
    imageUrl: imageUrl || null,
    location: location || null,
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    capacity: capacity || null,
    currency,
    eventType,
    status,
  });

  redirect(`/admin/events/${id}?saved=event#overview`);
}

async function addTicketTypeAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!eventId || !name) {
    redirect(`/admin/events/${eventId}?error=missing-ticket#tickets`);
  }

  await createEventTicketType({
    eventId,
    name,
    description: String(formData.get("description") || "").trim() || null,
    price: poundsToCents(formData.get("price")),
    capacity: positiveInteger(formData.get("capacity"), 0) || null,
    sortOrder: positiveInteger(formData.get("sort_order"), 0),
    isActive: String(formData.get("is_active") || "true") === "true",
  });

  redirect(`/admin/events/${eventId}?saved=ticket#tickets`);
}
async function updateTicketTypeAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!eventId || !ticketTypeId || !name) {
    redirect(`/admin/events/${eventId}?error=missing-ticket#tickets`);
  }

  await updateEventTicketType(ticketTypeId, {
    name,
    description: String(formData.get("description") || "").trim() || null,
    price: poundsToCents(formData.get("price")),
    capacity: positiveInteger(formData.get("capacity"), 0) || null,
    sortOrder: positiveInteger(formData.get("sort_order"), 0),
    isActive: String(formData.get("is_active") || "true") === "true",
  });

  redirect(`/admin/events/${eventId}?saved=ticket-updated#tickets`);
}

async function deleteTicketTypeAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();

  if (ticketTypeId) await deleteEventTicketType(ticketTypeId);

  redirect(`/admin/events/${eventId}?saved=ticket-deleted#tickets`);
}

async function clearTicketTypesAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();

  if (eventId) await deleteEventTicketTypes(eventId);

  redirect(`/admin/events/${eventId}?saved=tickets-cleared#tickets`);
}

async function generateSeatsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const section = String(formData.get("section") || "").trim();
  const rowsRaw = String(formData.get("rows") || "").trim();
  const seatsPerRow = positiveInteger(formData.get("seats_per_row"), 0);
  const aisleAfterList = parseAisleAfterList(formData.get("aisle_after"));
  const ticketTypeId =
    String(formData.get("ticket_type_id") || "").trim() || null;
  const clearExisting = String(formData.get("clear_existing") || "") === "yes";

  if (!eventId || !rowsRaw || seatsPerRow <= 0) {
    redirect(`/admin/events/${eventId}?error=missing-seats#row-seating`);
  }

  if (clearExisting) {
    await deleteEventRowSeats(eventId);
  }

  const rows = expandRows(rowsRaw);

  for (const row of rows) {
    for (let seat = 1; seat <= seatsPerRow; seat += 1) {
      try {
        await createEventSeat({
          eventId,
          ticketTypeId,
          section: section || null,
          rowLabel: row,
          seatNumber: String(seat),
          tableNumber: null,
          aisleAfter: aisleAfterList.includes(seat) ? seat : null,
          status: "available",
        });
      } catch {}
    }
  }

  redirect(`/admin/events/${eventId}?saved=seats#row-seating`);
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
    redirect(`/admin/events/${eventId}?error=missing-tables#table-seating`);
  }

  if (clearExisting) {
    await deleteEventTableSeats(eventId);
  }

  for (let table = 1; table <= tableCount; table += 1) {
    for (let seat = 1; seat <= seatsPerTable; seat += 1) {
      try {
        await createEventSeat({
          eventId,
          ticketTypeId,
          section: null,
          rowLabel: null,
          seatNumber: String(seat),
          tableNumber: String(table),
          aisleAfter: null,
          status: "available",
        });
      } catch {}
    }
  }

  redirect(`/admin/events/${eventId}?saved=tables#table-seating`);
}
async function clearRowSeatsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();

  if (eventId) await deleteEventRowSeats(eventId);

  redirect(`/admin/events/${eventId}?saved=row-seats-cleared#row-seating`);
}

async function clearTableSeatsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();

  if (eventId) await deleteEventTableSeats(eventId);

  redirect(`/admin/events/${eventId}?saved=table-seats-cleared#table-seating`);
}

async function applySeatTicketTypeAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));

  if (!eventId || !ticketTypeId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-seat-selection#row-seating`);
  }

  await updateEventSeatsTicketType({
    eventId,
    seatIds,
    ticketTypeId,
  });

  redirect(`/admin/events/${eventId}?saved=seat-pricing#row-seating`);
}

async function deleteSelectedSeatsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));

  if (!eventId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-seat-selection#row-seating`);
  }

  await deleteEventSeatsByIds({
    eventId,
    seatIds,
  });

  redirect(`/admin/events/${eventId}?saved=selected-seats-deleted#row-seating`);
}

async function deleteSelectedRowsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const eventId = String(formData.get("event_id") || "").trim();
  const rowKeys = parseJsonStringArray(formData.get("row_keys"));

  if (!eventId || rowKeys.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-row-selection#row-seating`);
  }

  await deleteEventRowsByKeys({
    eventId,
    rowKeys,
  });

  redirect(`/admin/events/${eventId}?saved=selected-rows-deleted#row-seating`);
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
}: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const event = await getEventById(params.id);
  if (!event) notFound();

  const ticketTypes = event.ticket_types || [];
  const seats = event.seats || [];

  const isGeneralAdmission = event.event_type === "general_admission";
  const isReservedSeating = event.event_type === "reserved_seating";
  const isTables = event.event_type === "tables";

  const rowSeats = seats.filter((seat) => seat.row_label && !seat.table_number);
  const tableSeats = seats.filter((seat) => seat.table_number);
  const visibleSeats = isReservedSeating
    ? rowSeats
    : isTables
      ? tableSeats
      : seats;

  const soldSeats = visibleSeats.filter((seat) => seat.status === "sold").length;
  const reservedSeats = visibleSeats.filter(
    (seat) => seat.status === "reserved",
  ).length;
  const blockedSeats = visibleSeats.filter(
    (seat) => seat.status === "blocked",
  ).length;
  const availableSeats = visibleSeats.filter(
    (seat) => seat.status === "available",
  ).length;

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
            <img src={event.image_url} alt={event.title} style={styles.heroImage} />
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
        <a href="#overview" style={styles.tab}>Overview</a>
        <a href="#tickets" style={styles.tab}>Tickets & Prices</a>
        {isReservedSeating && <a href="#row-seating" style={styles.tab}>Row Seating</a>}
        {isTables && <a href="#table-seating" style={styles.tab}>Table Seating</a>}
        <a href="#orders" style={styles.tab}>Orders</a>
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
              Choose the event type first. The admin page only shows the sections needed for that type.
            </p>
          </div>
        </div>

        <div style={styles.statsGrid}>
          <SummaryCard label="Ticket types" value={ticketTypes.length} />
          <SummaryCard
            label="Capacity"
            value={
              isGeneralAdmission
                ? event.capacity
                  ? `${event.capacity} tickets`
                  : "Unlimited"
                : isReservedSeating
                  ? `${rowSeats.length} row seats`
                  : `${tableSeats.length} table seats`
            }
          />
          <SummaryCard label="Available" value={availableSeats} />
          <SummaryCard label="Reserved" value={reservedSeats} />
          <SummaryCard label="Sold" value={soldSeats} />
          <SummaryCard label="Blocked" value={blockedSeats} />
        </div>

        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Event details</h3>

          <form action={updateEventAction} style={styles.form}>
            <input type="hidden" name="id" value={event.id} />

            <Field label="Title">
              <input name="title" required defaultValue={event.title} style={styles.input} />
            </Field>

            <Field label="Slug">
              <input name="slug" required defaultValue={event.slug} style={styles.input} />
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
                <p style={styles.sectionText}>Upload or replace the public event image.</p>
                <ImageUploadField currentImageUrl={event.image_url ?? ""} />
              </div>

              <div style={styles.previewBox}>
                {event.image_url ? (
                  <img src={event.image_url} alt={event.title} style={styles.previewImage} />
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

              <Field label="General admission capacity">
                <input
                  name="capacity"
                  type="number"
                  min="0"
                  defaultValue={event.capacity || ""}
                  placeholder="Leave blank for unlimited"
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
              Add, edit, hide or delete ticket types for this event.
            </p>
          </div>
        </div>

        <div style={styles.twoPanel}>
          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Add ticket type</h3>

            <form action={addTicketTypeAction} style={styles.form}>
              <input type="hidden" name="event_id" value={event.id} />

              <Field label="Ticket name">
                <input name="name" required style={styles.input} />
              </Field>

              <Field label="Description">
                <input name="description" style={styles.input} />
              </Field>

              <div style={styles.threeCol}>
                <Field label="Price">
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    style={styles.input}
                  />
                </Field>

                <Field label="Ticket limit">
                  <input
                    name="capacity"
                    type="number"
                    min="0"
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

              <Field label="Visibility">
                <select name="is_active" defaultValue="true" style={styles.input}>
                  <option value="true">Active</option>
                  <option value="false">Hidden</option>
                </select>
              </Field>

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
                  <div key={ticketType.id} style={styles.editTicketCard}>
                    <form action={updateTicketTypeAction} style={styles.form}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input
                        type="hidden"
                        name="ticket_type_id"
                        value={ticketType.id}
                      />

                      <div style={styles.twoCol}>
                        <Field label="Name">
                          <input
                            name="name"
                            required
                            defaultValue={ticketType.name}
                            style={styles.input}
                          />
                        </Field>

                        <Field label="Description">
                          <input
                            name="description"
                            defaultValue={ticketType.description || ""}
                            style={styles.input}
                          />
                        </Field>
                      </div>

                      <div style={styles.fourCol}>
                        <Field label="Price">
                          <input
                            name="price"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={moneyFromCents(ticketType.price)}
                            style={styles.input}
                          />
                        </Field>

                        <Field label="Ticket limit">
                          <input
                            name="capacity"
                            type="number"
                            min="0"
                            defaultValue={ticketType.capacity || ""}
                            style={styles.input}
                          />
                        </Field>

                        <Field label="Order">
                          <input
                            name="sort_order"
                            type="number"
                            min="0"
                            defaultValue={ticketType.sort_order}
                            style={styles.input}
                          />
                        </Field>

                        <Field label="Visibility">
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
                      <input
                        type="hidden"
                        name="ticket_type_id"
                        value={ticketType.id}
                      />
                      <button type="submit" style={styles.dangerOutlineButton}>
                        Delete this ticket type
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

      {isReservedSeating && (
        <section id="row-seating" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.sectionEyebrow}>Section 3</p>
              <h2 style={styles.sectionTitle}>Row Seating</h2>
              <p style={styles.sectionText}>
                Generate row layouts first, then use Seat Manager to price or
                remove individual seats and full rows.
              </p>
            </div>
          </div>

          <div style={styles.twoPanel}>
            <form action={generateSeatsAction} style={styles.panel}>
              <input type="hidden" name="event_id" value={event.id} />

              <h3 style={styles.panelTitle}>Generate row seating</h3>

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
                  placeholder="Main, VIP, Balcony, Left, Centre..."
                  style={styles.input}
                />
              </Field>

              <Field label="Rows">
                <input
                  name="rows"
                  placeholder="1-10 or A-C or 1-3,8-10"
                  style={styles.input}
                />
              </Field>

              <div style={styles.twoCol}>
                <Field label="Seats per row">
                  <input
                    name="seats_per_row"
                    type="number"
                    min="1"
                    placeholder="40"
                    style={styles.input}
                  />
                </Field>

                <Field label="Aisles after seats">
                  <input
                    name="aisle_after"
                    placeholder="10,20,30"
                    style={styles.input}
                  />
                </Field>
              </div>

              <label style={styles.checkboxLabel}>
                <input type="checkbox" name="clear_existing" value="yes" />
                Clear existing row seats before generating
              </label>

              <button type="submit" style={styles.primaryButton}>
                Generate row seating
              </button>
            </form>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Row seating summary</h3>

              <div style={styles.statsGridCompact}>
                <SummaryCard label="Row seats" value={rowSeats.length} />
                <SummaryCard
                  label="Available"
                  value={rowSeats.filter((seat) => seat.status === "available").length}
                />
                <SummaryCard
                  label="Reserved"
                  value={rowSeats.filter((seat) => seat.status === "reserved").length}
                />
                <SummaryCard
                  label="Sold"
                  value={rowSeats.filter((seat) => seat.status === "sold").length}
                />
              </div>

              <p style={styles.sectionText}>
                Use sections for VIP, balcony, left/centre/right blocks. Use
                aisles like 10,20,30 for wide rows.
              </p>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>Seat Manager</h3>
                <p style={styles.sectionText}>
                  Click seats to select them. Click a row label to select the
                  full row. Then apply a price or delete selected seats/rows.
                </p>
              </div>

              <form action={clearRowSeatsAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button type="submit" style={styles.dangerOutlineButton}>
                  Clear row seats only
                </button>
              </form>
            </div>

            {rowSeats.length === 0 ? (
              <div style={styles.emptyBox}>No row seats generated yet.</div>
            ) : (
              <AdminSeatManager
                eventId={event.id}
                seats={rowSeats}
                ticketTypes={ticketTypes}
                currency={event.currency}
                mode="rows"
                applyTicketTypeAction={applySeatTicketTypeAction}
                deleteSelectedSeatsAction={deleteSelectedSeatsAction}
                deleteSelectedRowsAction={deleteSelectedRowsAction}
              />
            )}
          </div>
        </section>
      )}

      {isTables && (
        <section id="table-seating" style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.sectionEyebrow}>Section 3</p>
              <h2 style={styles.sectionTitle}>Table Seating</h2>
              <p style={styles.sectionText}>
                Generate table layouts first, then use Seat Manager to price or
                remove individual table seats.
              </p>
            </div>
          </div>

          <div style={styles.twoPanel}>
            <form action={generateTablesAction} style={styles.panel}>
              <input type="hidden" name="event_id" value={event.id} />

              <h3 style={styles.panelTitle}>Generate table seating</h3>

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
                Clear existing table seats before generating
              </label>

              <button type="submit" style={styles.primaryButton}>
                Generate table seating
              </button>
            </form>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Table seating summary</h3>

              <div style={styles.statsGridCompact}>
                <SummaryCard label="Table seats" value={tableSeats.length} />
                <SummaryCard
                  label="Available"
                  value={tableSeats.filter((seat) => seat.status === "available").length}
                />
                <SummaryCard
                  label="Reserved"
                  value={tableSeats.filter((seat) => seat.status === "reserved").length}
                />
                <SummaryCard
                  label="Sold"
                  value={tableSeats.filter((seat) => seat.status === "sold").length}
                />
              </div>

              <p style={styles.sectionText}>
                Tables are shown separately so dinner/table-plan events do not
                mix with theatre-style rows.
              </p>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>Seat Manager</h3>
                <p style={styles.sectionText}>
                  Click table seats to select them. Then apply a price or delete
                  selected seats.
                </p>
              </div>

              <form action={clearTableSeatsAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button type="submit" style={styles.dangerOutlineButton}>
                  Clear table seats only
                </button>
              </form>
            </div>

            {tableSeats.length === 0 ? (
              <div style={styles.emptyBox}>No table seats generated yet.</div>
            ) : (
              <AdminSeatManager
                eventId={event.id}
                seats={tableSeats}
                ticketTypes={ticketTypes}
                currency={event.currency}
                mode="tables"
                applyTicketTypeAction={applySeatTicketTypeAction}
                deleteSelectedSeatsAction={deleteSelectedSeatsAction}
              />
            )}
          </div>
        </section>
      )}

      <section id="orders" style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>
              {isGeneralAdmission ? "Section 3" : "Section 4"}
            </p>
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
  value: ReactNode;
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
  children: ReactNode;
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
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  sectionHeader: { marginBottom: 16 },
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
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  statsGridCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 10,
    marginBottom: 12,
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
    wordBreak: "break-word",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  fourCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
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
  editTicketCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
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
  dangerSection: {
    padding: 18,
    borderRadius: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
};
