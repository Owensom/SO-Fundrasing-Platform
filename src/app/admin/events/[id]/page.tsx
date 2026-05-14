import { randomInt } from "crypto";
import type { CSSProperties, ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
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
const DEFAULT_EVENTS_IMAGE = "/brand/so-default-events.png";

function cleanTableShape(value: FormDataEntryValue | string | null): TableShape {
  const clean = String(value || "").trim();

  if (clean === "square" || clean === "rectangle" || clean === "round") {
    return clean;
  }

  return "round";
}

function getTableShape(
  tableNamesJson: Record<string, string> | null | undefined,
) {
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

function cleanImageFocus(value: FormDataEntryValue | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
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

function statusStyle(status: string): CSSProperties {
  if (status === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (status === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not scheduled";

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "Not scheduled";
  }
}

function formatMoney(cents: number | null | undefined, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `${moneyFromCents(cents)} ${currency || "GBP"}`;
  }
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
  const imageFocusX = cleanImageFocus(formData.get("image_focus_x"));
  const imageFocusY = cleanImageFocus(formData.get("image_focus_y"));
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
    imageFocusX,
    imageFocusY,
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

  const parsedTableNames = parseTableNames(formData.get("table_names_json"));

  await updateEvent(eventId, {
    prizesJson: event.prizes_json || [],
    menuOptions: event.menu_options || [],
    seatingLayoutJson: event.seating_layout_json || {},
    tableNamesJson: {
      ...(event.table_names_json || {}),
      ...parsedTableNames,
      [TABLE_SHAPE_KEY]: event.table_names_json?.[TABLE_SHAPE_KEY] || "round",
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
  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() === "table-seating"
      ? "table-seating"
      : "row-seating";

  if (!eventId || !rawTicketTypeId || seatIds.length === 0) {
    redirect(
      `/admin/events/${eventId}?error=missing-seat-selection#${returnAnchor}`,
    );
  }

  await requireEventAccess(eventId);

  await updateEventSeatsTicketType({
    eventId,
    seatIds,
    ticketTypeId: rawTicketTypeId === "__normal__" ? null : rawTicketTypeId,
  });

  redirect(`/admin/events/${eventId}?saved=seat-marking#${returnAnchor}`);
}

async function updateSelectedSeatsMetadataAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));

  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() === "table-seating"
      ? "table-seating"
      : "row-seating";

  if (!eventId || seatIds.length === 0) {
    redirect(
      `/admin/events/${eventId}?error=missing-seat-selection#${returnAnchor}`,
    );
  }

  await requireEventAccess(eventId);

  await updateEventSeatsMetadata({
    eventId,
    seatIds,
    seatPurpose: String(formData.get("seat_purpose") || "").trim() || null,
    adminLabel: String(formData.get("admin_label") || "").trim() || null,
    adminNote: String(formData.get("admin_note") || "").trim() || null,
    guestName: String(formData.get("guest_name") || "").trim() || null,
    guestEmail: String(formData.get("guest_email") || "").trim() || null,
    dietaryRequirements:
      String(formData.get("dietary_requirements") || "").trim() || null,
    menuChoice: String(formData.get("menu_choice") || "").trim() || null,
  });

  redirect(`/admin/events/${eventId}?saved=seat-metadata#${returnAnchor}`);
}

async function updateSelectedSeatsStatusAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const status = String(formData.get("status") || "").trim() as
    | "available"
    | "blocked";
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));
  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() === "table-seating"
      ? "table-seating"
      : "row-seating";

  if (!eventId || seatIds.length === 0) {
    redirect(
      `/admin/events/${eventId}?error=missing-seat-selection#${returnAnchor}`,
    );
  }

  if (status !== "available" && status !== "blocked") {
    redirect(
      `/admin/events/${eventId}?error=invalid-seat-status#${returnAnchor}`,
    );
  }

  await requireEventAccess(eventId);

  await updateEventSeatsStatus({
    eventId,
    seatIds,
    status,
  });

  redirect(`/admin/events/${eventId}?saved=seat-status#${returnAnchor}`);
}

async function deleteSelectedSeatsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const seatIds = parseJsonStringArray(formData.get("seat_ids"));
  const returnAnchor =
    String(formData.get("return_anchor") || "").trim() === "table-seating"
      ? "table-seating"
      : "row-seating";

  if (!eventId || seatIds.length === 0) {
    redirect(
      `/admin/events/${eventId}?error=missing-seat-selection#${returnAnchor}`,
    );
  }

  await requireEventAccess(eventId);

  await deleteEventSeatsByIds({
    eventId,
    seatIds,
  });

  redirect(`/admin/events/${eventId}?saved=seats-deleted#${returnAnchor}`);
}

async function deleteSelectedRowsAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const rowKeys = parseJsonStringArray(formData.get("row_keys"));

  if (!eventId || rowKeys.length === 0) {
    redirect(
      `/admin/events/${eventId}?error=missing-row-selection#row-seating`,
    );
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
      } catch {}
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
      } catch {}
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

