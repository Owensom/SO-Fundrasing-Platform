import { randomInt } from "crypto";
import type { CSSProperties, ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import ImageUploadField from "@/components/ImageUploadField";
import AdminSeatManager from "@/components/admin/events/AdminSeatManager";
import TableNamesEditor from "@/components/admin/events/TableNamesEditor";
import EventPrizeMenuSettings from "./EventPrizeMenuSettings";
import EventWinnerDrawPanel from "./EventWinnerDrawPanel";
import {
  clearEventWinners,
  createEventSeat,
  createEventTicketType,
  createEventWinner,
  deleteEvent,
  deleteEventRowsByKeys,
  deleteEventRowSeats,
  deleteEventSeatsByIds,
  deleteEventTableSeats,
  deleteEventTicketType,
  deleteEventTicketTypes,
  deleteEventWinner,
  getEligibleEventDrawCandidates,
  getEventById,
  listEventWinners,
  updateEvent,
  updateEventSeatsMetadata,
  updateEventSeatsStatus,
  updateEventSeatsTicketType,
  updateEventTicketType,
  type EventDrawCandidate,
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

type ParsedPrizeSelection = {
  id: string;
  title: string;
  position: number | null;
};

type TableShape = "round" | "square" | "rectangle";

const TABLE_SHAPE_KEY = "__table_shape";

function cleanTableShape(value: FormDataEntryValue | string | null): TableShape {
  const clean = String(value || "").trim();

  if (clean === "square" || clean === "rectangle" || clean === "round") {
    return clean;
  }

  return "round";
}

function getTableShape(tableNamesJson: Record<string, string> | null | undefined) {
  return cleanTableShape(tableNamesJson?.[TABLE_SHAPE_KEY] || "round");
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

function parseSeatingLayout(
  value: FormDataEntryValue | null,
): Record<string, number> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

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

function parseTableNames(
  value: FormDataEntryValue | null,
): Record<string, string> {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

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

function parsePrizeSelection(
  value: FormDataEntryValue | null,
): ParsedPrizeSelection | null {
  try {
    const parsed = JSON.parse(String(value || ""));
    const id = String(parsed?.id || "").trim();
    const title = String(parsed?.title || "").trim();
    const positionNumber = Number(parsed?.position);

    if (!id || !title) return null;

    return {
      id,
      title,
      position:
        Number.isFinite(positionNumber) && positionNumber > 0
          ? Math.floor(positionNumber)
          : null,
    };
  } catch {
    return null;
  }
}

function chooseRandomCandidate(
  candidates: EventDrawCandidate[],
): EventDrawCandidate | null {
  if (candidates.length === 0) return null;
  return candidates[randomInt(candidates.length)] || null;
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

  redirect(`/admin/events/${eventId}?saved=prizes#prizes-menu`);
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

  redirect(`/admin/events/${eventId}?saved=menu#prizes-menu`);
}

async function updateSeatingLayoutAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() === "table-seating"
      ? "table-seating"
      : "row-seating";

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

  redirect(`/admin/events/${eventId}?saved=layout#${returnAnchor}`);
}

async function updateTableNamesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) redirect("/admin/events?error=missing-event");

  const event = await requireEventAccess(eventId);

  const existingTableNames = event.table_names_json || {};
  const parsedTableNames = parseTableNames(formData.get("table_names_json"));

  await updateEvent(eventId, {
    prizesJson: event.prizes_json || [],
    menuOptions: event.menu_options || [],
    seatingLayoutJson: event.seating_layout_json || {},
    tableNamesJson: {
      ...existingTableNames,
      ...parsedTableNames,
      [TABLE_SHAPE_KEY]: existingTableNames[TABLE_SHAPE_KEY] || "round",
    },
    askDietaryRequirements: event.ask_dietary_requirements,
    askMenuChoice: event.ask_menu_choice,
  });

  redirect(`/admin/events/${eventId}?saved=table-names#table-seating`);
}

async function updateTableShapeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  if (!eventId) redirect("/admin/events?error=missing-event");

  const event = await requireEventAccess(eventId);
  const tableShape = cleanTableShape(formData.get("table_shape"));

  await updateEvent(eventId, {
    prizesJson: event.prizes_json || [],
    menuOptions: event.menu_options || [],
    seatingLayoutJson: event.seating_layout_json || {},
    tableNamesJson: {
      ...(event.table_names_json || {}),
      [TABLE_SHAPE_KEY]: tableShape,
    },
    askDietaryRequirements: event.ask_dietary_requirements,
    askMenuChoice: event.ask_menu_choice,
  });

  redirect(`/admin/events/${eventId}?saved=table-shape#table-seating`);
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
    sortOrder: positiveInteger(formData.get("display_order"), 0),
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
    sortOrder: positiveInteger(formData.get("display_order"), 0),
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
async function generateRowsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (!eventId) {
    redirect("/admin/events?error=missing-event");
  }

  await requireEventAccess(eventId);

  const section = String(formData.get("section") || "").trim() || null;

  const startRow = positiveInteger(formData.get("start_row"), 1);
  const endRow = positiveInteger(formData.get("end_row"), startRow);

  const seatsPerRow = positiveInteger(formData.get("seats_per_row"), 0);

  const aisleAfterRaw = String(formData.get("aisle_after") || "").trim();

  const aisleAfter =
    aisleAfterRaw.length > 0
      ? positiveInteger(aisleAfterRaw, 0)
      : null;

  if (seatsPerRow <= 0 || endRow < startRow) {
    redirect(`/admin/events/${eventId}?error=invalid-rows#row-seating`);
  }

  for (let row = startRow; row <= endRow; row += 1) {
    for (let seat = 1; seat <= seatsPerRow; seat += 1) {
      await createEventSeat({
        eventId,
        section,
        rowLabel: String(row),
        seatNumber: String(seat),
        tableNumber: null,
        aisleAfter:
          aisleAfter && seat === aisleAfter ? aisleAfter : null,
      });
    }
  }

  redirect(`/admin/events/${eventId}?saved=rows#row-seating`);
}

