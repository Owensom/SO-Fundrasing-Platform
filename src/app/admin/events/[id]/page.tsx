import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import ImageUploadField from "@/components/ImageUploadField";
import AdminSeatManager from "@/components/admin/events/AdminSeatManager";
import TableNamesEditor from "@/components/admin/events/TableNamesEditor";
import EventPrizeMenuSettings from "./EventPrizeMenuSettings";
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
  updateEventSeatsStatus,
  updateEventSeatsTicketType,
  updateEventTicketType,
  type EventMenuOption,
  type EventPrize,
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

function parseSeatingLayout(value: FormDataEntryValue | null): Record<string, number> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, rawValue]) => {
          const number = Number(rawValue);
          if (!Number.isFinite(number)) return null;
          return [String(key), Math.max(-20, Math.min(20, Math.floor(number)))];
        })
        .filter(Boolean) as [string, number][],
    );
  } catch {
    return {};
  }
}

function parseTableNames(value: FormDataEntryValue | null): Record<string, string> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, rawValue]) => [String(key), String(rawValue || "").trim()])
        .filter(([, name]) => name),
    );
  } catch {
    return {};
  }
}

function parsePrizeRowsFromForm(formData: FormData): EventPrize[] {
  const count = positiveInteger(formData.get("prize_count"), 0);

  return Array.from({ length: count }, (_, index) => {
    const position = positiveInteger(
      formData.get(`prize_position_${index}`),
      index + 1,
    );
    const title = String(formData.get(`prize_title_${index}`) || "").trim();
    const description = String(
      formData.get(`prize_description_${index}`) || "",
    ).trim();
    const isPublic =
      String(formData.get(`prize_public_${index}`) || "") === "true";

    return {
      id: `prize-${index + 1}`,
      position,
      title,
      name: title,
      description,
      isPublic,
      is_public: isPublic,
      sortOrder: index,
      sort_order: index,
    };
  })
    .filter((prize) => prize.title)
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
}

function parseMenuOptionsFromForm(formData: FormData): EventMenuOption[] {
  const count = positiveInteger(formData.get("menu_count"), 0);

  return Array.from({ length: count }, (_, index) => {
    const name = String(formData.get(`menu_name_${index}`) || "").trim();
    const description = String(
      formData.get(`menu_description_${index}`) || "",
    ).trim();
    const isActive =
      String(formData.get(`menu_active_${index}`) || "") === "true";

    return {
      id: `menu-${index + 1}`,
      name,
      title: name,
      description,
      isActive,
      is_active: isActive,
      sortOrder: index,
      sort_order: index,
    };
  }).filter((option) => option.name);
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

        for (let row = start; row <= end; row += 1) rows.push(String(row));
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

async function requireEventAccess(eventId: string) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const event = await getEventById(eventId);
  if (!event) notFound();

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (
    !tenantSlug ||
    event.tenant_slug !== tenantSlug ||
    !sessionTenantSlugs.includes(tenantSlug)
  ) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return event;
}
async function updateEventAction(formData: FormData) {
  "use server";

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

  const askDietaryRequirements =
    String(formData.get("ask_dietary_requirements") || "true") === "true";
  const askMenuChoice =
    String(formData.get("ask_menu_choice") || "true") === "true";

  if (!id || !title || !slug) {
    redirect(`/admin/events/${id}?error=missing-required#overview`);
  }

  const event = await requireEventAccess(id);

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
    prizesJson: event.prizes_json || [],
    menuOptions: event.menu_options || [],
    seatingLayoutJson: event.seating_layout_json || {},
    tableNamesJson: event.table_names_json || {},
    askDietaryRequirements,
    askMenuChoice,
  });

  redirect(`/admin/events/${id}?saved=event#overview`);
}

async function updatePrizesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) redirect("/admin/events?error=missing-event");

  const event = await requireEventAccess(eventId);

  await updateEvent(eventId, {
    prizesJson: parsePrizeRowsFromForm(formData),
    menuOptions: event.menu_options || [],
    seatingLayoutJson: event.seating_layout_json || {},
    tableNamesJson: event.table_names_json || {},
    askDietaryRequirements: event.ask_dietary_requirements,
    askMenuChoice: event.ask_menu_choice,
  });

  redirect(`/admin/events/${eventId}?saved=prizes#prizes`);
}

async function updateMenuOptionsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) redirect("/admin/events?error=missing-event");

  const event = await requireEventAccess(eventId);

  await updateEvent(eventId, {
    prizesJson: event.prizes_json || [],
    menuOptions: parseMenuOptionsFromForm(formData),
    seatingLayoutJson: event.seating_layout_json || {},
    tableNamesJson: event.table_names_json || {},
    askDietaryRequirements: event.ask_dietary_requirements,
    askMenuChoice: event.ask_menu_choice,
  });

  redirect(`/admin/events/${eventId}?saved=menu#menu`);
}