async function runWinnerDrawAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const drawMode = String(formData.get("draw_mode") || "single").trim();
  const selectedPrize = parsePrizeSelection(formData.get("prize_key"));
  const drawScope = String(formData.get("draw_scope") || "all").trim();

  const maxWinnersPerTableRaw = positiveInteger(
    formData.get("max_winners_per_table"),
    0,
  );

  if (!eventId) {
    redirect("/admin/events?error=missing-event");
  }

  const event = await requireEventAccess(eventId);
  const existingWinners = await listEventWinners(eventId);

  const drawnPrizeIds = new Set(
    existingWinners
      .filter((winner) => winner.status === "drawn")
      .map((winner) => String(winner.prize_id || "").trim())
      .filter(Boolean),
  );

  const eventPrizes: ParsedPrizeSelection[] = (event.prizes_json || [])
    .map((prize, index) => {
      const title = String(prize.title || prize.name || "").trim();
      if (!title) return null;

      const rawPosition = Number(prize.position);

      return {
        id: String(prize.id || `prize-${index + 1}`),
        title,
        position:
          Number.isFinite(rawPosition) && rawPosition > 0
            ? Math.floor(rawPosition)
            : index + 1,
      };
    })
    .filter(Boolean) as ParsedPrizeSelection[];

  const prizesToDraw =
    drawMode === "all_remaining"
      ? eventPrizes.filter((prize) => !drawnPrizeIds.has(prize.id))
      : selectedPrize
        ? [selectedPrize]
        : [];

  if (prizesToDraw.length === 0) {
    redirect(`/admin/events/${eventId}?error=missing-draw-data#winner-draw`);
  }

  if (drawMode !== "all_remaining" && selectedPrize) {
    if (drawnPrizeIds.has(selectedPrize.id)) {
      redirect(`/admin/events/${eventId}?error=prize-already-drawn#winner-draw`);
    }
  }

  const drawSettings = {
    eventType: event.event_type,
    includeVip: String(formData.get("include_vip") || "") === "yes",
    includeComplimentary:
      String(formData.get("include_complimentary") || "") === "yes",
    includeStaff: String(formData.get("include_staff") || "") === "yes",
    includeSponsors: String(formData.get("include_sponsors") || "") === "yes",
    includeGuests: String(formData.get("include_guests") || "") === "yes",
    excludeWinnerEmails: drawScope === "not_previous_winners",
    maxWinnersPerTable:
      event.event_type === "tables" && maxWinnersPerTableRaw > 0
        ? maxWinnersPerTableRaw
        : null,
  };

  let drawnCount = 0;

  for (const prize of prizesToDraw) {
    const candidates = await getEligibleEventDrawCandidates({
      eventId,
      includeVip: drawSettings.includeVip,
      includeComplimentary: drawSettings.includeComplimentary,
      includeStaff: drawSettings.includeStaff,
      includeSponsors: drawSettings.includeSponsors,
      includeGuests: drawSettings.includeGuests,
      excludeWinnerEmails: drawSettings.excludeWinnerEmails,
      maxWinnersPerTable: drawSettings.maxWinnersPerTable,
    });

    const winner = chooseRandomCandidate(candidates);

    if (!winner) {
      if (drawMode === "all_remaining" && drawnCount > 0) break;

      redirect(`/admin/events/${eventId}?error=no-eligible-winner#winner-draw`);
    }

    await createEventWinner({
      tenantSlug: event.tenant_slug,
      eventId,
      prizeId: prize.id,
      prizeTitle: prize.title,
      prizePosition: prize.position,
      drawScope,
      drawSettings,
      eventOrderId: winner.event_order_id,
      eventOrderItemId: winner.event_order_item_id,
      eventSeatId: winner.event_seat_id,
      ticketTypeId: winner.ticket_type_id,
      tableNumber: winner.table_number,
      rowLabel: winner.row_label,
      seatNumber: winner.seat_number,
      winnerName: winner.winner_name,
      winnerEmail: winner.winner_email,
    });

    drawnCount += 1;
  }

  if (drawnCount === 0) {
    redirect(`/admin/events/${eventId}?error=no-eligible-winner#winner-draw`);
  }

  redirect(
    `/admin/events/${eventId}?saved=${
      drawMode === "all_remaining" ? "all-winners-drawn" : "winner-drawn"
    }#winner-draw`,
  );
}

async function deleteWinnerAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const winnerId = String(formData.get("winner_id") || "").trim();

  if (!eventId || !winnerId) {
    redirect(`/admin/events/${eventId}?error=missing-winner#winner-draw`);
  }

  await requireEventAccess(eventId);
  await deleteEventWinner(winnerId);

  redirect(`/admin/events/${eventId}?saved=winner-deleted#winner-draw`);
}

