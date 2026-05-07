import { randomInt } from "crypto";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
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

  const seatsPerRow = positiveInteger(
    formData.get("seats_per_row"),
    0,
  );

  const aisleAfterList = parseAisleAfterList(
    formData.get("aisle_after"),
  );

  const ticketTypeId =
    String(formData.get("ticket_type_id") || "").trim() || null;

  const clearExisting =
    String(formData.get("clear_existing") || "") === "yes";

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
        // ignore duplicates
      }
    }
  }

  redirect(`/admin/events/${eventId}?saved=seats#row-seating`);
}

async function generateTablesAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  const tableCount = positiveInteger(
    formData.get("table_count"),
    0,
  );

  const seatsPerTable = positiveInteger(
    formData.get("seats_per_table"),
    0,
  );

  const ticketTypeId =
    String(formData.get("ticket_type_id") || "").trim() || null;

  const clearExisting =
    String(formData.get("clear_existing") || "") === "yes";

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
        // ignore duplicates
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

async function runWinnerDrawAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  const selectedPrize = parsePrizeSelection(
    formData.get("selected_prize"),
  );

  const allowMultipleWinnersPerTable =
    String(formData.get("allow_multiple_winners_per_table") || "") === "yes";

  const maxWinnersPerTable = Math.max(
    1,
    positiveInteger(formData.get("max_winners_per_table"), 1),
  );

  if (!eventId || !selectedPrize) {
    redirect(`/admin/events/${eventId}?error=missing-draw-data#admin-tools`);
  }

  const event = await requireEventAccess(eventId);

  const existingWinners = await listEventWinners(eventId);

  const existingWinningSeatIds = new Set(
    existingWinners
      .map((winner) => winner.seat_id)
      .filter(Boolean),
  );

  const winnersPerTable = new Map<string, number>();

  for (const winner of existingWinners) {
    const tableNumber = String(winner.table_number || "").trim();

    if (!tableNumber) continue;

    winnersPerTable.set(
      tableNumber,
      (winnersPerTable.get(tableNumber) || 0) + 1,
    );
  }

  let candidates = await getEligibleEventDrawCandidates(eventId);

  candidates = candidates.filter(
    (candidate) => !existingWinningSeatIds.has(candidate.seat_id),
  );

  if (event.event_type === "tables" && !allowMultipleWinnersPerTable) {
    candidates = candidates.filter((candidate) => {
      const tableNumber = String(candidate.table_number || "").trim();

      if (!tableNumber) return true;

      return !winnersPerTable.has(tableNumber);
    });
  }

  if (event.event_type === "tables" && allowMultipleWinnersPerTable) {
    candidates = candidates.filter((candidate) => {
      const tableNumber = String(candidate.table_number || "").trim();

      if (!tableNumber) return true;

      return (winnersPerTable.get(tableNumber) || 0) < maxWinnersPerTable;
    });
  }

  const winner = chooseRandomCandidate(candidates);

  if (!winner) {
    redirect(`/admin/events/${eventId}?error=no-eligible-winner#admin-tools`);
  }

  await createEventWinner({
    eventId,
    prizeId: selectedPrize.id,
    prizeTitle: selectedPrize.title,
    prizePosition: selectedPrize.position,
    winnerName: winner.customer_name,
    winnerEmail: winner.customer_email,
    seatId: winner.seat_id,
    rowLabel: winner.row_label,
    seatNumber: winner.seat_number,
    tableNumber: winner.table_number,
    ticketTypeName: winner.ticket_type_name,
  });

  redirect(`/admin/events/${eventId}?saved=winner-drawn#admin-tools`);
}

async function deleteWinnerAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const winnerId = String(formData.get("winner_id") || "").trim();

  if (!eventId || !winnerId) {
    redirect(`/admin/events/${eventId}?error=missing-winner#admin-tools`);
  }

  await requireEventAccess(eventId);

  await deleteEventWinner(winnerId);

  redirect(`/admin/events/${eventId}?saved=winner-deleted#admin-tools`);
}

