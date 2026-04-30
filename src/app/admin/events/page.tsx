import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  createEvent,
  deleteEvent,
  listEvents,
  slugifyEventTitle,
  type EventType,
} from "../../../api/_lib/events-repo";

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatDate(value: string | null) {
  if (!value) return "No date set";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Invalid date";
  }
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

async function createEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const headerStore = headers();
  const tenantSlug = getTenantSlugFromHeaders(headerStore);

  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const location = String(formData.get("location") || "").trim();
  const startsAt = String(formData.get("starts_at") || "").trim();
  const currency = String(formData.get("currency") || "GBP").trim() || "GBP";
  const eventType = String(
    formData.get("event_type") || "general_admission",
  ) as EventType;

  if (!title) {
    redirect("/admin/events?error=missing-title");
  }

  const baseSlug = slugifyEventTitle(title);
  const slug = `${baseSlug}-${Date.now().toString().slice(-5)}`;

  const event = await createEvent({
    tenantSlug,
    slug,
    title,
    description: description || null,
    location: location || null,
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    currency,
    eventType,
    status: "draft",
  });

  redirect(`/admin/events/${event.id}`);
}

async function deleteEventAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/login");

  const id = String(formData.get("id") || "").trim();

  if (id) {
    await deleteEvent(id);
  }

  redirect("/admin/events");
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const headerStore = headers();
  const tenantSlug = getTenantSlugFromHeaders(headerStore);
  const events = await listEvents(tenantSlug);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">
                Events & Tickets
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
                Create admission tickets, reserved seating events, lectures,
                cinema-style rows, theatre seating, or table-based fundraisers.
              </p>
            </div>

            <Link
              href="/admin"
              className="rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Back to admin
            </Link>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <h2 className="text-2xl font-black">Create event</h2>
            <p className="mt-2 text-sm text-slate-300">
              Start with the basics. Ticket types, seats and tables are managed
              on the next screen.
            </p>

            {searchParams?.error === "missing-title" && (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
                Please enter an event title.
              </div>
            )}

            <form action={createEventAction} className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-200">
                  Event title
                </span>
                <input
                  name="title"
                  required
                  placeholder="Charity dinner, theatre night, lecture..."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-amber-300"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-200">
                  Description
                </span>
                <textarea
                  name="description"
                  rows={4}
                  placeholder="Describe the event..."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-amber-300"
                />
              </label>

              <label className="block">
                <span className="text-sm font-bold text-slate-200">
                  Location
                </span>
                <input
                  name="location"
                  placeholder="Venue, hall, cinema, school..."
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-amber-300"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-slate-200">
                    Start date/time
                  </span>
                  <input
                    name="starts_at"
                    type="datetime-local"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 focus:border-amber-300"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-200">
                    Currency
                  </span>
                  <select
                    name="currency"
                    defaultValue="GBP"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 focus:border-amber-300"
                  >
                    <option value="GBP">GBP</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-bold text-slate-200">
                  Event type
                </span>
                <select
                  name="event_type"
                  defaultValue="general_admission"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none ring-0 focus:border-amber-300"
                >
                  <option value="general_admission">
                    General admission tickets
                  </option>
                  <option value="reserved_seating">
                    Seat numbers and rows
                  </option>
                  <option value="tables">Tables with seat numbers</option>
                </select>
              </label>

              <button
                type="submit"
                className="w-full rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-500/20 hover:bg-amber-200"
              >
                Create event
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black">Your events</h2>
                <p className="mt-2 text-sm text-slate-300">
                  Manage event setup, tickets, seats and public status.
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-slate-200">
                {events.length}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {events.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center">
                  <p className="text-lg font-black">No events yet</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Create your first admission, seating or table event.
                  </p>
                </div>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-3xl border border-white/10 bg-slate-900/80 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
                            {eventTypeLabel(event.event_type)}
                          </span>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-200">
                            {statusLabel(event.status)}
                          </span>
                        </div>

                        <h3 className="mt-3 text-xl font-black">
                          {event.title}
                        </h3>

                        <p className="mt-2 text-sm text-slate-400">
                          {formatDate(event.starts_at)}
                        </p>

                        {event.location && (
                          <p className="mt-1 text-sm text-slate-400">
                            {event.location}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-slate-500">
                          Public slug: /e/{event.slug}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 md:min-w-40">
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950 hover:bg-slate-200"
                        >
                          Manage
                        </Link>

                        <form action={deleteEventAction}>
                          <input type="hidden" name="id" value={event.id} />
                          <button
                            type="submit"
                            className="w-full rounded-2xl border border-red-400/30 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white/[0.04] p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Currency
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {event.currency}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.04] p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Created
                        </p>
                        <p className="mt-1 text-sm font-bold">
                          {formatDate(event.created_at)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/[0.04] p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Starting from
                        </p>
                        <p className="mt-1 text-lg font-black">
                          £{moneyFromCents(0)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