async function clearWinnersAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (!eventId) {
    redirect("/admin/events?error=missing-event");
  }

  await requireEventAccess(eventId);
  await clearEventWinners(eventId);

  redirect(`/admin/events/${eventId}?saved=winners-cleared#winner-draw`);
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

const responsiveStyles = `
@media (max-width: 980px) {
  .event-edit-page {
    overflow-x: hidden;
  }

  .event-edit-page * {
    max-width: 100%;
  }

  .event-edit-page section,
  .event-edit-page form,
  .event-edit-page details,
  .event-edit-page summary,
  .event-edit-page div,
  .event-edit-page label {
    min-width: 0 !important;
  }

  .event-edit-page .hero,
  .event-edit-page .mediaBox,
  .event-edit-page .ticketLayout,
  .event-edit-page .twoPanel,
  .event-edit-page .twoCol,
  .event-edit-page .threeCol,
  .event-edit-page .fourCol {
    grid-template-columns: 1fr !important;
  }

  .event-edit-page .tabs {
    overflow-x: auto !important;
    flex-wrap: nowrap !important;
    -webkit-overflow-scrolling: touch !important;
  }

  .event-edit-page .tab,
  .event-edit-page .tabDanger {
    white-space: nowrap !important;
    flex: 0 0 auto !important;
  }

  .event-edit-page .heroImageWrap {
    height: 220px !important;
  }

  .event-edit-page .previewBox {
    height: 170px !important;
  }

  .event-edit-page .topActions,
  .event-edit-page .submitBar {
    align-items: stretch !important;
  }

  .event-edit-page .primaryButton,
  .event-edit-page .dangerButton,
  .event-edit-page .dangerOutlineButton,
  .event-edit-page .primaryLink,
  .event-edit-page .secondaryButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
    box-sizing: border-box !important;
  }

  .event-edit-page .seatManagerShell {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch !important;
    width: 100% !important;
  }

  .event-edit-page .ticketListScroll {
    max-height: none !important;
    overflow: visible !important;
    padding-right: 0 !important;
  }
}

@media (max-width: 640px) {
  .event-edit-page {
    padding: 18px 12px 44px !important;
  }

  .event-edit-page .hero {
    padding: 18px !important;
    border-radius: 24px !important;
  }

  .event-edit-page .title {
    font-size: clamp(31px, 10vw, 42px) !important;
    line-height: 1.02 !important;
  }

  .event-edit-page .section,
  .event-edit-page .panel {
    padding: 14px !important;
  }

  .event-edit-page .collapsibleSummary,
  .event-edit-page .ticketSummary {
    align-items: flex-start !important;
  }

  .event-edit-page .collapsibleActions {
    width: 100% !important;
    justify-content: flex-start !important;
  }

  .event-edit-page .sectionBadge,
  .event-edit-page .collapsibleToggle {
    max-width: none !important;
  }

  .event-edit-page .statValue {
    font-size: 20px !important;
  }

  .event-edit-page .heroImageWrap {
    height: 190px !important;
  }

  .event-edit-page .previewBox {
    height: 150px !important;
  }
}
`;
export default async function AdminEventManagePage({
  params,
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const event = await getEventById(params.id);

  if (!event) {
    notFound();
  }

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
  const winners = await listEventWinners(event.id);
  const hasCustomImage = Boolean(event.image_url);

  const imageFocusStyle: CSSProperties = {
    objectFit: "cover",
    objectPosition: `${event.image_focus_x ?? 50}% ${
      event.image_focus_y ?? 50
    }%`,
  };

  const defaultImageStyle: CSSProperties = {
    objectFit: "contain",
    objectPosition: "center",
    padding: 18,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
    boxSizing: "border-box",
  };

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
  const vipSeats = visibleSeats.filter(
    (seat) => seat.seat_purpose === "vip",
  ).length;
  const complimentarySeats = visibleSeats.filter(
    (seat) => seat.seat_purpose === "complimentary",
  ).length;

  const activeTicketTypes = ticketTypes.filter(
    (ticketType) => ticketType.is_active,
  );

  const lowestTicketPrice =
    activeTicketTypes.length > 0
      ? Math.min(...activeTicketTypes.map((ticketType) => ticketType.price || 0))
      : null;

  const uniqueTableNumbers = Array.from(
    new Set(
      tableSeats
        .map((seat) => String(seat.table_number || "").trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => {
    const aNumber = Number(a);
    const bNumber = Number(b);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return a.localeCompare(b);
  });

  const tableShape = getTableShape(event.table_names_json);

  const tableNamesFromExistingTables = Object.fromEntries(
    uniqueTableNumbers.map((tableNumber) => [
      tableNumber,
      event.table_names_json?.[tableNumber] || "",
    ]),
  );

  const publicEventHref = `/e/${encodeURIComponent(event.slug)}`;

  const capacitySummary = isGeneralAdmission
    ? event.capacity
      ? `${event.capacity} tickets`
      : "Unlimited"
    : isReservedSeating
      ? `${rowSeats.length} row seats`
      : `${tableSeats.length} table seats`;

  return (
    <main className="event-edit-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Events editor</div>

          <div style={styles.heroTitleRow}>
            <h1 className="so-brand-heading title" style={styles.title}>
              {event.title}
            </h1>

            <span style={{ ...styles.statusPill, ...statusStyle(event.status) }}>
              {statusLabel(event.status)}
            </span>
          </div>

          <p style={styles.heroSlug}>/e/{event.slug}</p>

          <p style={styles.heroDescription}>
            {event.description || "No description added yet."}
          </p>

          <div style={styles.heroMetricGrid}>
            <HeroMetric label="Type" value={eventTypeLabel(event.event_type)} />
            <HeroMetric
              label="Starts"
              value={formatDisplayDate(event.starts_at)}
            />
            <HeroMetric label="Capacity" value={capacitySummary} />
            <HeroMetric
              label="From"
              value={
                lowestTicketPrice === null
                  ? "Not priced"
                  : formatMoney(lowestTicketPrice, event.currency)
              }
            />
          </div>
        </div>

        <div style={styles.heroPreview}>
          <div style={styles.previewKicker}>Public preview</div>

          <div className="heroImageWrap" style={styles.heroImageWrap}>
            <img
              src={event.image_url || DEFAULT_EVENTS_IMAGE}
              alt={event.title || "SO Events"}
              style={{
                ...styles.heroImage,
                ...(hasCustomImage ? imageFocusStyle : defaultImageStyle),
              }}
            />
          </div>
        </div>
      </section>

      <section className="topActions" style={styles.topActions}>
        <a
          href="/admin/events"
          className="secondaryButton"
          style={styles.secondaryButton}
        >
          ← Back to events
        </a>

        <a
          href={publicEventHref}
          target="_blank"
          className="primaryLink"
          style={styles.primaryLink}
        >
          View public page
        </a>
      </section>

      <nav className="tabs" style={styles.tabs}>
        <a href="#overview" className="tab" style={styles.tab}>
          Overview
        </a>
        <a href="#tickets" className="tab" style={styles.tab}>
          Tickets
        </a>
        <a href="#prizes-menu" className="tab" style={styles.tab}>
          Prizes & Menu
        </a>
        <a href="#winner-draw" className="tab" style={styles.tab}>
          Winner Draw
        </a>
        {isReservedSeating ? (
          <a href="#row-seating" className="tab" style={styles.tab}>
            Row Seating
          </a>
        ) : null}
        {isTables ? (
          <a href="#table-seating" className="tab" style={styles.tab}>
            Table Seating
          </a>
        ) : null}
        <a href="#danger-zone" className="tabDanger" style={styles.tabDanger}>
          Danger Zone
        </a>
      </nav>

      {searchParams?.saved ? (
        <div style={styles.successBox}>Saved successfully.</div>
      ) : null}

      {searchParams?.error ? (
        <div style={styles.errorBox}>
          Please check the missing fields and try again.
        </div>
      ) : null}

      <section style={styles.summaryGrid}>
        <SummaryCard label="Ticket types" value={ticketTypes.length} />
        <SummaryCard label="Prizes" value={(event.prizes_json || []).length} />
        <SummaryCard
          label="Menu options"
          value={(event.menu_options || []).length}
        />
        <SummaryCard label="Winners" value={winners.length} />
        <SummaryCard label="Available" value={availableSeats} />
        <SummaryCard label="Reserved" value={reservedSeats} />
        <SummaryCard label="Sold" value={soldSeats} />
        <SummaryCard label="Blocked" value={blockedSeats} />
        <SummaryCard label="VIP" value={vipSeats} />
        <SummaryCard label="Complimentary" value={complimentarySeats} />
      </section>

      <CollapsibleSection
        id="overview"
        eyebrow="Section 1"
        title="Overview"
        description="Core event details and headline setup. This is open by default because it contains the main event save form."
        badge={formatDisplayDate(event.starts_at)}
        defaultOpen
      >
        <div className="panel" style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.innerEyebrow}>Event setup</div>
              <h3 style={styles.panelTitle}>Event details</h3>
              <p style={styles.sectionText}>
                Update the public event page, timing, capacity, image and guest
                collection settings.
              </p>
            </div>
          </div>

          <form action={updateEventAction} style={styles.form}>
            <input type="hidden" name="id" value={event.id} />

            <div className="twoCol" style={styles.twoCol}>
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
            </div>

            <Field label="Description">
              <textarea
                name="description"
                rows={3}
                defaultValue={event.description || ""}
                style={styles.textarea}
              />
            </Field>

            <div className="mediaBox" style={styles.mediaBox}>
              <div style={styles.mediaControls}>
                <h3 style={styles.panelTitle}>Event image</h3>

                <p style={styles.sectionText}>
                  Upload or replace the public event image, then choose the focal
                  point for wide banners and cards.
                </p>

                <ImageFocusUploadField
                  currentImageUrl={event.image_url ?? ""}
                  currentFocusX={event.image_focus_x ?? 50}
                  currentFocusY={event.image_focus_y ?? 50}
                  label="Event image upload"
                  previewAlt={event.title}
                />
              </div>

              <div className="previewBox" style={styles.previewBox}>
                <img
                  src={event.image_url || DEFAULT_EVENTS_IMAGE}
                  alt={event.title || "SO Events"}
                  style={{
                    ...styles.previewImage,
                    ...(hasCustomImage ? imageFocusStyle : defaultImageStyle),
                  }}
                />
              </div>
            </div>

            <div className="twoCol" style={styles.twoCol}>
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

            <div className="twoCol" style={styles.twoCol}>
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

            <div className="threeCol" style={styles.threeCol}>
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

            <div className="twoCol" style={styles.twoCol}>
              <Field label="Ask for dietary requirements">
                <select
                  name="ask_dietary_requirements"
                  defaultValue={
                    event.ask_dietary_requirements ? "true" : "false"
                  }
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

            <section className="submitBar" style={styles.submitBar}>
              <div>
                <strong style={{ color: "#0f172a" }}>
                  Save event details
                </strong>
                <div style={styles.mutedSmall}>
                  This updates the public event page and admin values.
                </div>
              </div>

              <button
                type="submit"
                className="primaryButton"
                style={styles.primaryButton}
              >
                Save event details
              </button>
            </section>
          </form>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="tickets"
        eyebrow="Section 2"
        title="Tickets & Prices"
        description="Add public ticket choices, pricing, limits and visibility."
        badge={`${activeTicketTypes.length} active`}
      >
        <div className="ticketLayout" style={styles.ticketLayout}>
          <CompactPanel title="Add ticket type" eyebrow="New ticket">
            <form action={addTicketTypeAction} style={styles.form}>
              <input type="hidden" name="event_id" value={event.id} />

              <Field label="Ticket name">
                <input name="name" required style={styles.input} />
              </Field>

              <Field label="Description">
                <input name="description" style={styles.input} />
              </Field>

              <div className="threeCol" style={styles.threeCol}>
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
                    placeholder="Leave blank"
                    style={styles.input}
                  />
                </Field>

                <Field label="Display order">
                  <input
                    name="sort_order"
                    type="number"
                    min="0"
                    defaultValue={ticketTypes.length}
                    style={styles.input}
                  />
                  <p style={styles.helperText}>Lower numbers appear first.</p>
                </Field>
              </div>

              <Field label="Visibility">
                <select
                  name="is_active"
                  defaultValue="true"
                  style={styles.input}
                >
                  <option value="true">Active</option>
                  <option value="false">Hidden</option>
                </select>
              </Field>

              <button
                type="submit"
                className="primaryButton"
                style={styles.primaryButton}
              >
                Add ticket type
              </button>
            </form>
          </CompactPanel>

          <CompactPanel title="Current ticket types" eyebrow="Existing tickets">
            <div className="ticketListScroll" style={styles.ticketListScroll}>
              {ticketTypes.length === 0 ? (
                <div style={styles.emptyBox}>No ticket types yet.</div>
              ) : (
                ticketTypes.map((ticketType) => (
                  <details key={ticketType.id} style={styles.ticketDetails}>
                    <summary
                      className="ticketSummary"
                      style={styles.ticketSummary}
                    >
                      <div>
                        <strong>{ticketType.name}</strong>
                        <div style={styles.mutedSmall}>
                          {formatMoney(ticketType.price, event.currency)}
                          {ticketType.capacity
                            ? ` • ${ticketType.capacity} limit`
                            : " • Unlimited"}
                        </div>
                      </div>

                      <span
                        style={{
                          ...styles.statusMiniPill,
                          ...(ticketType.is_active
                            ? {
                                background: "#dcfce7",
                                color: "#166534",
                                borderColor: "#bbf7d0",
                              }
                            : {
                                background: "#f8fafc",
                                color: "#64748b",
                                borderColor: "#e2e8f0",
                              }),
                        }}
                      >
                        {ticketType.is_active ? "Active" : "Hidden"}
                      </span>
                    </summary>

                    <div style={styles.ticketDetailsBody}>
                      <form action={updateTicketTypeAction} style={styles.form}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <input
                          type="hidden"
                          name="ticket_type_id"
                          value={ticketType.id}
                        />

                        <div className="twoCol" style={styles.twoCol}>
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

                        <div className="fourCol" style={styles.fourCol}>
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
                              placeholder="Unlimited"
                              style={styles.input}
                            />
                          </Field>

                          <Field label="Display order">
                            <input
                              name="sort_order"
                              type="number"
                              min="0"
                              defaultValue={ticketType.sort_order}
                              style={styles.input}
                            />
                            <p style={styles.helperText}>
                              Lower numbers appear first.
                            </p>
                          </Field>

                          <Field label="Visibility">
                            <select
                              name="is_active"
                              defaultValue={
                                ticketType.is_active ? "true" : "false"
                              }
                              style={styles.input}
                            >
                              <option value="true">Active</option>
                              <option value="false">Hidden</option>
                            </select>
                          </Field>
                        </div>

                        <button
                          type="submit"
                          className="primaryButton"
                          style={styles.primaryButton}
                        >
                          Save ticket
                        </button>
                      </form>

                      <form action={deleteTicketTypeAction}>
                        <input type="hidden" name="event_id" value={event.id} />
                        <input
                          type="hidden"
                          name="ticket_type_id"
                          value={ticketType.id}
                        />
                        <button
                          type="submit"
                          className="dangerOutlineButton"
                          style={styles.dangerOutlineButton}
                        >
                          Delete ticket type
                        </button>
                      </form>
                    </div>
                  </details>
                ))
              )}
            </div>

            <form action={clearTicketTypesAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button
                type="submit"
                className="dangerOutlineButton"
                style={styles.dangerOutlineButton}
              >
                Clear all ticket types
              </button>
            </form>
          </CompactPanel>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="prizes-menu"
        eyebrow="Section 3"
        title="Prizes & Menu"
        description="Manage optional golden-ticket prizes and event menu choices."
        badge={`${(event.prizes_json || []).length} prizes • ${
          (event.menu_options || []).length
        } menu`}
      >
        <EventPrizeMenuSettings
          eventId={event.id}
          initialPrizes={event.prizes_json || []}
          initialMenuOptions={event.menu_options || []}
          updatePrizesAction={updatePrizesAction}
          updateMenuOptionsAction={updateMenuOptionsAction}
        />
      </CollapsibleSection>

      <CollapsibleSection
        id="winner-draw"
        eyebrow="Section 4"
        title="Winner Draw"
        description="Draw event winners from eligible paid event entries and keep winner history."
        badge={`${winners.length} winners`}
      >
        <EventWinnerDrawPanel
          eventId={event.id}
          eventType={event.event_type}
          prizes={event.prizes_json || []}
          winners={winners}
          drawWinnerAction={runWinnerDrawAction}
          deleteWinnerAction={deleteWinnerAction}
          clearWinnersAction={clearWinnersAction}
        />
      </CollapsibleSection>

      {isReservedSeating ? (
        <CollapsibleSection
          id="row-seating"
          eyebrow="Section 5"
          title="Row Seating"
          description="Generate seats, block seats, mark VIP/complimentary seats and save row layout nudges."
          badge={`${rowSeats.length} seats`}
        >
          <div className="twoPanel" style={styles.twoPanel}>
            <CompactPanel title="Generate row seating" eyebrow="Seat builder">
              <form action={generateSeatsAction} style={styles.form}>
                <input type="hidden" name="event_id" value={event.id} />

                <Field label="Initial marking">
                  <select name="ticket_type_id" style={styles.input}>
                    <option value="">Normal public seats</option>
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

                <div className="twoCol" style={styles.twoCol}>
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

                <button
                  type="submit"
                  className="primaryButton"
                  style={styles.primaryButton}
                >
                  Generate row seating
                </button>
              </form>
            </CompactPanel>

            <CompactPanel title="Row seating summary" eyebrow="Seat status">
              <div style={styles.statsGridCompact}>
                <SummaryCard label="Row seats" value={rowSeats.length} />
                <SummaryCard
                  label="Blocked"
                  value={
                    rowSeats.filter((seat) => seat.status === "blocked").length
                  }
                />
                <SummaryCard
                  label="Sold"
                  value={rowSeats.filter((seat) => seat.status === "sold").length}
                />
              </div>
            </CompactPanel>
          </div>

          <CompactPanel title="Seat Manager" eyebrow="Row tools">
            <div style={styles.panelHeader}>
              <p style={styles.sectionText}>
                Click seats to select them, then save guest/allocation details or
                block/unblock seats.
              </p>

              <form action={clearRowSeatsAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button
                  type="submit"
                  className="dangerOutlineButton"
                  style={styles.dangerOutlineButton}
                >
                  Clear row seats only
                </button>
              </form>
            </div>

            {rowSeats.length === 0 ? (
              <div style={styles.emptyBox}>No row seats generated yet.</div>
            ) : (
              <div className="seatManagerShell" style={styles.seatManagerShell}>
                <AdminSeatManager
                  eventId={event.id}
                  seats={rowSeats}
                  ticketTypes={ticketTypes}
                  currency={event.currency}
                  mode="rows"
                  applyTicketTypeAction={applySeatTicketTypeAction}
                  updateSelectedSeatsMetadataAction={
                    updateSelectedSeatsMetadataAction
                  }
                  updateSelectedSeatsStatusAction={
                    updateSelectedSeatsStatusAction
                  }
                  updateSeatingLayoutAction={updateSeatingLayoutAction}
                  deleteSelectedSeatsAction={deleteSelectedSeatsAction}
                  deleteSelectedRowsAction={deleteSelectedRowsAction}
                  initialSeatingLayout={event.seating_layout_json || {}}
                />
              </div>
            )}
          </CompactPanel>
        </CollapsibleSection>
      ) : null}

      {isTables ? (
        <CollapsibleSection
          id="table-seating"
          eyebrow="Section 5"
          title="Table Seating"
          description="Generate table layouts, choose a table shape, name tables and manage allocations."
          badge={`${tableSeats.length} seats • ${uniqueTableNumbers.length} tables`}
        >
          <div className="twoPanel" style={styles.twoPanel}>
            <CompactPanel title="Generate table seating" eyebrow="Table builder">
              <form action={generateTablesAction} style={styles.form}>
                <input type="hidden" name="event_id" value={event.id} />

                <Field label="Initial marking">
                  <select name="ticket_type_id" style={styles.input}>
                    <option value="">Normal public seats</option>
                    {ticketTypes.map((ticketType) => (
                      <option key={ticketType.id} value={ticketType.id}>
                        {ticketType.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="twoCol" style={styles.twoCol}>
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

                <button
                  type="submit"
                  className="primaryButton"
                  style={styles.primaryButton}
                >
                  Generate table seating
                </button>
              </form>
            </CompactPanel>

            <CompactPanel title="Table seating summary" eyebrow="Table status">
              <div style={styles.statsGridCompact}>
                <SummaryCard label="Table seats" value={tableSeats.length} />
                <SummaryCard label="Tables" value={uniqueTableNumbers.length} />
                <SummaryCard label="Shape" value={tableShape} />
                <SummaryCard
                  label="Named"
                  value={
                    Object.keys(event.table_names_json || {}).filter(
                      (key) => key !== TABLE_SHAPE_KEY,
                    ).length
                  }
                />
                <SummaryCard
                  label="Blocked"
                  value={
                    tableSeats.filter((seat) => seat.status === "blocked").length
                  }
                />
                <SummaryCard
                  label="Sold"
                  value={tableSeats.filter((seat) => seat.status === "sold").length}
                />
              </div>
            </CompactPanel>
          </div>

          <CompactPanel title="Table shape" eyebrow="Layout">
            <form action={updateTableShapeAction} style={styles.form}>
              <input type="hidden" name="event_id" value={event.id} />

              <Field label="Shape">
                <select
                  name="table_shape"
                  defaultValue={tableShape}
                  style={styles.input}
                >
                  <option value="round">Round tables</option>
                  <option value="square">Square tables</option>
                  <option value="rectangle">Rectangle tables</option>
                </select>
              </Field>

              <button
                type="submit"
                className="primaryButton"
                style={styles.primaryButton}
              >
                Save table shape
              </button>
            </form>
          </CompactPanel>

          <CompactPanel title="Table names" eyebrow="Public labels">
            <form action={updateTableNamesAction} style={styles.form}>
              <input type="hidden" name="event_id" value={event.id} />

              <p style={styles.sectionText}>
                Add friendly names such as Sponsors, VIP, Smith Family, or
                Staff.
              </p>

              <TableNamesEditor
                tableNumbers={uniqueTableNumbers}
                initialTableNames={
                  uniqueTableNumbers.length > 0
                    ? tableNamesFromExistingTables
                    : event.table_names_json || {}
                }
              />

              <button
                type="submit"
                className="primaryButton"
                style={styles.primaryButton}
              >
                Save table names
              </button>
            </form>
          </CompactPanel>

          <CompactPanel title="Seat Manager" eyebrow="Table tools">
            <div style={styles.panelHeader}>
              <p style={styles.sectionText}>
                Select one or more seats, then save allocation details or
                block/unblock seats.
              </p>

              <form action={clearTableSeatsAction}>
                <input type="hidden" name="event_id" value={event.id} />
                <button
                  type="submit"
                  className="dangerOutlineButton"
                  style={styles.dangerOutlineButton}
                >
                  Clear table seats only
                </button>
              </form>
            </div>

            {tableSeats.length === 0 ? (
              <div style={styles.emptyBox}>No table seats generated yet.</div>
            ) : (
              <div className="seatManagerShell" style={styles.seatManagerShell}>
                <AdminSeatManager
                  eventId={event.id}
                  seats={tableSeats}
                  ticketTypes={ticketTypes}
                  currency={event.currency}
                  mode="tables"
                  applyTicketTypeAction={applySeatTicketTypeAction}
                  updateSelectedSeatsMetadataAction={
                    updateSelectedSeatsMetadataAction
                  }
                  updateSelectedSeatsStatusAction={
                    updateSelectedSeatsStatusAction
                  }
                  deleteSelectedSeatsAction={deleteSelectedSeatsAction}
                  initialSeatingLayout={{
                    ...(event.seating_layout_json || {}),
                    tableShape,
                  }}
                />
              </div>
            )}
          </CompactPanel>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        id="danger-zone"
        eyebrow="Final section"
        title="Danger Zone"
        description="Permanent destructive actions for this event."
        badge="Delete"
      >
        <div style={styles.dangerSectionInner}>
          <form action={deleteEventAction}>
            <input type="hidden" name="event_id" value={event.id} />
            <button
              type="submit"
              className="dangerButton"
              style={styles.dangerButton}
            >
              Delete event
            </button>
          </form>
        </div>
      </CollapsibleSection>
    </main>
  );
}

function CollapsibleSection({
  id,
  title,
  eyebrow,
  description,
  badge,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} className="section" style={styles.section}>
      <summary className="collapsibleSummary" style={styles.collapsibleSummary}>
        <div style={styles.collapsibleHeading}>
          {eyebrow ? <p style={styles.sectionEyebrow}>{eyebrow}</p> : null}
          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            {title}
          </h2>
          {description ? <p style={styles.sectionText}>{description}</p> : null}
        </div>

        <div className="collapsibleActions" style={styles.collapsibleActions}>
          {badge ? (
            <span className="sectionBadge" style={styles.sectionBadge}>
              {badge}
            </span>
          ) : null}
          <span className="collapsibleToggle" style={styles.collapsibleToggle}>
            Open / close
          </span>
        </div>
      </summary>

      <div style={styles.collapsibleBody}>{children}</div>
    </details>
  );
}

function CompactPanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <section className="panel" style={styles.panel}>
      <div>
        <div style={styles.innerEyebrow}>{eyebrow}</div>
        <h3 style={styles.panelTitle}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.statBox}>
      <p style={styles.statLabel}>{label}</p>
      <p className="statValue" style={styles.statValue}>
        {value}
      </p>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetric}>
      <div style={styles.heroMetricLabel}>{label}</div>
      <div style={styles.heroMetricValue}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)",
    gap: 20,
    alignItems: "stretch",
    padding: "clamp(20px, 4vw, 28px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    overflow: "hidden",
  },
  heroContent: { minWidth: 0 },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12,
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 5vw, 48px)",
    lineHeight: 1.02,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
    maxWidth: 720,
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 950,
    flexShrink: 0,
  },
  heroSlug: {
    margin: "10px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  heroDescription: {
    margin: "14px 0 0",
    color: "#dbeafe",
    lineHeight: 1.6,
    maxWidth: 760,
    overflowWrap: "anywhere",
  },
  heroMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
    gap: 10,
    marginTop: 22,
  },
  heroMetric: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
    minWidth: 0,
  },
  heroMetricLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetricValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },
  heroPreview: {
    display: "grid",
    gap: 12,
    alignContent: "start",
    padding: 14,
    borderRadius: 24,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  previewKicker: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  heroImageWrap: {
    height: 240,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  topActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
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
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  tab: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
    background: "#ffffff",
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
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  section: {
    padding: "clamp(16px, 4vw, 18px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
    minWidth: 0,
    overflow: "hidden",
  },
  collapsibleSummary: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    cursor: "pointer",
    listStyle: "none",
    flexWrap: "wrap",
  },
  collapsibleHeading: {
    minWidth: 0,
    flex: "1 1 260px",
  },
  collapsibleActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  collapsibleToggle: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  sectionBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  collapsibleBody: { marginTop: 16 },
  sectionEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontWeight: 950,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  innerEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(22px, 5vw, 26px)",
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },
  sectionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  helperText: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
  },
  statBox: {
    padding: 15,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
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
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  statsGridCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
    gap: 10,
  },
  panel: {
    display: "grid",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 55%, #eff6ff 100%)",
    border: "1px solid #e2e8f0",
    marginBottom: 14,
    minWidth: 0,
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  form: {
    display: "grid",
    gap: 12,
    minWidth: 0,
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: { minWidth: 0 },
  previewBox: {
    height: 170,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
    gap: 12,
  },
  fourCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
    gap: 12,
  },
  twoPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 14,
  },
  ticketLayout: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
    gap: 14,
    alignItems: "start",
  },
  ticketListScroll: {
    display: "grid",
    gap: 10,
    maxHeight: 520,
    overflow: "auto",
    paddingRight: 4,
  },
  ticketDetails: {
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },
  ticketSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
    padding: 14,
    flexWrap: "wrap",
  },
  ticketDetailsBody: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderTop: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  statusMiniPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  primaryButton: {
    width: "fit-content",
    minHeight: 44,
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
  },
  dangerButton: {
    minHeight: 44,
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
  },
  dangerOutlineButton: {
    minHeight: 42,
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontWeight: 900,
    color: "#334155",
    minHeight: 42,
  },
  emptyBox: {
    padding: 16,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 900,
  },
  dangerSectionInner: {
    padding: 16,
    borderRadius: 18,
    background: "#fef2f2",
    border: "1px solid #fecaca",
  },
  seatManagerShell: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    paddingBottom: 4,
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
};