async function clearWinnersAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();

  if (!eventId) {
    redirect(`/admin/events?error=missing-event`);
  }

  await requireEventAccess(eventId);

  await clearEventWinners(eventId);

  redirect(`/admin/events/${eventId}?saved=winners-cleared#admin-tools`);
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
async function runWinnerDrawAction(formData: FormData) {
  "use server";

  const eventId = String(formData.get("event_id") || "").trim();
  const selectedPrize = parsePrizeSelection(formData.get("prize_key"));
  const drawScope = String(formData.get("draw_scope") || "all").trim();

  const maxWinnersPerTableRaw = positiveInteger(
    formData.get("max_winners_per_table"),
    0,
  );

  if (!eventId || !selectedPrize) {
    redirect(`/admin/events/${eventId}?error=missing-draw-data#winner-draw`);
  }

  const event = await requireEventAccess(eventId);

  const candidates = await getEligibleEventDrawCandidates({
    eventId,
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
  });

  const winner = chooseRandomCandidate(candidates);

  if (!winner) {
    redirect(`/admin/events/${eventId}?error=no-eligible-winner#winner-draw`);
  }

  await createEventWinner({
    tenantSlug: event.tenant_slug,
    eventId,
    prizeId: selectedPrize.id,
    prizeTitle: selectedPrize.title,
    prizePosition: selectedPrize.position,
    drawScope,
    drawSettings: {
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
    },
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

  redirect(`/admin/events/${eventId}?saved=winner-drawn#winner-draw`);
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
  const winners = await listEventWinners(event.id);

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
  const vipSeats = visibleSeats.filter((seat) => seat.seat_purpose === "vip").length;
  const complimentarySeats = visibleSeats.filter(
    (seat) => seat.seat_purpose === "complimentary",
  ).length;

  const uniqueTableNumbers = Array.from(
    new Set(
      tableSeats
        .map((seat) => String(seat.table_number || "").trim())
        .filter(Boolean),
    ),
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
        <a href="#winner-draw" style={styles.tab}>Winner Draw</a>
        <a href="#admin-tools" style={styles.tab}>Admin Tools</a>
        {isReservedSeating && <a href="#row-seating" style={styles.tab}>Row Seating</a>}
        {isTables && <a href="#table-seating" style={styles.tab}>Table Seating</a>}
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
          <SummaryCard label="Winners" value={winners.length} />
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
          <SummaryCard label="VIP" value={vipSeats} />
          <SummaryCard label="Complimentary" value={complimentarySeats} />
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

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>Current ticket types</h3>
                <p style={styles.sectionText}>
                  Compact list so the page does not keep stretching as you add tickets.
                </p>
              </div>
            </div>

            <div style={styles.ticketListScroll}>
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

                      <div style={styles.inlineActions}>
                        <button type="submit" style={styles.primaryButton}>
                          Save
                        </button>
                      </div>
                    </form>

                    <form action={deleteTicketTypeAction}>
                      <input type="hidden" name="event_id" value={event.id} />
                      <input type="hidden" name="ticket_type_id" value={ticketType.id} />
                      <button type="submit" style={styles.dangerOutlineButton}>
                        Delete
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>

            <form action={clearTicketTypesAction}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={styles.dangerOutlineButton}>
                Clear all ticket types
              </button>
            </form>
          </div>
        </div>
      </section>

      <EventPrizeMenuSettings
        eventId={event.id}
        initialPrizes={event.prizes_json || []}
        initialMenuOptions={event.menu_options || []}
        updatePrizesAction={updatePrizesAction}
        updateMenuOptionsAction={updateMenuOptionsAction}
      />

      <EventWinnerDrawPanel
        eventId={event.id}
        eventType={event.event_type}
        prizes={event.prizes_json || []}
        winners={winners}
        drawWinnerAction={runWinnerDrawAction}
        deleteWinnerAction={deleteWinnerAction}
        clearWinnersAction={clearWinnersAction}
      />

      {isReservedSeating && (
        <section id="row-seating" style={styles.section}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionEyebrow}>Section 3</p>
            <h2 style={styles.sectionTitle}>Row Seating</h2>
            <p style={styles.sectionText}>
              Generate seats first. Use Seat Manager to mark special seats, block
              seats, and save row layout nudges.
            </p>
          </div>

          <div style={styles.twoPanel}>
            <form action={generateSeatsAction} style={styles.panel}>
              <input type="hidden" name="event_id" value={event.id} />

              <h3 style={styles.panelTitle}>Generate row seating</h3>

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
                <input name="rows" placeholder="1-10 or A-C or 1-3,8-10" style={styles.input} />
              </Field>

              <div style={styles.twoCol}>
                <Field label="Seats per row">
                  <input name="seats_per_row" type="number" min="1" placeholder="40" style={styles.input} />
                </Field>

                <Field label="Aisles after seats">
                  <input name="aisle_after" placeholder="10,20,30" style={styles.input} />
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
                <SummaryCard label="Normal public" value={rowSeats.filter((seat) => !seat.ticket_type_id && seat.status === "available").length} />
                <SummaryCard label="Special marked" value={rowSeats.filter((seat) => seat.ticket_type_id).length} />
                <SummaryCard label="VIP" value={rowSeats.filter((seat) => seat.seat_purpose === "vip").length} />
                <SummaryCard label="Complimentary" value={rowSeats.filter((seat) => seat.seat_purpose === "complimentary").length} />
                <SummaryCard label="Blocked" value={rowSeats.filter((seat) => seat.status === "blocked").length} />
                <SummaryCard label="Sold" value={rowSeats.filter((seat) => seat.status === "sold").length} />
              </div>

              <p style={styles.sectionText}>
                Row nudges are saved to this event, so the public page can match
                the admin layout.
              </p>
            </div>
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>Seat Manager</h3>
                <p style={styles.sectionText}>
                  Click seats to select them. Block/unblock selected seats,
                  apply special markings, or save admin-only seat allocation details.
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
                updateSelectedSeatsMetadataAction={updateSelectedSeatsMetadataAction}
                updateSelectedSeatsStatusAction={updateSelectedSeatsStatusAction}
                updateSeatingLayoutAction={updateSeatingLayoutAction}
                deleteSelectedSeatsAction={deleteSelectedSeatsAction}
                deleteSelectedRowsAction={deleteSelectedRowsAction}
                initialSeatingLayout={event.seating_layout_json || {}}
              />
            )}
          </div>
        </section>
      )}

      {isTables && (
        <section id="table-seating" style={styles.section}>
          <div style={styles.sectionHeader}>
            <p style={styles.sectionEyebrow}>Section 3</p>
            <h2 style={styles.sectionTitle}>Table Seating</h2>
            <p style={styles.sectionText}>
              Generate table layouts first, then name tables before publishing.
            </p>
          </div>

          <div style={styles.twoPanel}>
            <form action={generateTablesAction} style={styles.panel}>
              <input type="hidden" name="event_id" value={event.id} />

              <h3 style={styles.panelTitle}>Generate table seating</h3>

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

              <div style={styles.twoCol}>
                <Field label="Number of tables">
                  <input name="table_count" type="number" min="1" placeholder="10" style={styles.input} />
                </Field>

                <Field label="Seats per table">
                  <input name="seats_per_table" type="number" min="1" placeholder="8" style={styles.input} />
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
                <SummaryCard label="Tables" value={uniqueTableNumbers.length} />
                <SummaryCard label="Named tables" value={Object.keys(event.table_names_json || {}).length} />
                <SummaryCard label="VIP" value={tableSeats.filter((seat) => seat.seat_purpose === "vip").length} />
                <SummaryCard label="Complimentary" value={tableSeats.filter((seat) => seat.seat_purpose === "complimentary").length} />
                <SummaryCard label="Blocked" value={tableSeats.filter((seat) => seat.status === "blocked").length} />
                <SummaryCard label="Sold" value={tableSeats.filter((seat) => seat.status === "sold").length} />
              </div>

              <p style={styles.sectionText}>
                Named tables show on the public page. Buyers no longer type table names.
              </p>
            </div>
          </div>

          <form action={updateTableNamesAction} style={styles.panel}>
            <input type="hidden" name="event_id" value={event.id} />

            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>Table names</h3>
                <p style={styles.sectionText}>
                  Add friendly names such as Sponsors, VIP, Smith Family, or Staff.
                </p>
              </div>

              <button type="submit" style={styles.primaryButton}>
                Save table names
              </button>
            </div>

            <TableNamesEditor
              tableNumbers={uniqueTableNumbers}
              initialTableNames={
                uniqueTableNumbers.length > 0
                  ? tableNamesFromExistingTables
                  : event.table_names_json || {}
              }
            />
          </form>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div>
                <h3 style={styles.panelTitle}>Seat Manager</h3>
                <p style={styles.sectionText}>
                  Click table seats to select them. Block/unblock selected seats,
                  apply special markings, or save admin-only seat allocation details.
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
                updateSelectedSeatsMetadataAction={updateSelectedSeatsMetadataAction}
                updateSelectedSeatsStatusAction={updateSelectedSeatsStatusAction}
                deleteSelectedSeatsAction={deleteSelectedSeatsAction}
              />
            )}
          </div>
        </section>
      )}

      <section id="admin-tools" style={styles.section}>
        <div style={styles.sectionHeader}>
          <p style={styles.sectionEyebrow}>Admin tools</p>
          <h2 style={styles.sectionTitle}>Event Admin Tools</h2>
          <p style={styles.sectionText}>
            Premium event controls live here as we add them safely.
          </p>
        </div>

        <div style={styles.adminToolsGrid}>
          <EventAdminToolCard
            icon="🎫"
            title="Tickets & pricing"
            badge="Active"
            description="Manage public ticket types, pricing, limits, and visibility."
            href="#tickets"
            actionLabel="Manage tickets"
          />

          <EventAdminToolCard
            icon="🏆"
            title="Prizes & menu"
            badge="Active"
            description="Manage event prizes, public prize visibility, menu choices, and guest questions."
            href="#prizes"
            actionLabel="Manage prizes"
          />

          <EventAdminToolCard
            icon="🎯"
            title="Winner draw"
            badge="Active"
            description="Draw event winners from eligible paid event entries and keep history."
            href="#winner-draw"
            actionLabel="Open draw"
          />

          {(isReservedSeating || isTables) && (
            <EventAdminToolCard
              icon="🪑"
              title="Seat tools"
              badge="Active"
              description="Generate seats, block seats, apply special markings, and save guest allocation details."
              href={isReservedSeating ? "#row-seating" : "#table-seating"}
              actionLabel="Manage seats"
            />
          )}

          <EventAdminToolCard
            icon="✉️"
            title="Winner emails"
            badge="Coming next"
            description="Send winner notification emails and store event winner email history."
            actionLabel="Planned"
            muted
          />

          <EventAdminToolCard
            icon="📦"
            title="Orders dashboard"
            badge="Later"
            description="A proper event orders dashboard will be added after draw tools are stable."
            actionLabel="Planned"
            muted
          />
        </div>
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