async function generateTablesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (!eventId) {
    redirect("/admin/events?error=missing-event");
  }

  await requireEventAccess(eventId);

  const startTable = positiveInteger(formData.get("start_table"), 1);

  const endTable = positiveInteger(
    formData.get("end_table"),
    startTable,
  );

  const seatsPerTable = positiveInteger(
    formData.get("seats_per_table"),
    0,
  );

  if (seatsPerTable <= 0 || endTable < startTable) {
    redirect(`/admin/events/${eventId}?error=invalid-tables#table-seating`);
  }

  for (let table = startTable; table <= endTable; table += 1) {
    for (let seat = 1; seat <= seatsPerTable; seat += 1) {
      await createEventSeat({
        eventId,
        section: null,
        rowLabel: null,
        seatNumber: String(seat),
        tableNumber: String(table),
        aisleAfter: null,
      });
    }
  }

  redirect(`/admin/events/${eventId}?saved=tables#table-seating`);
}

async function updateSeatTicketTypeAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  const seatIds = parseIdArray(formData.get("seat_ids"));

  const ticketTypeId = String(
    formData.get("ticket_type_id") || "",
  ).trim();

  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() ||
    "row-seating";

  if (!eventId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=no-seats#${returnAnchor}`);
  }

  await requireEventAccess(eventId);

  await updateEventSeatsTicketType(
    seatIds,
    ticketTypeId === "__normal__" ? null : ticketTypeId,
  );

  redirect(`/admin/events/${eventId}?saved=seat-ticket#${returnAnchor}`);
}

async function updateSeatStatusAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  const seatIds = parseIdArray(formData.get("seat_ids"));

  const status = String(formData.get("status") || "").trim() as
    | "available"
    | "blocked";

  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() ||
    "row-seating";

  if (!eventId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=no-seats#${returnAnchor}`);
  }

  await requireEventAccess(eventId);

  await updateEventSeatsStatus(seatIds, status);

  redirect(`/admin/events/${eventId}?saved=seat-status#${returnAnchor}`);
}

async function updateSeatMetadataAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  const seatIds = parseIdArray(formData.get("seat_ids"));

  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() ||
    "row-seating";

  if (!eventId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=no-seats#${returnAnchor}`);
  }

  await requireEventAccess(eventId);

  await updateEventSeatsMetadata(seatIds, {
    seatPurpose:
      String(formData.get("seat_purpose") || "").trim() || null,

    adminLabel:
      String(formData.get("admin_label") || "").trim() || null,

    adminNote:
      String(formData.get("admin_note") || "").trim() || null,

    guestName:
      String(formData.get("guest_name") || "").trim() || null,

    guestEmail:
      String(formData.get("guest_email") || "").trim() || null,

    dietaryRequirements:
      String(formData.get("dietary_requirements") || "").trim() ||
      null,

    menuChoice:
      String(formData.get("menu_choice") || "").trim() || null,
  });

  redirect(`/admin/events/${eventId}?saved=seat-meta#${returnAnchor}`);
}

