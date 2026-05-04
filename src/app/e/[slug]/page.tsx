import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventBySlug } from "../../../../api/_lib/events-repo";
import PublicSeatSelector from "@/components/events/PublicSeatSelector";

type PageProps = {
  params: {
    slug: string;
  };
  searchParams?: {
    checkout?: string;
    session_id?: string;
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

export default async function PublicEventPage({
  params,
  searchParams,
}: PageProps) {
  const tenantSlug = await getTenantSlugFromHeaders();
  const event = await getEventBySlug(tenantSlug, params.slug);

  if (!event || event.status !== "published") {
    notFound();
  }

  const ticketTypes = (event.ticket_types || []).filter(
    (ticketType) => ticketType.is_active,
  );

  const seats = event.seats || [];

  const menuOptions = (event.menu_options || [])
    .filter((option) => option.isActive !== false && option.is_active !== false)
    .sort(
      (a, b) =>
        Number(a.sortOrder ?? a.sort_order ?? 0) -
        Number(b.sortOrder ?? b.sort_order ?? 0),
    )
    .map((option) => String(option.name || option.title || "").trim())
    .filter((option) => option.length > 0);

  const publicPrizes = (event.prizes_json || [])
    .filter((prize) => prize.isPublic !== false && prize.is_public !== false)
    .sort(
      (a, b) =>
        Number(a.position || a.sortOrder || a.sort_order || 0) -
        Number(b.position || b.sortOrder || b.sort_order || 0),
    );

  const lowestTicketPrice =
    ticketTypes.length > 0
      ? Math.min(...ticketTypes.map((ticketType) => Number(ticketType.price || 0)))
      : 0;

  const availableSeats = seats.filter((seat) => seat.status === "available").length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <section className="rounded-[1.75rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-5">
          <nav className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/c/${tenantSlug}`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              ← Back to campaigns
            </Link>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/c/${tenantSlug}/terms`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Terms
              </Link>

              <Link
                href={`/c/${tenantSlug}/privacy`}
                className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Privacy
              </Link>
            </div>
          </nav>

          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="h-[240px] w-full rounded-2xl object-cover md:h-[360px]"
            />
          ) : (
            <div className="flex h-[240px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-orange-300 to-rose-300 text-6xl md:h-[360px]">
              🎫
            </div>
          )}

          <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
            {event.title}
          </h1>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="font-black">
              Event type: {eventTypeLabel(event.event_type)}
            </p>

            {lowestTicketPrice > 0 && (
              <p className="mt-2 font-black">
                Tickets from: {event.currency} {moneyFromCents(lowestTicketPrice)}
              </p>
            )}

            <p className="mt-2 font-black">Date: {formatDate(event.starts_at)}</p>
            <p className="mt-2 font-black">
              Location: {event.location || "Location to be confirmed"}
            </p>

            {event.event_type !== "general_admission" && (
              <p className="mt-2 font-black">Available now: {availableSeats}</p>
            )}

            {event.description && (
              <p className="mt-4 whitespace-pre-line text-sm font-semibold leading-6 text-slate-600">
                {event.description}
              </p>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-black leading-6 text-orange-900">
            This event is run by the organiser. The platform provides software only
            and is not responsible for the operation of this event. The organiser is
            responsible for ensuring compliance with all applicable laws.
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <h2 className="text-2xl font-black text-orange-900">Tickets</h2>

              <div className="mt-4 space-y-3">
                {ticketTypes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-orange-200 bg-white p-4 text-sm font-bold text-slate-500">
                    Ticket options have not been added yet.
                  </div>
                ) : (
                  ticketTypes.map((ticketType) => (
                    <div
                      key={ticketType.id}
                      className="rounded-xl border border-orange-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black text-slate-950">
                            {ticketType.name}
                          </h3>
                          {ticketType.description && (
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {ticketType.description}
                            </p>
                          )}
                        </div>

                        <p className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-sm font-black text-orange-900">
                          {event.currency} {moneyFromCents(ticketType.price)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <h2 className="text-2xl font-black text-orange-900">Prizes</h2>

              <div className="mt-4 space-y-3">
                {publicPrizes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-orange-200 bg-white p-4 text-sm font-bold text-slate-500">
                    Prize details will be announced soon.
                  </div>
                ) : (
                  publicPrizes.map((prize, index) => (
                    <div
                      key={`${prize.id || "prize"}-${index}`}
                      className="rounded-xl border border-orange-200 bg-white p-4"
                    >
                      <p className="text-xs font-black uppercase tracking-wide text-orange-700">
                        Prize {prize.position || index + 1}
                      </p>
                      <h3 className="mt-1 font-black text-slate-950">
                        {prize.title || prize.name}
                      </h3>
                      {prize.description && (
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          {prize.description}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <h2 className="text-2xl font-black text-orange-900">Menu</h2>

              <div className="mt-4 space-y-3">
                {menuOptions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-orange-200 bg-white p-4 text-sm font-bold text-slate-500">
                    Menu choices can be added during checkout if required.
                  </div>
                ) : (
                  menuOptions.map((option) => (
                    <div
                      key={option}
                      className="rounded-xl border border-orange-200 bg-white p-4 font-bold text-slate-800"
                    >
                      {option}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {searchParams?.checkout === "success" && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
              <p className="text-lg font-black">Payment successful</p>
              <p className="mt-1 text-sm font-semibold">
                Thank you. Your booking has been received.
              </p>
            </div>
          )}

          {searchParams?.checkout === "cancelled" && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <p className="text-lg font-black">Checkout cancelled</p>
              <p className="mt-1 text-sm font-semibold">
                Your order was not completed. You can choose again below.
              </p>
            </div>
          )}

          <section
            id="book"
            className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm md:p-6"
          >
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  {event.event_type === "tables"
                    ? "Choose your table seats"
                    : event.event_type === "reserved_seating"
                      ? "Choose your seats"
                      : "Book tickets"}
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                  {event.event_type === "general_admission"
                    ? "This event uses general admission tickets."
                    : "Select your seats, add guest details, then continue securely to checkout."}
                </p>
              </div>

              <div className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                Secure Stripe checkout
              </div>
            </div>

            {event.event_type === "general_admission" ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-xl font-black">
                  General admission checkout coming soon
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Ticket selection is currently enabled for reserved seating and
                  table seating.
                </p>
              </div>
            ) : seats.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-xl font-black">No seats available yet</p>
                <p className="mt-2 text-sm text-slate-500">
                  Seats may not have been released yet.
                </p>
              </div>
            ) : (
              <PublicSeatSelector
                eventId={event.id}
                eventType={event.event_type}
                seats={seats}
                ticketTypes={ticketTypes}
                currency={event.currency}
                menuOptions={menuOptions}
              />
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
