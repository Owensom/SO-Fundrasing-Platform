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
  if (!session?.user) redirect("/login");

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
  if (!session?.user) redirect("/login");

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
  if (!session?.user) redirect("/login");

  const eventId = String(formData.get("event_id") || "").trim();
  if (eventId) await deleteEventTicketTypes(eventId);

  redirect(`/admin/events/${eventId}?saved=tickets-cleared`);
}

async function generateSeatsAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

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
  if (!session?.user) redirect("/login");

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
  if (!session?.user) redirect("/login");

  const eventId = String(formData.get("event_id") || "").trim();
  if (eventId) await deleteEventSeats(eventId);

  redirect(`/admin/events/${eventId}?saved=seats-cleared`);
}

async function deleteEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

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
  if (!session?.user) redirect("/login");

  const event = await getEventById(params.id);
  if (!event) notFound();

  const ticketTypes = event.ticket_types || [];
  const seats = event.seats || [];
  const soldSeats = seats.filter((seat) => seat.status === "sold").length;
  const reservedSeats = seats.filter((seat) => seat.status === "reserved").length;
  const availableSeats = seats.filter((seat) => seat.status === "available").length;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
                Events & Tickets
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
                {event.title}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
                  {eventTypeLabel(event.event_type)}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-200">
                  {statusLabel(event.status)}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-200">
                  {event.currency}
                </span>
              </div>

              <p className="mt-4 text-sm text-slate-300">
                Public page: <span className="font-bold text-white">/e/{event.slug}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2 md:min-w-44">
              <Link
                href="/admin/events"
                className="rounded-2xl border border-white/15 px-4 py-3 text-center text-sm font-bold text-white hover:bg-white/10"
              >
                Back to events
              </Link>
              <Link
                href={`/e/${event.slug}`}
                className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-slate-200"
              >
                View public page
              </Link>
            </div>
          </div>
        </section>

        <nav className="sticky top-0 z-10 rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
          <div className="grid gap-2 sm:grid-cols-4">
            <a
              href="#overview"
              className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15"
            >
              Overview
            </a>
            <a
              href="#tickets"
              className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15"
            >
              Tickets
            </a>
            <a
              href="#seating"
              className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15"
            >
              Seating
            </a>
            <a
              href="#orders"
              className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/15"
            >
              Orders
            </a>
          </div>
        </nav>

        {searchParams?.saved && (
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            Saved successfully.
          </div>
        )}

        {searchParams?.error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            Please check the missing fields and try again.
          </div>
        )}

        <section id="overview" className="scroll-mt-28 space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              Section 1
            </p>
            <h2 className="mt-2 text-3xl font-black">Overview</h2>
            <p className="mt-2 text-sm text-slate-300">
              Edit the main event details, status and public page settings.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Ticket types
              </p>
              <p className="mt-2 text-3xl font-black">{ticketTypes.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Seats/tables
              </p>
              <p className="mt-2 text-3xl font-black">{seats.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Available
              </p>
              <p className="mt-2 text-3xl font-black">{availableSeats}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Sold / reserved
              </p>
              <p className="mt-2 text-3xl font-black">{soldSeats + reservedSeats}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <h3 className="text-2xl font-black">Event details</h3>

            <form action={updateEventAction} className="mt-6 space-y-4">
              <input type="hidden" name="id" value={event.id} />

              <label className="block">
                <span className="text-sm font-bold text-slate-200">Title</span>
                <input
                  name="title"
                  required
                  defaultValue={event.title}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-200">Slug</span>
                <input
                  name="slug"
                  required
                  defaultValue={event.slug}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-200">Description</span>
                <textarea
                  name="description"
                  rows={5}
                  defaultValue={event.description || ""}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-200">Image URL</span>
                  <input
                    name="image_url"
                    defaultValue={event.image_url || ""}
                    placeholder="https://..."
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-200">Location</span>
                  <input
                    name="location"
                    defaultValue={event.location || ""}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-200">Starts at</span>
                  <input
                    name="starts_at"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocal(event.starts_at)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-200">Ends at</span>
                  <input
                    name="ends_at"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocal(event.ends_at)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-bold text-slate-200">Currency</span>
                  <select
                    name="currency"
                    defaultValue={event.currency}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                  >
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-200">Type</span>
                  <select
                    name="event_type"
                    defaultValue={event.event_type}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                  >
                    <option value="general_admission">General admission</option>
                    <option value="reserved_seating">Reserved seating</option>
                    <option value="tables">Tables</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-200">Status</span>
                  <select
                    name="status"
                    defaultValue={event.status}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-amber-200"
              >
                Save event details
              </button>
            </form>
          </div>
        </section>

        <section id="tickets" className="scroll-mt-28 space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              Section 2
            </p>
            <h2 className="mt-2 text-3xl font-black">Tickets & Prices</h2>
            <p className="mt-2 text-sm text-slate-300">
              Add ticket types, prices and capacity. These are used for admission, seat prices and table seats.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
              <h3 className="text-2xl font-black">Add ticket type</h3>

              <form action={addTicketTypeAction} className="mt-6 space-y-4">
                <input type="hidden" name="event_id" value={event.id} />

                <input
                  name="name"
                  required
                  placeholder="Standard, VIP, Adult, Child..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                />

                <input
                  name="description"
                  placeholder="Optional description"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="10.00"
                    className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                  <input
                    name="capacity"
                    type="number"
                    min="0"
                    placeholder="100"
                    className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                  <input
                    name="sort_order"
                    type="number"
                    min="0"
                    defaultValue={ticketTypes.length}
                    className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-amber-300"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-slate-200"
                >
                  Add ticket type
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
              <h3 className="text-2xl font-black">Current ticket types</h3>

              <div className="mt-6 space-y-3">
                {ticketTypes.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center">
                    <p className="text-lg font-black">No ticket types yet</p>
                  </div>
                ) : (
                  ticketTypes.map((ticketType) => (
                    <div
                      key={ticketType.id}
                      className="rounded-2xl border border-white/10 bg-slate-900 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-black">{ticketType.name}</p>
                          {ticketType.description && (
                            <p className="mt-1 text-sm text-slate-400">
                              {ticketType.description}
                            </p>
                          )}
                        </div>
                        <p className="rounded-full bg-amber-300 px-3 py-1 text-sm font-black text-slate-950">
                          {event.currency} {moneyFromCents(ticketType.price)}
                        </p>
                      </div>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Capacity: {ticketType.capacity || "Unlimited"}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <form action={clearTicketTypesAction} className="mt-6">
                <input type="hidden" name="event_id" value={event.id} />
                <button
                  type="submit"
                  className="w-full rounded-2xl border border-red-400/30 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-500/10"
                >
                  Clear ticket types
                </button>
              </form>
            </div>
          </div>
        </section>

        <section id="seating" className="scroll-mt-28 space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              Section 3
            </p>
            <h2 className="mt-2 text-3xl font-black">Seating & Tables</h2>
            <p className="mt-2 text-sm text-slate-300">
              Generate rows, seat numbers or table seats for reserved seating events.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <form action={generateSeatsAction} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
              <input type="hidden" name="event_id" value={event.id} />
              <h3 className="text-2xl font-black">Rows and seat numbers</h3>

              <div className="mt-4 space-y-4">
                <select
                  name="ticket_type_id"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-300"
                >
                  <option value="">No linked ticket type</option>
                  {ticketTypes.map((ticketType) => (
                    <option key={ticketType.id} value={ticketType.id}>
                      {ticketType.name}
                    </option>
                  ))}
                </select>

                <input
                  name="section"
                  placeholder="Main hall, balcony..."
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    name="rows"
                    placeholder="A,B,C,D"
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                  <input
                    name="seats_per_row"
                    type="number"
                    min="1"
                    placeholder="12"
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-slate-200">
                  <input type="checkbox" name="clear_existing" value="yes" />
                  Clear existing seats before generating
                </label>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-amber-200"
                >
                  Generate row seats
                </button>
              </div>
            </form>

            <form action={generateTablesAction} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
              <input type="hidden" name="event_id" value={event.id} />
              <h3 className="text-2xl font-black">Tables with seats</h3>

              <div className="mt-4 space-y-4">
                <select
                  name="ticket_type_id"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-amber-300"
                >
                  <option value="">No linked ticket type</option>
                  {ticketTypes.map((ticketType) => (
                    <option key={ticketType.id} value={ticketType.id}>
                      {ticketType.name}
                    </option>
                  ))}
                </select>

                <div className="grid gap-4 md:grid-cols-2">
                  <input
                    name="table_count"
                    type="number"
                    min="1"
                    placeholder="20"
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                  <input
                    name="seats_per_table"
                    type="number"
                    min="1"
                    placeholder="10"
                    className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-amber-300"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm font-bold text-slate-200">
                  <input type="checkbox" name="clear_existing" value="yes" />
                  Clear existing seats before generating
                </label>

                <button
                  type="submit"
                  className="w-full rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 hover:bg-amber-200"
                >
                  Generate tables
                </button>
              </div>
            </form>
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h3 className="text-2xl font-black">Seats / table seats</h3>

              <form action={clearSeatsAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button
                  type="submit"
                  className="rounded-2xl border border-red-400/30 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-500/10"
                >
                  Clear seats/tables
                </button>
              </form>
            </div>

            <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
              {seats.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-lg font-black">No seats generated yet</p>
                </div>
              ) : (
                <div className="max-h-[520px] overflow-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Section</th>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Seat</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Customer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {seats.map((seat) => {
                        const ticketType = ticketTypes.find(
                          (item) => item.id === seat.ticket_type_id,
                        );

                        return (
                          <tr key={seat.id} className="bg-slate-950/40">
                            <td className="px-4 py-3 font-bold">
                              {ticketType?.name || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {seat.section || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {seat.row_label || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {seat.table_number || "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {seat.seat_number || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-200">
                                {seat.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-300">
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
        </section>

        <section id="orders" className="scroll-mt-28 space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
              Section 4
            </p>
            <h2 className="mt-2 text-3xl font-black">Orders</h2>
            <p className="mt-2 text-sm text-slate-300">
              Event orders will appear here once checkout is connected.
            </p>
          </div>

          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
            <p className="text-xl font-black">Checkout not connected yet</p>
            <p className="mt-2 text-sm text-slate-400">
              Next step: connect event ticket and seat purchases to Stripe.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-red-400/20 bg-red-500/10 p-6">
          <h2 className="text-xl font-black text-red-100">Danger zone</h2>

          <form action={deleteEventAction} className="mt-4">
            <input type="hidden" name="event_id" value={event.id} />
            <button
              type="submit"
              className="w-full rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white hover:bg-red-400"
            >
              Delete event
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
