import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  createEvent,
  createEventSeat,
  createEventTicketType,
  type EventPrize,
  type EventStatus,
  type EventType,
} from "../../../../../api/_lib/events-repo";

type TicketTypeInput = {
  id?: string;
  name?: string;
  description?: string;
  price?: string | number;
  capacity?: string | number | null;
  sort_order?: string | number;
  is_active?: boolean;
};

type SeatingConfigInput = {
  section?: string;
  rows?: string;
  seats_per_row?: string | number;
  aisle_after?: string;
  ticket_type_id?: string;
};

type TableConfigInput = {
  table_count?: string | number;
  seats_per_table?: string | number;
  ticket_type_id?: string;
};

type TenantSettingsWithTier = {
  subscription_tier?: string | null;
  subscriptionTier?: string | null;
};

function positiveInteger(
  value: FormDataEntryValue | string | number | null,
  fallback = 0,
) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function cleanImageFocus(value: FormDataEntryValue | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function moneyToCents(value: string | number | null | undefined) {
  const number = Number(String(value || "0").replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

function cleanEventType(value: FormDataEntryValue | null): EventType {
  const eventType = String(value || "general_admission").trim();

  if (
    eventType === "general_admission" ||
    eventType === "reserved_seating" ||
    eventType === "tables"
  ) {
    return eventType;
  }

  return "general_admission";
}

function cleanStatus(value: FormDataEntryValue | null): EventStatus {
  const status = String(value || "draft").trim();

  if (status === "draft" || status === "published" || status === "closed") {
    return status;
  }

  return "draft";
}

function optionalDate(value: FormDataEntryValue | null) {
  const clean = String(value || "").trim();

  if (!clean) return null;

  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseJsonArray<T>(value: FormDataEntryValue | null): T[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends Record<string, unknown>>(
  value: FormDataEntryValue | null,
): T | null {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : null;
  } catch {
    return null;
  }
}

function parseTableNames(value: FormDataEntryValue | null): Record<string, string> {
  const parsed = parseJsonObject<Record<string, unknown>>(value);

  if (!parsed) return {};

  return Object.fromEntries(
    Object.entries(parsed)
      .map(([key, rawValue]) => [String(key), String(rawValue || "").trim()])
      .filter(([, name]) => name),
  );
}

function parseAisleAfterList(value: string | undefined) {
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

function localTicketIdToCreatedId(
  localId: string | undefined,
  ticketTypeIdMap: Map<string, string>,
) {
  if (!localId || localId === "__normal__") return null;
  return ticketTypeIdMap.get(localId) || null;
}

function getSubscriptionTier(settings: TenantSettingsWithTier | null | undefined) {
  return String(
    settings?.subscription_tier || settings?.subscriptionTier || "community",
  )
    .trim()
    .toLowerCase();
}

async function getPublishedEventCountForTenant(tenantSlug: string) {
  const rows = await query<{ active_count: string | number }>(
    `
      select count(*) as active_count
      from events
      where tenant_slug = $1
        and status = 'published'
    `,
    [tenantSlug],
  );

  return Number(rows[0]?.active_count || 0);
}

async function communityPublishedEventLimitReached(tenantSlug: string) {
  const tenantSettings = await getTenantSettings(tenantSlug);
  const subscriptionTier = getSubscriptionTier(tenantSettings);

  if (subscriptionTier !== "community") {
    return false;
  }

  const activePublishedEventCount =
    await getPublishedEventCountForTenant(tenantSlug);

  return activePublishedEventCount >= 1;
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const formData = await request.formData();

  const tenantSlug = String(formData.get("tenantSlug") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const eventType = cleanEventType(formData.get("event_type"));
  const status = cleanStatus(formData.get("status"));

  if (!tenantSlug || !title || !slug) {
    return NextResponse.redirect(
      new URL("/admin/events/new?error=missing-required", request.url),
    );
  }

  try {
    if (
      status === "published" &&
      (await communityPublishedEventLimitReached(tenantSlug))
    ) {
      return NextResponse.redirect(
        new URL("/admin/events/new?error=campaign-limit", request.url),
      );
    }

    const prizes = parseJsonArray<EventPrize>(formData.get("prizes"));
    const ticketTypes = parseJsonArray<TicketTypeInput>(
      formData.get("ticket_types"),
    );
    const rowSeating = parseJsonObject<SeatingConfigInput>(
      formData.get("row_seating"),
    );
    const tableSeating = parseJsonObject<TableConfigInput>(
      formData.get("table_seating"),
    );
    const tableNamesJson = parseTableNames(formData.get("table_names_json"));

    const event = await createEvent({
      tenantSlug,
      title,
      slug,
      description: String(formData.get("description") || "").trim() || null,
      imageUrl: String(formData.get("image_url") || "").trim() || null,
      imageFocusX: cleanImageFocus(formData.get("image_focus_x")),
      imageFocusY: cleanImageFocus(formData.get("image_focus_y")),
      location: String(formData.get("location") || "").trim() || null,
      startsAt: optionalDate(formData.get("starts_at")),
      endsAt: optionalDate(formData.get("ends_at")),
      capacity: positiveInteger(formData.get("capacity"), 0) || null,
      currency: String(formData.get("currency") || "GBP").trim() || "GBP",
      eventType,
      status,
      prizesJson: prizes,
      tableNamesJson,
      seatingLayoutJson: {},
      menuOptions: [],
      askDietaryRequirements: true,
      askMenuChoice: true,
    });

    const ticketTypeIdMap = new Map<string, string>();

    for (const ticketType of ticketTypes) {
      const name = String(ticketType.name || "").trim();
      if (!name) continue;

      const createdTicketType = await createEventTicketType({
        eventId: event.id,
        name,
        description: String(ticketType.description || "").trim() || null,
        price: moneyToCents(ticketType.price),
        capacity: positiveInteger(ticketType.capacity ?? null, 0) || null,
        sortOrder: positiveInteger(ticketType.sort_order ?? 0, 0),
        isActive: ticketType.is_active !== false,
      });

      if (ticketType.id) {
        ticketTypeIdMap.set(String(ticketType.id), createdTicketType.id);
      }
    }

    if (eventType === "reserved_seating" && rowSeating) {
      const rowsRaw = String(rowSeating.rows || "").trim();
      const seatsPerRow = positiveInteger(rowSeating.seats_per_row ?? null, 0);
      const section = String(rowSeating.section || "").trim();
      const aisleAfterList = parseAisleAfterList(rowSeating.aisle_after);
      const ticketTypeId = localTicketIdToCreatedId(
        rowSeating.ticket_type_id,
        ticketTypeIdMap,
      );

      if (rowsRaw && seatsPerRow > 0) {
        const rows = expandRows(rowsRaw);

        for (const row of rows) {
          for (let seat = 1; seat <= seatsPerRow; seat += 1) {
            try {
              await createEventSeat({
                eventId: event.id,
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
      }
    }

    if (eventType === "tables" && tableSeating) {
      const tableCount = positiveInteger(tableSeating.table_count ?? null, 0);
      const seatsPerTable = positiveInteger(
        tableSeating.seats_per_table ?? null,
        0,
      );
      const ticketTypeId = localTicketIdToCreatedId(
        tableSeating.ticket_type_id,
        ticketTypeIdMap,
      );

      if (tableCount > 0 && seatsPerTable > 0) {
        for (let table = 1; table <= tableCount; table += 1) {
          for (let seat = 1; seat <= seatsPerTable; seat += 1) {
            try {
              await createEventSeat({
                eventId: event.id,
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
      }
    }

    return NextResponse.redirect(
      new URL(`/admin/events/${event.id}?saved=created`, request.url),
    );
  } catch (error) {
    console.error("Create event failed", error);

    return NextResponse.redirect(
      new URL("/admin/events/new?error=create-failed", request.url),
    );
  }
}
