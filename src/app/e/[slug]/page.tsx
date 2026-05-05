import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getEventBySlug } from "../../../../api/_lib/events-repo";
import PublicGeneralAdmissionSelector from "@/components/events/PublicGeneralAdmissionSelector";
import PublicReservedSeatSelector from "@/components/events/PublicReservedSeatSelector";
import PublicTableSelector from "@/components/events/PublicTableSelector";

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

  const menuOptions =
    event.ask_menu_choice === false
      ? []
      : (event.menu_options || [])
          .filter((option) => option.isActive !== false && option.is_active !== false)
          .sort(
            (a, b) =>
              Number(a.sortOrder ?? a.sort_order ?? 0) -
              Number(b.sortOrder ?? b.sort_order ?? 0),
          )
          .map((option) => String(option.name || option.title || "").trim())
          .filter((option) => option.length > 0);

  const tableSeatsWithNames = seats.map((seat) => ({
    ...seat,
    table_name: seat.table_number
      ? event.table_names_json?.[String(seat.table_number)] || null
      : null,
  }));

  const lowestTicketPrice =
    ticketTypes.length > 0
      ? Math.min(...ticketTypes.map((ticketType) => Number(ticketType.price || 0)))
      : 0;

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="relative min-h-[620px] overflow-hidden">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-300 via-orange-500 to-rose-600" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-950/35 to-[#07111f]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(22,131,248,0.28),transparent_36%)]" />

        <div className="relative z-10 mx-auto flex min-h-[620px] max-w-7xl flex-col px-4 py-6 md:px-6 md:py-8">
          <nav className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/c/${tenantSlug}`}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-xl shadow-black/20 transition hover:bg-slate-100"
            >
              ← Back to campaigns
            </Link>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/c/${tenantSlug}/terms`}
                className="inline-flex rounded-full border border-white/25 bg-black/20 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                Terms
              </Link>

              <Link
                href={`/c/${tenantSlug}/privacy`}
                className="inline-flex rounded-full border border-white/25 bg-black/20 px-4 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
              >
                Privacy
              </Link>
            </div>
          </nav>

          <div className="flex flex-1 items-end pb-10 pt-20">
            <div className="max-w-5xl">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-amber-300 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg">
                  {eventTypeLabel(event.event_type)}
                </span>

                <span className="rounded-full border border-white/20 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white backdrop-blur">
                  {event.currency}
                </span>

                {lowestTicketPrice > 0 && (
                  <span className="rounded-full bg-emerald-300 px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-950 shadow-lg">
                    From {event.currency} {moneyFromCents(lowestTicketPrice)}
                  </span>
                )}
              </div>

              <h1 className="mt-6 text-5xl font-black tracking-tight text-white drop-shadow-2xl md:text-8xl">
                {event.title}
              </h1>

              {event.description && (
                <p className="mt-6 max-w-3xl whitespace-pre-line text-lg font-medium leading-8 text-white/90 drop-shadow md:text-xl">
                  {event.description}
                </p>
              )}

              <div className="mt-8 grid max-w-4xl gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-white/20 bg-black/35 p-5 shadow-2xl backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                    Date & time
                  </p>
                  <p className="mt-2 text-lg font-black text-white">
                    {formatDate(event.starts_at)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/20 bg-black/35 p-5 shadow-2xl backdrop-blur">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                    Location
                  </p>
                  <p className="mt-2 text-lg font-black text-white">
                    {event.location || "Location to be confirmed"}
                  </p>
                </div>
              </div>

              <a
                href="#book"
                className="mt-8 inline-flex rounded-full bg-white px-6 py-4 text-base font-black text-slate-950 shadow-2xl shadow-black/30 transition hover:bg-amber-200"
              >
                Book tickets
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {searchParams?.checkout === "success" && (
          <div className="mb-6 rounded-3xl border border-emerald-300/30 bg-emerald-400/10 p-5 text-emerald-50 shadow-2xl">
            <p className="text-lg font-black">Payment successful</p>
            <p className="mt-1 text-sm text-emerald-100/80">
              Thank you. Your booking has been received.
            </p>
          </div>
        )}

        {searchParams?.checkout === "cancelled" && (
          <div className="mb-6 rounded-3xl border border-amber-300/30 bg-amber-300/10 p-5 text-amber-50 shadow-2xl">
            <p className="text-lg font-black">Checkout cancelled</p>
            <p className="mt-1 text-sm text-amber-100/80">
              Your order was not completed. You can choose again below.
            </p>
          </div>
        )}

        <section
          id="book"
          className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30 backdrop-blur md:p-6"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">
                Book now
              </p>
              <h2 className="mt-2 text-3xl font-black md:text-5xl">
                {event.event_type === "tables"
                  ? "Choose your table seats"
                  : event.event_type === "reserved_seating"
                    ? "Choose your seats"
                    : "Book tickets"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {event.event_type === "general_admission"
                  ? "Choose your tickets, add buyer details, then continue securely to checkout."
                  : "Select your seats, add guest details, then continue securely to checkout."}
              </p>
            </div>

            <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">
              Secure Stripe checkout
            </div>
          </div>

          {ticketTypes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/55 p-8 text-center">
              <p className="text-xl font-black">Ticket options have not been added yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Please check back soon.
              </p>
            </div>
          ) : event.event_type === "general_admission" ? (
            <PublicGeneralAdmissionSelector
              eventId={event.id}
              ticketTypes={ticketTypes}
              currency={event.currency}
            />
          ) : event.event_type === "tables" ? (
            seats.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/55 p-8 text-center">
                <p className="text-xl font-black">No seats available yet</p>
                <p className="mt-2 text-sm text-slate-400">
                  Seats may not have been released yet.
                </p>
              </div>
            ) : (
              <PublicTableSelector
                eventId={event.id}
                seats={tableSeatsWithNames}
                ticketTypes={ticketTypes}
                currency={event.currency}
                menuOptions={menuOptions}
              />
            )
          ) : seats.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/55 p-8 text-center">
              <p className="text-xl font-black">No seats available yet</p>
              <p className="mt-2 text-sm text-slate-400">
                Seats may not have been released yet.
              </p>
            </div>
          ) : (
            <PublicReservedSeatSelector
              eventId={event.id}
              seats={seats}
              ticketTypes={ticketTypes}
              currency={event.currency}
              menuOptions={menuOptions}
            />
          )}
        </section>
      </div>
    </main>
  );
}