function EventAdminToolCard({
  icon,
  title,
  badge,
  description,
  href,
  actionLabel,
  muted = false,
}: {
  icon: string;
  title: string;
  badge: string;
  description: string;
  href?: string;
  actionLabel: string;
  muted?: boolean;
}) {
  return (
    <div style={styles.adminToolCard}>
      <div style={styles.adminToolTitleRow}>
        <span style={styles.adminToolIcon}>{icon}</span>
        <span style={styles.adminToolBadge}>{badge}</span>
      </div>

      <h3 style={styles.panelTitle}>{title}</h3>
      <p style={styles.sectionText}>{description}</p>

      {href && !muted ? (
        <a href={href} style={styles.adminToolButton}>
          {actionLabel}
        </a>
      ) : (
        <span style={styles.mutedToolButton}>{actionLabel}</span>
      )}
    </div>
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
    display: "grid",
    gap: 14,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
  },
  twoPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  ticketLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(320px, 1.4fr)",
    gap: 16,
    alignItems: "start",
  },
  ticketListScroll: {
    display: "grid",
    gap: 10,
    maxHeight: 520,
    overflow: "auto",
    paddingRight: 4,
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
  },
  inlineActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
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
  adminToolsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
  },
  adminToolCard: {
    display: "grid",
    gap: 10,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  adminToolTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  adminToolIcon: {
    width: 42,
    height: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    fontSize: 22,
  },
  adminToolBadge: {
    padding: "5px 9px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#075985",
    fontSize: 12,
    fontWeight: 900,
  },
  adminToolButton: {
    width: "fit-content",
    marginTop: 4,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  mutedToolButton: {
    width: "fit-content",
    marginTop: 4,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#e2e8f0",
    color: "#64748b",
    fontWeight: 900,
    fontSize: 14,
  },
  dangerSection: {
    padding: 18,
    borderRadius: 22,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
};