async function updateSeatingLayoutAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) redirect("/admin/events?error=missing-event");

  const event = await requireEventAccess(eventId);

  await updateEvent(eventId, {
    prizesJson: event.prizes_json || [],
    menuOptions: event.menu_options || [],
    seatingLayoutJson: parseSeatingLayout(formData.get("seating_layout_json")),
    tableNamesJson: event.table_names_json || {},
    askDietaryRequirements: event.ask_dietary_requirements,
    askMenuChoice: event.ask_menu_choice,
  });

  redirect(`/admin/events/${eventId}?saved=layout#row-seating`);
}

async function updateTableNamesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) redirect("/admin/events?error=missing-event");

  const event = await requireEventAccess(eventId);

  await updateEvent(eventId, {
    prizesJson: event.prizes_json || [],
    menuOptions: event.menu_options || [],
    seatingLayoutJson: event.seating_layout_json || {},
    tableNamesJson: parseTableNames(formData.get("table_names_json")),
    askDietaryRequirements: event.ask_dietary_requirements,
    askMenuChoice: event.ask_menu_choice,
  });

  redirect(`/admin/events/${eventId}?saved=table-names#table-seating`);
}

async function addTicketTypeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!eventId || !name) {
    redirect(`/admin/events/${eventId}?error=missing-ticket#tickets`);
  }

  await requireEventAccess(eventId);

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

  const eventId = String(formData.get("event_id") || "").trim();
  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();
  const name = String(formData.get("name") || "").trim();

  if (!eventId || !ticketTypeId || !name) {
    redirect(`/admin/events/${eventId}?error=missing-ticket#tickets`);
  }

  await requireEventAccess(eventId);

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

  const eventId = String(formData.get("event_id") || "").trim();
  const ticketTypeId = String(formData.get("ticket_type_id") || "").trim();

  if (eventId) await requireEventAccess(eventId);
  if (ticketTypeId) await deleteEventTicketType(ticketTypeId);

  redirect(`/admin/events/${eventId}?saved=ticket-deleted#tickets`);
}

async function clearTicketTypesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (eventId) {
    await requireEventAccess(eventId);
    await deleteEventTicketTypes(eventId);
  }

  redirect(`/admin/events/${eventId}?saved=tickets-cleared#tickets`);
}

async function applySeatTicketTypeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const rawTicketTypeId = String(formData.get("ticket_type_id") || "").trim();
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));

  if (!eventId || !rawTicketTypeId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-seat-selection#row-seating`);
  }

  await requireEventAccess(eventId);

  await updateEventSeatsTicketType({
    eventId,
    seatIds,
    ticketTypeId: rawTicketTypeId === "__normal__" ? null : rawTicketTypeId,
  });

  redirect(`/admin/events/${eventId}?saved=seat-marking#row-seating`);
}

async function updateSelectedSeatsStatusAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const status = String(formData.get("status") || "").trim() as
    | "available"
    | "blocked";
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));

  if (!eventId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-seat-selection#row-seating`);
  }

  if (status !== "available" && status !== "blocked") {
    redirect(`/admin/events/${eventId}?error=invalid-seat-status#row-seating`);
  }

  await requireEventAccess(eventId);

  await updateEventSeatsStatus({
    eventId,
    seatIds,
    status,
  });

  redirect(`/admin/events/${eventId}?saved=seat-status#row-seating`);
}

async function deleteSelectedSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));

  if (!eventId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-seat-selection#row-seating`);
  }

  await requireEventAccess(eventId);

  await deleteEventSeatsByIds({
    eventId,
    seatIds,
  });

  redirect(`/admin/events/${eventId}?saved=seats-deleted#row-seating`);
}

async function deleteSelectedRowsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const rowKeys = parseJsonStringArray(formData.get("row_keys"));

  if (!eventId || rowKeys.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-row-selection#row-seating`);
  }

  await requireEventAccess(eventId);

  await deleteEventRowsByKeys({
    eventId,
    rowKeys,
  });

  redirect(`/admin/events/${eventId}?saved=rows-deleted#row-seating`);
}
async function generateSeatsAction(formData: FormData) {
  "use server";

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

  await requireEventAccess(eventId);

  if (clearExisting) await deleteEventRowSeats(eventId);

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
      } catch {
        // Skip duplicate seats safely.
      }
    }
  }

  redirect(`/admin/events/${eventId}?saved=seats#row-seating`);
}

async function generateTablesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const tableCount = positiveInteger(formData.get("table_count"), 0);
  const seatsPerTable = positiveInteger(formData.get("seats_per_table"), 0);
  const ticketTypeId =
    String(formData.get("ticket_type_id") || "").trim() || null;
  const clearExisting = String(formData.get("clear_existing") || "") === "yes";

  if (!eventId || tableCount <= 0 || seatsPerTable <= 0) {
    redirect(`/admin/events/${eventId}?error=missing-tables#table-seating`);
  }

  await requireEventAccess(eventId);

  if (clearExisting) await deleteEventTableSeats(eventId);

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
      } catch {
        // Skip duplicate seats safely.
      }
    }
  }

  redirect(`/admin/events/${eventId}?saved=tables#table-seating`);
}