async function deleteSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  const seatIds = parseIdArray(formData.get("seat_ids"));

  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() ||
    "row-seating";

  if (!eventId || seatIds.length === 0) {
    redirect(`/admin/events/${eventId}?error=no-seats#${returnAnchor}`);
  }

  await requireEventAccess(eventId);

  await deleteEventSeatsByIds(seatIds);

  redirect(`/admin/events/${eventId}?saved=seats-deleted#${returnAnchor}`);
}

async function deleteRowsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  const rowKeys = parseStringArray(formData.get("row_keys"));

  if (!eventId || rowKeys.length === 0) {
    redirect(`/admin/events/${eventId}?error=no-rows#row-seating`);
  }

  await requireEventAccess(eventId);

  await deleteEventRowsByKeys(eventId, rowKeys);

  redirect(`/admin/events/${eventId}?saved=rows-deleted#row-seating`);
}

async function clearSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (!eventId) {
    redirect("/admin/events?error=missing-event");
  }

  await requireEventAccess(eventId);

  await deleteAllEventSeats(eventId);

  redirect(`/admin/events/${eventId}?saved=all-seats-cleared#seat-tools`);
}

export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEventById(id);

  if (!event) {
    notFound();
  }

  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = getTenantSlugFromHeaders();

  if (
    tenantSlug &&
    !session.user.tenantSlugs?.includes(tenantSlug)
  ) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const ticketTypes = await listEventTicketTypes(id);
  const seats = await listEventSeats(id);
  const winners = await listEventWinners(id);

  const soldCount = seats.filter(
    (seat) => seat.status === "sold",
  ).length;

  const reservedCount = seats.filter(
    (seat) => seat.status === "reserved",
  ).length;

  const blockedCount = seats.filter(
    (seat) => seat.status === "blocked",
  ).length;

  const availableCount = seats.filter(
    (seat) => seat.status === "available",
  ).length;

  const rowSeats = seats.filter((seat) => !seat.table_number);

  const tableSeats = seats.filter((seat) => seat.table_number);

  const currency = event.currency || "GBP";

  const prizes = Array.isArray(event.prizes_json)
    ? event.prizes_json
    : [];

  const menuOptions = Array.isArray(event.menu_options)
    ? event.menu_options
    : [];

  const seatingLayout =
    event.seating_layout_json &&
    typeof event.seating_layout_json === "object"
      ? event.seating_layout_json
      : {};

  const tableNames =
    event.table_names_json &&
    typeof event.table_names_json === "object"
      ? event.table_names_json
      : {};

  const publicUrl = `/e/${event.slug}`;
    return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <p style={styles.eyebrow}>Events & Tickets</p>
          <h1 style={styles.title}>{event.title}</h1>

          <div style={styles.badgeRow}>
            <span style={styles.goldBadge}>{eventTypeLabel(event.event_type)}</span>
            <span style={styles.darkBadge}>{statusLabel(event.status)}</span>
            <span style={styles.darkBadge}>{currency}</span>
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
          <a href="/admin/events" style={styles.secondaryButton}>
            Back to events
          </a>
          <a href={publicUrl} style={styles.primaryLink}>
            View public page
          </a>
        </div>
      </section>

      <nav style={styles.tabs}>
        <a href="#overview" style={styles.tab}>Overview</a>
        <a href="#tickets" style={styles.tab}>Tickets & Prices</a>
        <a href="#prizes-menu" style={styles.tab}>Prizes & Menu</a>
        <a href="#winner-draw" style={styles.tab}>Winner Draw</a>
        {event.event_type === "reserved_seating" && (
          <a href="#row-seating" style={styles.tab}>Row Seating</a>
        )}
        {event.event_type === "tables" && (
          <a href="#table-seating" style={styles.tab}>Table Seating</a>
        )}
        <a href="#danger-zone" style={styles.tabDanger}>Danger Zone</a>
      </nav>

      <section id="overview" style={styles.section}>
        <h2 style={styles.sectionTitle}>Overview</h2>

        <div style={styles.statsGrid}>
          <SummaryCard label="Ticket types" value={ticketTypes.length} />
          <SummaryCard label="Prizes" value={prizes.length} />
          <SummaryCard label="Menu options" value={menuOptions.length} />
          <SummaryCard label="Winners" value={winners.length} />
          <SummaryCard label="Available" value={availableCount} />
          <SummaryCard label="Reserved" value={reservedCount} />
          <SummaryCard label="Sold" value={soldCount} />
          <SummaryCard label="Blocked" value={blockedCount} />
        </div>

        <form action={updateEventAction} style={styles.panel}>
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
              <select name="currency" defaultValue={currency} style={styles.input}>
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
      </section>

      <section id="tickets" style={styles.section}>
        <h2 style={styles.sectionTitle}>Tickets & Prices</h2>

        <div style={styles.ticketLayout}>
          <form action={addTicketTypeAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <h3 style={styles.panelTitle}>Add ticket type</h3>

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
                <input name="capacity" type="number" min="0" style={styles.input} />
              </Field>

              <Field label="Display order">
                <input
                  name="display_order"
                  type="number"
                  min="0"
                  defaultValue={ticketTypes.length}
                  style={styles.input}
                />
                <p style={styles.helperText}>Lower numbers appear first.</p>
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

          <div style={styles.panel}>
            <h3 style={styles.panelTitle}>Current ticket types</h3>

            {ticketTypes.length === 0 ? (
              <div style={styles.emptyBox}>No ticket types yet.</div>
            ) : (
              ticketTypes.map((ticketType) => (
                <div key={ticketType.id} style={styles.editTicketCard}>
                  <form action={updateTicketTypeAction} style={styles.form}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="ticket_type_id" value={ticketType.id} />

                    <div style={styles.twoCol}>
                      <Field label="Name">
                        <input name="name" required defaultValue={ticketType.name} style={styles.input} />
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

                      <Field label="Limit">
                        <input
                          name="capacity"
                          type="number"
                          min="0"
                          defaultValue={ticketType.capacity || ""}
                          style={styles.input}
                        />
                      </Field>

                      <Field label="Display order">
                        <input
                          name="display_order"
                          type="number"
                          min="0"
                          defaultValue={ticketType.sort_order}
                          style={styles.input}
                        />
                        <p style={styles.helperText}>Lower numbers appear first.</p>
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

                    <button type="submit" style={styles.primaryButton}>Save ticket</button>
                  </form>

                  <form action={deleteTicketTypeAction}>
                    <input type="hidden" name="event_id" value={event.id} />
                    <input type="hidden" name="ticket_type_id" value={ticketType.id} />
                    <button type="submit" style={styles.dangerOutlineButton}>Delete</button>
                  </form>
                </div>
              ))
            )}

            <form action={clearTicketTypesAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={styles.dangerOutlineButton}>
                Clear all ticket types
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="prizes-menu" style={styles.section}>
        <h2 style={styles.sectionTitle}>Prizes & Menu</h2>
        <EventPrizeMenuSettings
          eventId={event.id}
          initialPrizes={prizes}
          initialMenuOptions={menuOptions}
          updatePrizesAction={updatePrizesAction}
          updateMenuOptionsAction={updateMenuOptionsAction}
        />
      </section>

      <section id="winner-draw" style={styles.section}>
        <h2 style={styles.sectionTitle}>Winner Draw</h2>
        <EventWinnerDrawPanel
          eventId={event.id}
          eventType={event.event_type}
          prizes={prizes}
          winners={winners}
          drawWinnerAction={runWinnerDrawAction}
          deleteWinnerAction={deleteWinnerAction}
          clearWinnersAction={clearWinnersAction}
        />
      </section>

      {event.event_type === "reserved_seating" && (
        <section id="row-seating" style={styles.section}>
          <h2 style={styles.sectionTitle}>Row Seating</h2>

          <form action={generateRowsAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <div style={styles.threeCol}>
              <Field label="Section">
                <input name="section" placeholder="Main, Balcony, VIP..." style={styles.input} />
              </Field>

              <Field label="Start row">
                <input name="start_row" type="number" min="1" defaultValue="1" style={styles.input} />
              </Field>

              <Field label="End row">
                <input name="end_row" type="number" min="1" defaultValue="1" style={styles.input} />
              </Field>
            </div>

            <div style={styles.twoCol}>
              <Field label="Seats per row">
                <input name="seats_per_row" type="number" min="1" style={styles.input} />
              </Field>

              <Field label="Aisle after seat">
                <input name="aisle_after" type="number" min="1" style={styles.input} />
              </Field>
            </div>

            <button type="submit" style={styles.primaryButton}>Generate row seats</button>
          </form>

          <AdminSeatManager
            eventId={event.id}
            seats={rowSeats}
            ticketTypes={ticketTypes}
            currency={currency}
            mode="rows"
            applyTicketTypeAction={updateSeatTicketTypeAction}
            updateSelectedSeatsMetadataAction={updateSeatMetadataAction}
            updateSelectedSeatsStatusAction={updateSeatStatusAction}
            updateSeatingLayoutAction={updateSeatingLayoutAction}
            deleteSelectedSeatsAction={deleteSeatsAction}
            deleteSelectedRowsAction={deleteRowsAction}
            initialSeatingLayout={seatingLayout}
          />
        </section>
      )}

      {event.event_type === "tables" && (
        <section id="table-seating" style={styles.section}>
          <h2 style={styles.sectionTitle}>Table Seating</h2>

          <form action={generateTablesAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <div style={styles.threeCol}>
              <Field label="Start table">
                <input name="start_table" type="number" min="1" defaultValue="1" style={styles.input} />
              </Field>

              <Field label="End table">
                <input name="end_table" type="number" min="1" defaultValue="1" style={styles.input} />
              </Field>

              <Field label="Seats per table">
                <input name="seats_per_table" type="number" min="1" style={styles.input} />
              </Field>
            </div>

            <button type="submit" style={styles.primaryButton}>Generate table seats</button>
          </form>

          <form action={updateTableShapeAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <Field label="Public table shape">
              <select name="table_shape" defaultValue={getTableShape(tableNames)} style={styles.input}>
                <option value="round">Round</option>
                <option value="square">Square</option>
                <option value="rectangle">Rectangle</option>
              </select>
            </Field>

            <button type="submit" style={styles.primaryButton}>Save table shape</button>
          </form>

          <form action={updateTableNamesAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <TableNamesEditor
              tableNumbers={Array.from(new Set(tableSeats.map((seat) => String(seat.table_number || "")).filter(Boolean)))}
              initialTableNames={tableNames}
            />

            <button type="submit" style={styles.primaryButton}>Save table names</button>
          </form>

          <AdminSeatManager
            eventId={event.id}
            seats={tableSeats}
            ticketTypes={ticketTypes}
            currency={currency}
            mode="tables"
            applyTicketTypeAction={updateSeatTicketTypeAction}
            updateSelectedSeatsMetadataAction={updateSeatMetadataAction}
            updateSelectedSeatsStatusAction={updateSeatStatusAction}
            deleteSelectedSeatsAction={deleteSeatsAction}
            initialSeatingLayout={seatingLayout}
            tableNames={tableNames}
          />
        </section>
      )}

      <section id="danger-zone" style={styles.section}>
        <h2 style={styles.sectionTitle}>Danger Zone</h2>

        <form action={deleteEventAction} style={styles.dangerSectionInner}>
          <input type="hidden" name="event_id" value={event.id} />
          <button type="submit" style={styles.dangerButton}>Delete event</button>
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
  tabDanger: {
    padding: "10px 12px",
    border: "1px solid #fecaca",
    borderRadius: 999,
    color: "#b91c1c",
    background: "#fff7f7",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
  },
  sectionTitle: {
    margin: "0 0 16px",
    color: "#0f172a",
    fontSize: 24,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
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
    fontSize: 22,
    fontWeight: 900,
  },
  panel: {
    display: "grid",
    gap: 14,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
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
  helperText: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
  },
  ticketLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(320px, 1.4fr)",
    gap: 16,
    alignItems: "start",
  },
  primaryButton: {
    width: "fit-content",
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
    width: "fit-content",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  editTicketCard: {
    display: "grid",
    gap: 10,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#ffffff",
    marginBottom: 10,
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
  },
  dangerSectionInner: {
    padding: 16,
    borderRadius: 18,
    background: "#fef2f2",
    border: "1px solid #fecaca",
  },
};
