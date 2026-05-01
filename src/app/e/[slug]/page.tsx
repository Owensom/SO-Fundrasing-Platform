import Link from "next/link";
import { notFound } from "next/navigation";
import PublicSeatSelector from "@/components/events/PublicSeatSelector";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventBySlug } from "../../../../api/_lib/events-repo";

type PageProps = {
  params: {
    slug: string;
  };
};

function formatDate(value: string | null) {
  if (!value) return "Date to be confirmed";

  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Date to be confirmed";
  }
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function eventTypeLabel(type: string) {
  if (type === "reserved_seating") return "Reserved seating";
  if (type === "tables") return "Table seating";
  return "General admission";
}

export default async function PublicEventPage({ params }: PageProps) {
  const tenantSlug = getTenantSlugFromHeaders();
  const event = await getEventBySlug(tenantSlug, params.slug);

  if (!event || event.status !== "published") {
    notFound();
  }

  const ticketTypes = event.ticket_types || [];
  const seats = event.seats || [];
  const availableSeats = seats.filter((seat) => seat.status === "available");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <Link
          href={`/c/${tenantSlug}`}
          className="inline-flex rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10"
        >
          ← Back to all campaigns
        </Link>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="h-72 w-full object-cover md:h-96"
            />
          ) : (
            <div className="flex h-72 items-center justify-center bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 md:h-96">
              <div className="px-6 text-center">
                <p className="text-sm font-black uppercase tracking-[0.35em] text-slate-950/70">
                  Event
                </p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
                  {event.title}
                </h1>
              </div>
            </div>
          )}

          <div className="p-6 md:p-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950">
                {eventTypeLabel(event.event_type)}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-200">
                {event.currency}
              </span>
            </div>

            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
              {event.title}
            </h1>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-900 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Date & time
                </p>
                <p className="mt-1 text-lg font-black">
                  {formatDate(event.starts_at)}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Location
                </p>
                <p className="mt-1 text-lg font-black">
                  {event.location || "Location to be confirmed"}
                </p>
              </div>
            </div>

            {event.description && (
              <p className="mt-6 max-w-3xl whitespace-pre-line text-base leading-7 text-slate-300">
                {event.description}
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">Tickets</h2>
            <p className="mt-2 text-sm text-slate-300">
              Choose your seats. Checkout will be connected in the next step.
            </p>

            <div className="mt-6 space-y-4">
              {ticketTypes.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center">
                  <p className="text-lg font-black">Tickets coming soon</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Ticket options have not been added yet.
                  </p>
                </div>
              ) : (
                ticketTypes.map((ticketType) => (
                  <div
                    key={ticketType.id}
                    className="rounded-3xl border border-white/10 bg-slate-900 p-5"
                  >
                    <h3 className="text-xl font-black">{ticketType.name}</h3>

                    {ticketType.description && (
                      <p className="mt-2 text-sm text-slate-400">
                        {ticketType.description}
                      </p>
                    )}

                    <p className="mt-3 text-2xl font-black text-amber-300">
                      {event.currency} {moneyFromCents(ticketType.price)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <h2 className="text-3xl font-black">
              {event.event_type === "tables" ? "Table seats" : "Choose seats"}
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              {event.event_type === "general_admission"
                ? "This event uses general admission tickets."
                : "Available seats are shown below."}
            </p>

            <div className="mt-6">
              {event.event_type === "general_admission" ? (
                <div className="rounded-3xl bg-slate-900 p-6">
                  <p className="text-lg font-black">No seat selection needed</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Guests only need to choose a ticket type and quantity.
                  </p>
                </div>
              ) : availableSeats.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 p-8 text-center">
                  <p className="text-lg font-black">No seats available</p>
                  <p className="mt-2 text-sm text-slate-400">
                    Seats may not have been released yet.
                  </p>
                </div>
              ) : (
                <PublicSeatSelector
                  eventType={event.event_type}
                  seats={seats}
                  ticketTypes={ticketTypes}
                  currency={event.currency}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