async function clearRowSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (eventId) {
    await requireEventAccess(eventId);
    await deleteEventRowSeats(eventId);
  }

  redirect(`/admin/events/${eventId}?saved=row-seats-cleared#row-seating`);
}

async function clearTableSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (eventId) {
    await requireEventAccess(eventId);
    await deleteEventTableSeats(eventId);
  }

  redirect(`/admin/events/${eventId}?saved=table-seats-cleared#table-seating`);
}

async function deleteEventAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (eventId) {
    await requireEventAccess(eventId);
    await deleteEvent(eventId);
  }

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

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (
    !tenantSlug ||
    event.tenant_slug !== tenantSlug ||
    !sessionTenantSlugs.includes(tenantSlug)
  ) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const ticketTypes = event.ticket_types || [];
  const seats = event.seats || [];

  const isGeneralAdmission = event.event_type === "general_admission";
  const isReservedSeating = event.event_type === "reserved_seating";
  const isTables = event.event_type === "tables";

  const rowSeats = seats.filter((seat) => seat.row_label && !seat.table_number);
  const tableSeats = seats.filter((seat) => seat.table_number);
  const visibleSeats = isReservedSeating ? rowSeats : isTables ? tableSeats : seats;

  const soldSeats = visibleSeats.filter((seat) => seat.status === "sold").length;
  const reservedSeats = visibleSeats.filter((seat) => seat.status === "reserved").length;
  const blockedSeats = visibleSeats.filter((seat) => seat.status === "blocked").length;
  const availableSeats = visibleSeats.filter((seat) => seat.status === "available").length;

  const uniqueTableNumbers = Array.from(
    new Set(tableSeats.map((seat) => String(seat.table_number || "").trim()).filter(Boolean)),
  ).sort((a, b) => {
    const aNumber = Number(a);
    const bNumber = Number(b);
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
    return a.localeCompare(b);
  });

  const tableNamesFromExistingTables = Object.fromEntries(
    uniqueTableNumbers.map((tableNumber) => [
      tableNumber,
      event.table_names_json?.[tableNumber] || "",
    ]),
  );

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
        <a href="#prizes" style={styles.tab}>Prizes</a>
        <a href="#menu" style={styles.tab}>Menu</a>
        {isReservedSeating && <a href="#row-seating" style={styles.tab}>Row Seating</a>}
        {isTables && <a href="#table-seating" style={styles.tab}>Table Seating</a>}
        <a href="#orders" style={styles.tab}>Orders</a>
      </nav>

      {searchParams?.saved && <div style={styles.successBox}>Saved successfully.</div>}

      {searchParams?.error && (
        <div style={styles.errorBox}>
          Please check the missing fields and try again.
        </div>
      )}
            <section id="overview" style={styles.section}>
        <div style={styles.sectionHeader}>
          <p style={styles.sectionEyebrow}>Section 1</p>
          <h2 style={styles.sectionTitle}>Overview</h2>
          <p style={styles.sectionText}>
            Choose the event type first. The admin page only shows the sections
            needed for that type.
          </p>
        </div>

        <div style={styles.statsGrid}>
          <SummaryCard label="Ticket types" value={ticketTypes.length} />
          <SummaryCard label="Prizes" value={(event.prizes_json || []).length} />
          <SummaryCard label="Menu options" value={(event.menu_options || []).length} />
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
                <input name="location" defaultValue={event.location || ""} style={styles.input} />
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

            <div style={styles.twoCol}>
              <Field label="Ask for dietary requirements">
                <select
                  name="ask_dietary_requirements"
                  defaultValue={event.ask_dietary_requirements ? "true" : "false"}
                  style={styles.input}
                >
                  <option value="true">Yes, ask buyers/guests</option>
                  <option value="false">No, hide this field</option>
                </select>
              </Field>

              <Field label="Ask for menu choice">
                <select
                  name="ask_menu_choice"
                  defaultValue={event.ask_menu_choice ? "true" : "false"}
                  style={styles.input}
                >
                  <option value="true">Yes, ask buyers/guests</option>
                  <option value="false">No, hide this field</option>
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
          <p style={styles.sectionEyebrow}>Section 2</p>
          <h2 style={styles.sectionTitle}>Tickets & Prices</h2>
          <p style={styles.sectionText}>
            Add public ticket choices. Seat Manager is for special, complimentary,
            VIP, or blocked seats.
          </p>
        </div>

        <div style={styles.ticketLayout}>
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
                  <input name="price" type="number" step="0.01" min="0" style={styles.input} />
                </Field>

                <Field label="Ticket limit">
                  <input
                    name="capacity"
                    type="number"
                    min="0"
                    placeholder="Leave blank"
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
