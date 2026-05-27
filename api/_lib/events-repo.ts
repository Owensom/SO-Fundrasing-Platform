import { query, queryOne } from "@/lib/db";

export type EventType = "general_admission" | "reserved_seating" | "tables";
export type EventSubtype = "standard" | "quiz_night";
export type EventStatus = "draft" | "published" | "closed";
export type EventSeatStatus = "available" | "reserved" | "sold" | "blocked";

export type SeatingLayoutJson = Record<string, number>;
export type TableNamesJson = Record<string, string>;

export type EventFundraisingAddOnType = "heads_or_tails" | "higher_or_lower";

export type EventFundraisingAddOn = {
  id: string;
  type: EventFundraisingAddOnType;
  enabled: boolean;
  title: string;
  description?: string;
  instructions?: string;
  prizeTitle?: string;
  entryPriceCents?: number;
  collectAtCheckout?: boolean;
  maxEntriesPerBooking?: number | null;
  sortOrder?: number;
};

export type EventTicketType = {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  capacity: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type EventSeat = {
  id: string;
  event_id: string;
  ticket_type_id: string | null;
  seat_purpose: string | null;
  admin_label: string | null;
  admin_note: string | null;
  guest_name: string | null;
  guest_email: string | null;
  dietary_requirements: string | null;
  menu_choice: string | null;
  section: string | null;
  row_label: string | null;
  seat_number: string | null;
  table_number: string | null;
  aisle_after: number | null;
  status: EventSeatStatus;
  customer_name: string | null;
  customer_email: string | null;
  stripe_session_id: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EventPrize = {
  id?: string;
  position?: number;
  title?: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
  sortOrder?: number;
  sort_order?: number;
};

export type EventMenuOption = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  isActive?: boolean;
  is_active?: boolean;
  sortOrder?: number;
  sort_order?: number;
};

export type EventItem = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_focus_x: number;
  image_focus_y: number;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  currency: string;
  event_type: EventType;
  event_subtype: EventSubtype;
  status: EventStatus;
  capacity: number | null;
  prizes_json: EventPrize[];
  menu_options: EventMenuOption[];
  seating_layout_json: SeatingLayoutJson;
  table_names_json: TableNamesJson;
  event_addons_json: EventFundraisingAddOn[];
  ask_dietary_requirements: boolean;
  ask_menu_choice: boolean;
  created_at: string;
  updated_at: string;
  ticket_types?: EventTicketType[];
  seats?: EventSeat[];
};

export type EventOrder = {
  id: string;
  tenant_slug: string;
  event_id: string;
  stripe_session_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_total: number;
  currency: string;
  status: string;
  created_at: string;
};

export type EventOrderItem = {
  id: string;
  order_id: string;
  event_id: string;
  ticket_type_id: string | null;
  seat_id: string | null;
  label: string;
  quantity: number;
  unit_amount: number;
  guest_name: string | null;
  dietary_requirements: string | null;
  menu_choice: string | null;
  created_at: string;
};

export type EventWinner = {
  id: string;
  tenant_slug: string;
  event_id: string;
  prize_id: string | null;
  prize_title: string;
  prize_position: number | null;
  draw_scope: string;
  draw_settings: Record<string, unknown>;
  event_order_id: string | null;
  event_order_item_id: string | null;
  event_seat_id: string | null;
  ticket_type_id: string | null;
  table_number: string | null;
  row_label: string | null;
  seat_number: string | null;
  winner_name: string | null;
  winner_email: string | null;
  status: string;
  drawn_at: string;
  created_at: string;
};

export type EventDrawCandidate = {
  event_order_id: string | null;
  event_order_item_id: string | null;
  event_seat_id: string | null;
  ticket_type_id: string | null;
  table_number: string | null;
  row_label: string | null;
  seat_number: string | null;
  winner_name: string | null;
  winner_email: string | null;
  seat_purpose: string | null;
};

export type CreateEventInput = {
  tenantSlug: string;
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  currency?: string;
  eventType?: EventType;
  eventSubtype?: EventSubtype;
  status?: EventStatus;
  capacity?: number | null;
  prizesJson?: EventPrize[];
  menuOptions?: EventMenuOption[];
  seatingLayoutJson?: SeatingLayoutJson;
  tableNamesJson?: TableNamesJson;
  eventAddOnsJson?: EventFundraisingAddOn[];
  askDietaryRequirements?: boolean;
  askMenuChoice?: boolean;
};

export type UpdateEventInput = {
  slug?: string;
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  currency?: string;
  eventType?: EventType;
  eventSubtype?: EventSubtype;
  status?: EventStatus;
  capacity?: number | null;
  prizesJson?: EventPrize[];
  menuOptions?: EventMenuOption[];
  seatingLayoutJson?: SeatingLayoutJson;
  tableNamesJson?: TableNamesJson;
  eventAddOnsJson?: EventFundraisingAddOn[];
  askDietaryRequirements?: boolean;
  askMenuChoice?: boolean;
};

const EVENT_FUNDRAISING_ADD_ON_DEFAULTS: Record<
  EventFundraisingAddOnType,
  {
    title: string;
    description: string;
    instructions: string;
  }
> = {
  heads_or_tails: {
    title: "Heads or Tails",
    description:
      "Join our Heads or Tails fundraiser on the night and keep playing until one winner remains.",
    instructions:
      "Choose heads or tails each round. Stay standing if you are correct. The last person standing wins.",
  },
  higher_or_lower: {
    title: "Higher or Lower",
    description:
      "Join our Higher or Lower fundraiser on the night and see how long you can stay in the game.",
    instructions:
      "Guess whether the next card, number or total will be higher or lower. Keep playing while you are correct.",
  },
};

function normaliseEventType(value: string | null | undefined): EventType {
  if (value === "reserved_seating" || value === "tables") return value;
  return "general_admission";
}

function normaliseEventSubtype(value: string | null | undefined): EventSubtype {
  if (value === "quiz_night") return "quiz_night";
  return "standard";
}

function normaliseStatus(value: string | null | undefined): EventStatus {
  if (value === "published" || value === "closed") return value;
  return "draft";
}

function normaliseSeatStatus(
  value: string | null | undefined,
): EventSeatStatus {
  if (value === "reserved" || value === "sold" || value === "blocked") {
    return value;
  }

  return "available";
}

function normaliseSeatPurpose(
  value: string | null | undefined,
): string | null {
  const clean = String(value || "").trim();

  if (
    clean === "vip" ||
    clean === "complimentary" ||
    clean === "staff" ||
    clean === "sponsor" ||
    clean === "guest" ||
    clean === "blocked" ||
    clean === "other"
  ) {
    return clean;
  }

  return null;
}

function normaliseNullableText(
  value: string | null | undefined,
): string | null {
  const clean = String(value || "").trim();
  return clean || null;
}

function normaliseImageFocus(value: number | null | undefined): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normaliseNonNegativeInteger(
  value: number | string | null | undefined,
  fallback = 0,
): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.floor(number);
}

function normaliseNullablePositiveInteger(
  value: number | string | null | undefined,
): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.floor(number);
}

function normaliseEventFundraisingAddOnType(
  value: string | null | undefined,
): EventFundraisingAddOnType | null {
  if (value === "heads_or_tails" || value === "higher_or_lower") {
    return value;
  }

  return null;
}

function normaliseSeatingLayoutJson(value: unknown): SeatingLayoutJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]) => {
        const number = Number(rawValue);

        if (!Number.isFinite(number)) {
          return null;
        }

        return [String(key), Math.max(-20, Math.min(20, Math.floor(number)))];
      })
      .filter(Boolean) as [string, number][],
  );
}

function normaliseTableNamesJson(value: unknown): TableNamesJson {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]) => [String(key), String(rawValue || "").trim()])
      .filter(([, name]) => name),
  );
}

function normalisePrizesJson(value: unknown): EventPrize[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const prize = item as EventPrize;

      const title = String(prize.title || prize.name || "").trim();

      if (!title) {
        return null;
      }

      const rawPosition = Number(prize.position);

      const position =
        Number.isFinite(rawPosition) && rawPosition > 0
          ? Math.floor(rawPosition)
          : index + 1;

      return {
        id: String(prize.id || `prize-${index + 1}`),
        position,
        title,
        name: title,
        description: String(prize.description || "").trim(),
        isPublic: prize.isPublic ?? prize.is_public ?? true,
        is_public: prize.is_public ?? prize.isPublic ?? true,
        sortOrder: prize.sortOrder ?? prize.sort_order ?? index,
        sort_order: prize.sort_order ?? prize.sortOrder ?? index,
      };
    })
    .filter(Boolean) as EventPrize[];
}

function normaliseMenuOptions(value: unknown): EventMenuOption[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const option = item as EventMenuOption;

      const name = String(option.name || option.title || "").trim();

      if (!name) {
        return null;
      }

      return {
        id: String(option.id || `menu-${index + 1}`),
        name,
        title: name,
        description: String(option.description || "").trim(),
        isActive: option.isActive ?? option.is_active ?? true,
        is_active: option.is_active ?? option.isActive ?? true,
        sortOrder: option.sortOrder ?? option.sort_order ?? index,
        sort_order: option.sort_order ?? option.sortOrder ?? index,
      };
    })
    .filter(Boolean) as EventMenuOption[];
}

function normaliseEventFundraisingAddOnsJson(
  value: unknown,
): EventFundraisingAddOn[] {
  if (!Array.isArray(value)) return [];

  const addOns: EventFundraisingAddOn[] = [];

  value.forEach((item, index) => {
    const addOn = item as Partial<EventFundraisingAddOn>;
    const type = normaliseEventFundraisingAddOnType(
      String(addOn.type || "").trim(),
    );

    if (!type) {
      return;
    }

    const defaults = EVENT_FUNDRAISING_ADD_ON_DEFAULTS[type];
    const title = String(addOn.title || defaults.title).trim();

    addOns.push({
      id: String(addOn.id || `event-addon-${type}-${index + 1}`),
      type,
      enabled: Boolean(addOn.enabled),
      title: title || defaults.title,
      description: String(addOn.description || defaults.description).trim(),
      instructions: String(addOn.instructions || defaults.instructions).trim(),
      prizeTitle: String(addOn.prizeTitle || "").trim(),
      entryPriceCents: normaliseNonNegativeInteger(addOn.entryPriceCents, 0),
      collectAtCheckout: Boolean(addOn.collectAtCheckout),
      maxEntriesPerBooking: normaliseNullablePositiveInteger(
        addOn.maxEntriesPerBooking,
      ),
      sortOrder: normaliseNonNegativeInteger(addOn.sortOrder, index),
    });
  });

  return addOns.sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0),
  );
}

function normaliseEvent(event: EventItem): EventItem {
  return {
    ...event,
    event_type: normaliseEventType(event.event_type),
    event_subtype: normaliseEventSubtype(event.event_subtype),
    image_focus_x: normaliseImageFocus(event.image_focus_x),
    image_focus_y: normaliseImageFocus(event.image_focus_y),
    prizes_json: normalisePrizesJson(event.prizes_json),
    menu_options: normaliseMenuOptions(event.menu_options),
    seating_layout_json: normaliseSeatingLayoutJson(event.seating_layout_json),
    table_names_json: normaliseTableNamesJson(event.table_names_json),
    event_addons_json: normaliseEventFundraisingAddOnsJson(
      event.event_addons_json,
    ),
    ask_dietary_requirements: event.ask_dietary_requirements ?? true,
    ask_menu_choice: event.ask_menu_choice ?? true,
  };
}

export function slugifyEventTitle(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `event-${Date.now()}`;
}

async function assertEventExists(eventId: string) {
  const event = await queryOne<{ id: string }>(
    `
      select id
      from events
      where id = $1
      limit 1
    `,
    [eventId],
  );

  if (!event) {
    throw new Error("Event not found");
  }
}

async function assertTicketTypeBelongsToEvent(
  eventId: string,
  ticketTypeId: string | null | undefined,
) {
  if (!ticketTypeId) return;

  const ticketType = await queryOne<{ id: string }>(
    `
      select id
      from event_ticket_types
      where id = $1
        and event_id = $2
      limit 1
    `,
    [ticketTypeId, eventId],
  );

  if (!ticketType) {
    throw new Error("Ticket type does not belong to this event");
  }
}

/* =========================
   EVENTS
========================= */

export async function listEvents(tenantSlug: string): Promise<EventItem[]> {
  const events = await query<EventItem>(
    `
      select *
      from events
      where tenant_slug = $1
      order by created_at desc
    `,
    [tenantSlug],
  );

  return events.map(normaliseEvent);
}

export async function listPublishedEvents(
  tenantSlug: string,
): Promise<EventItem[]> {
  const events = await query<EventItem>(
    `
      select *
      from events
      where tenant_slug = $1
        and status = 'published'
      order by starts_at asc nulls last, created_at desc
    `,
    [tenantSlug],
  );

  return events.map(normaliseEvent);
}

export async function hydrateEvent(event: EventItem): Promise<EventItem> {
  const [ticketTypes, seats] = await Promise.all([
    listEventTicketTypes(event.id),
    listEventSeats(event.id),
  ]);

  return {
    ...normaliseEvent(event),
    ticket_types: ticketTypes,
    seats,
  };
}

export async function getEventById(id: string): Promise<EventItem | null> {
  const event = await queryOne<EventItem>(
    `
      select *
      from events
      where id = $1
      limit 1
    `,
    [id],
  );

  if (!event) {
    return null;
  }

  return hydrateEvent(event);
}

export async function getEventBySlug(
  tenantSlug: string,
  slug: string,
): Promise<EventItem | null> {
  const event = await queryOne<EventItem>(
    `
      select *
      from events
      where tenant_slug = $1
        and slug = $2
      limit 1
    `,
    [tenantSlug, slug],
  );

  if (!event) {
    return null;
  }

  return hydrateEvent(event);
}

export async function createEvent(input: CreateEventInput): Promise<EventItem> {
  const created = await queryOne<EventItem>(
    `
      insert into events (
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        image_focus_x,
        image_focus_y,
        location,
        starts_at,
        ends_at,
        currency,
        event_type,
        event_subtype,
        status,
        capacity,
        prizes_json,
        menu_options,
        seating_layout_json,
        table_names_json,
        event_addons_json,
        ask_dietary_requirements,
        ask_menu_choice
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,
        $18::jsonb,$19::jsonb,$20::jsonb,$21,$22
      )
      returning *
    `,
    [
      input.tenantSlug,
      input.slug,
      input.title,
      input.description ?? null,
      input.imageUrl ?? null,
      normaliseImageFocus(input.imageFocusX),
      normaliseImageFocus(input.imageFocusY),
      input.location ?? null,
      input.startsAt || null,
      input.endsAt || null,
      input.currency || "GBP",
      normaliseEventType(input.eventType),
      normaliseEventSubtype(input.eventSubtype),
      normaliseStatus(input.status),
      input.capacity ?? null,
      JSON.stringify(normalisePrizesJson(input.prizesJson ?? [])),
      JSON.stringify(normaliseMenuOptions(input.menuOptions ?? [])),
      JSON.stringify(normaliseSeatingLayoutJson(input.seatingLayoutJson ?? {})),
      JSON.stringify(normaliseTableNamesJson(input.tableNamesJson ?? {})),
      JSON.stringify(
        normaliseEventFundraisingAddOnsJson(input.eventAddOnsJson ?? []),
      ),
      input.askDietaryRequirements ?? true,
      input.askMenuChoice ?? true,
    ],
  );

  if (!created) {
    throw new Error("Failed to create event");
  }

  return hydrateEvent(created);
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput,
): Promise<EventItem | null> {
  const existing = await getEventById(id);

  if (!existing) {
    return null;
  }

  const updated = await queryOne<EventItem>(
    `
      update events
      set
        slug = $2,
        title = $3,
        description = $4,
        image_url = $5,
        image_focus_x = $6,
        image_focus_y = $7,
        location = $8,
        starts_at = $9,
        ends_at = $10,
        currency = $11,
        event_type = $12,
        event_subtype = $13,
        status = $14,
        capacity = $15,
        prizes_json = $16::jsonb,
        menu_options = $17::jsonb,
        seating_layout_json = $18::jsonb,
        table_names_json = $19::jsonb,
        event_addons_json = $20::jsonb,
        ask_dietary_requirements = $21,
        ask_menu_choice = $22,
        updated_at = now()
      where id = $1
      returning *
    `,
    [
      id,
      input.slug ?? existing.slug,
      input.title ?? existing.title,
      input.description ?? existing.description,
      input.imageUrl ?? existing.image_url,
      normaliseImageFocus(input.imageFocusX ?? existing.image_focus_x),
      normaliseImageFocus(input.imageFocusY ?? existing.image_focus_y),
      input.location ?? existing.location,
      input.startsAt ?? existing.starts_at,
      input.endsAt ?? existing.ends_at,
      input.currency ?? existing.currency,
      normaliseEventType(input.eventType ?? existing.event_type),
      normaliseEventSubtype(input.eventSubtype ?? existing.event_subtype),
      normaliseStatus(input.status ?? existing.status),
      input.capacity ?? existing.capacity,
      JSON.stringify(
        normalisePrizesJson(input.prizesJson ?? existing.prizes_json ?? []),
      ),
      JSON.stringify(
        normaliseMenuOptions(input.menuOptions ?? existing.menu_options ?? []),
      ),
      JSON.stringify(
        normaliseSeatingLayoutJson(
          input.seatingLayoutJson ?? existing.seating_layout_json ?? {},
        ),
      ),
      JSON.stringify(
        normaliseTableNamesJson(
          input.tableNamesJson ?? existing.table_names_json ?? {},
        ),
      ),
      JSON.stringify(
        normaliseEventFundraisingAddOnsJson(
          input.eventAddOnsJson ?? existing.event_addons_json ?? [],
        ),
      ),
      input.askDietaryRequirements ?? existing.ask_dietary_requirements ?? true,
      input.askMenuChoice ?? existing.ask_menu_choice ?? true,
    ],
  );

  if (!updated) {
    return null;
  }

  return hydrateEvent(updated);
}

/* =========================
   TICKET TYPES
========================= */

export async function listEventTicketTypes(
  eventId: string,
): Promise<EventTicketType[]> {
  return query<EventTicketType>(
    `
      select *
      from event_ticket_types
      where event_id = $1
      order by sort_order asc, created_at asc
    `,
    [eventId],
  );
}

export async function createEventTicketType(input: {
  eventId: string;
  name: string;
  description?: string | null;
  price: number;
  capacity?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<EventTicketType> {
  await assertEventExists(input.eventId);

  const created = await queryOne<EventTicketType>(
    `
      insert into event_ticket_types (
        event_id,
        name,
        description,
        price,
        capacity,
        sort_order,
        is_active
      )
      values ($1,$2,$3,$4,$5,$6,$7)
      returning *
    `,
    [
      input.eventId,
      input.name,
      input.description ?? null,
      input.price,
      input.capacity ?? null,
      input.sortOrder ?? 0,
      input.isActive ?? true,
    ],
  );

  if (!created) {
    throw new Error("Failed to create event ticket type");
  }

  return created;
}

export async function updateEventTicketType(
  eventId: string,
  id: string,
  input: {
    name: string;
    description?: string | null;
    price: number;
    capacity?: number | null;
    sortOrder?: number;
    isActive?: boolean;
  },
): Promise<EventTicketType | null> {
  return queryOne<EventTicketType>(
    `
      update event_ticket_types
      set
        name = $3,
        description = $4,
        price = $5,
        capacity = $6,
        sort_order = $7,
        is_active = $8
      where event_id = $1
        and id = $2
      returning *
    `,
    [
      eventId,
      id,
      input.name,
      input.description ?? null,
      input.price,
      input.capacity ?? null,
      input.sortOrder ?? 0,
      input.isActive ?? true,
    ],
  );
}

export async function deleteEventTicketType(
  eventId: string,
  id: string,
): Promise<void> {
  await query(
    `
      delete from event_ticket_types
      where event_id = $1
        and id = $2
    `,
    [eventId, id],
  );
}

export async function deleteEventTicketTypes(eventId: string): Promise<void> {
  await query(
    `
      delete from event_ticket_types
      where event_id = $1
    `,
    [eventId],
  );
}

/* =========================
   SEATS / TABLE SEATS
========================= */

export async function listEventSeats(eventId: string): Promise<EventSeat[]> {
  return query<EventSeat>(
    `
      select *
      from event_seats
      where event_id = $1
      order by
        section asc nulls last,
        case
          when row_label ~ '^[0-9]+$'
          then row_label::int
          else null
        end asc nulls last,
        row_label asc nulls last,
        case
          when table_number ~ '^[0-9]+$'
          then table_number::int
          else null
        end asc nulls last,
        table_number asc nulls last,
        case
          when seat_number ~ '^[0-9]+$'
          then seat_number::int
          else null
        end asc nulls last,
        seat_number asc nulls last,
        created_at asc
    `,
    [eventId],
  );
}

export async function listAvailableEventSeats(
  eventId: string,
): Promise<EventSeat[]> {
  return query<EventSeat>(
    `
      select *
      from event_seats
      where event_id = $1
        and status = 'available'
      order by
        section asc nulls last,
        case
          when row_label ~ '^[0-9]+$'
          then row_label::int
          else null
        end asc nulls last,
        row_label asc nulls last,
        case
          when table_number ~ '^[0-9]+$'
          then table_number::int
          else null
        end asc nulls last,
        table_number asc nulls last,
        case
          when seat_number ~ '^[0-9]+$'
          then seat_number::int
          else null
        end asc nulls last,
        seat_number asc nulls last,
        created_at asc
    `,
    [eventId],
  );
}

export async function createEventSeat(input: {
  eventId: string;
  ticketTypeId?: string | null;
  seatPurpose?: string | null;
  adminLabel?: string | null;
  adminNote?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  dietaryRequirements?: string | null;
  menuChoice?: string | null;
  section?: string | null;
  rowLabel?: string | null;
  seatNumber?: string | null;
  tableNumber?: string | null;
  aisleAfter?: number | null;
  status?: EventSeatStatus;
}): Promise<EventSeat> {
  await assertEventExists(input.eventId);
  await assertTicketTypeBelongsToEvent(input.eventId, input.ticketTypeId);

  const created = await queryOne<EventSeat>(
    `
      insert into event_seats (
        event_id,
        ticket_type_id,
        seat_purpose,
        admin_label,
        admin_note,
        guest_name,
        guest_email,
        dietary_requirements,
        menu_choice,
        section,
        row_label,
        seat_number,
        table_number,
        aisle_after,
        status
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        $10,$11,$12,$13,$14,$15
      )
      returning *
    `,
    [
      input.eventId,
      input.ticketTypeId ?? null,
      normaliseSeatPurpose(input.seatPurpose),
      normaliseNullableText(input.adminLabel),
      normaliseNullableText(input.adminNote),
      normaliseNullableText(input.guestName),
      normaliseNullableText(input.guestEmail),
      normaliseNullableText(input.dietaryRequirements),
      normaliseNullableText(input.menuChoice),
      input.section ?? null,
      input.rowLabel ?? null,
      input.seatNumber ?? null,
      input.tableNumber ?? null,
      input.aisleAfter ?? null,
      normaliseSeatStatus(input.status),
    ],
  );

  if (!created) {
    throw new Error("Failed to create event seat");
  }

  return created;
}

export async function updateEventSeat(
  eventId: string,
  id: string,
  input: {
    ticketTypeId?: string | null;
    seatPurpose?: string | null;
    adminLabel?: string | null;
    adminNote?: string | null;
    guestName?: string | null;
    guestEmail?: string | null;
    dietaryRequirements?: string | null;
    menuChoice?: string | null;
    section?: string | null;
    rowLabel?: string | null;
    seatNumber?: string | null;
    tableNumber?: string | null;
    aisleAfter?: number | null;
    status?: EventSeatStatus;
    customerName?: string | null;
    customerEmail?: string | null;
  },
): Promise<EventSeat | null> {
  await assertTicketTypeBelongsToEvent(eventId, input.ticketTypeId);

  return queryOne<EventSeat>(
    `
      update event_seats
      set
        ticket_type_id = $3,
        seat_purpose = $4,
        admin_label = $5,
        admin_note = $6,
        guest_name = $7,
        guest_email = $8,
        dietary_requirements = $9,
        menu_choice = $10,
        section = $11,
        row_label = $12,
        seat_number = $13,
        table_number = $14,
        aisle_after = $15,
        status = $16,
        customer_name = $17,
        customer_email = $18,
        updated_at = now()
      where event_id = $1
        and id = $2
      returning *
    `,
    [
      eventId,
      id,
      input.ticketTypeId ?? null,
      normaliseSeatPurpose(input.seatPurpose),
      normaliseNullableText(input.adminLabel),
      normaliseNullableText(input.adminNote),
      normaliseNullableText(input.guestName),
      normaliseNullableText(input.guestEmail),
      normaliseNullableText(input.dietaryRequirements),
      normaliseNullableText(input.menuChoice),
      input.section ?? null,
      input.rowLabel ?? null,
      input.seatNumber ?? null,
      input.tableNumber ?? null,
      input.aisleAfter ?? null,
      normaliseSeatStatus(input.status),
      normaliseNullableText(input.customerName),
      normaliseNullableText(input.customerEmail),
    ],
  );
}

export async function updateEventSeatsTicketType(input: {
  eventId: string;
  seatIds: string[];
  ticketTypeId: string | null;
}): Promise<void> {
  if (input.seatIds.length === 0) return;

  await assertTicketTypeBelongsToEvent(input.eventId, input.ticketTypeId);

  await query(
    `
      update event_seats
      set
        ticket_type_id = $3,
        updated_at = now()
      where event_id = $1
        and id = any($2::uuid[])
    `,
    [input.eventId, input.seatIds, input.ticketTypeId],
  );
}

export async function updateEventSeatsMetadata(input: {
  eventId: string;
  seatIds: string[];
  seatPurpose?: string | null;
  adminLabel?: string | null;
  adminNote?: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  dietaryRequirements?: string | null;
  menuChoice?: string | null;
}): Promise<void> {
  if (input.seatIds.length === 0) return;

  await query(
    `
      update event_seats
      set
        seat_purpose = $3,
        admin_label = $4,
        admin_note = $5,
        guest_name = $6,
        guest_email = $7,
        dietary_requirements = $8,
        menu_choice = $9,
        updated_at = now()
      where event_id = $1
        and id = any($2::uuid[])
    `,
    [
      input.eventId,
      input.seatIds,
      normaliseSeatPurpose(input.seatPurpose),
      normaliseNullableText(input.adminLabel),
      normaliseNullableText(input.adminNote),
      normaliseNullableText(input.guestName),
      normaliseNullableText(input.guestEmail),
      normaliseNullableText(input.dietaryRequirements),
      normaliseNullableText(input.menuChoice),
    ],
  );
}

export async function updateEventSeatsStatus(input: {
  eventId: string;
  seatIds: string[];
  status: EventSeatStatus;
}): Promise<void> {
  if (input.seatIds.length === 0) return;

  await query(
    `
      update event_seats
      set
        status = $3,
        updated_at = now()
      where event_id = $1
        and id = any($2::uuid[])
        and status in ('available', 'blocked')
    `,
    [input.eventId, input.seatIds, normaliseSeatStatus(input.status)],
  );
}

export async function deleteEventSeat(
  eventId: string,
  id: string,
): Promise<void> {
  await query(
    `
      delete from event_seats
      where event_id = $1
        and id = $2
    `,
    [eventId, id],
  );
}

export async function deleteEventSeatsByIds(input: {
  eventId: string;
  seatIds: string[];
}): Promise<void> {
  if (input.seatIds.length === 0) return;

  await query(
    `
      delete from event_seats
      where event_id = $1
        and id = any($2::uuid[])
    `,
    [input.eventId, input.seatIds],
  );
}

export async function deleteEventRowsByKeys(input: {
  eventId: string;
  rowKeys: string[];
}): Promise<void> {
  if (input.rowKeys.length === 0) return;

  await query(
    `
      delete from event_seats
      where event_id = $1
        and row_label is not null
        and table_number is null
        and concat(
          coalesce(section, ''),
          '|',
          coalesce(row_label, '')
        ) = any($2::text[])
    `,
    [input.eventId, input.rowKeys],
  );
}

export async function deleteEventSeats(eventId: string): Promise<void> {
  await query(
    `
      delete from event_seats
      where event_id = $1
    `,
    [eventId],
  );
}

export async function deleteEventRowSeats(eventId: string): Promise<void> {
  await query(
    `
      delete from event_seats
      where event_id = $1
        and row_label is not null
        and table_number is null
    `,
    [eventId],
  );
}

export async function deleteEventTableSeats(eventId: string): Promise<void> {
  await query(
    `
      delete from event_seats
      where event_id = $1
        and table_number is not null
    `,
    [eventId],
  );
}

/* =========================
   EVENT WINNERS
========================= */

export async function listEventWinners(eventId: string): Promise<EventWinner[]> {
  return query<EventWinner>(
    `
      select *
      from event_winners
      where event_id = $1
      order by
        prize_position asc nulls last,
        drawn_at desc,
        created_at desc
    `,
    [eventId],
  );
}

export async function deleteEventWinner(
  eventId: string,
  id: string,
): Promise<void> {
  await query(
    `
      delete from event_winners
      where event_id = $1
        and id = $2
    `,
    [eventId, id],
  );
}

export async function clearEventWinners(eventId: string): Promise<void> {
  await query(
    `
      delete from event_winners
      where event_id = $1
    `,
    [eventId],
  );
}

export async function createEventWinner(input: {
  tenantSlug: string;
  eventId: string;
  prizeId?: string | null;
  prizeTitle: string;
  prizePosition?: number | null;
  drawScope?: string;
  drawSettings?: Record<string, unknown>;
  eventOrderId?: string | null;
  eventOrderItemId?: string | null;
  eventSeatId?: string | null;
  ticketTypeId?: string | null;
  tableNumber?: string | null;
  rowLabel?: string | null;
  seatNumber?: string | null;
  winnerName?: string | null;
  winnerEmail?: string | null;
  status?: string;
}): Promise<EventWinner> {
  await assertEventExists(input.eventId);
  await assertTicketTypeBelongsToEvent(input.eventId, input.ticketTypeId);

  const created = await queryOne<EventWinner>(
    `
      insert into event_winners (
        tenant_slug,
        event_id,
        prize_id,
        prize_title,
        prize_position,
        draw_scope,
        draw_settings,
        event_order_id,
        event_order_item_id,
        event_seat_id,
        ticket_type_id,
        table_number,
        row_label,
        seat_number,
        winner_name,
        winner_email,
        status
      )
      values (
        $1,$2,
        $3,$4,$5,
        $6,$7::jsonb,
        $8,$9,$10,
        $11,
        $12,$13,$14,
        $15,$16,
        $17
      )
      returning *
    `,
    [
      input.tenantSlug,
      input.eventId,
      input.prizeId ?? null,
      input.prizeTitle,
      input.prizePosition ?? null,
      input.drawScope ?? "all",
      JSON.stringify(input.drawSettings ?? {}),
      input.eventOrderId ?? null,
      input.eventOrderItemId ?? null,
      input.eventSeatId ?? null,
      input.ticketTypeId ?? null,
      input.tableNumber ?? null,
      input.rowLabel ?? null,
      input.seatNumber ?? null,
      normaliseNullableText(input.winnerName),
      normaliseNullableText(input.winnerEmail),
      input.status ?? "drawn",
    ],
  );

  if (!created) {
    throw new Error("Failed to create event winner");
  }

  return created;
}

export async function getEligibleEventDrawCandidates(input: {
  eventId: string;
  includeComplimentary?: boolean;
  includeVip?: boolean;
  includeStaff?: boolean;
  includeSponsors?: boolean;
  includeGuests?: boolean;
  excludeWinnerEmails?: boolean;
  maxWinnersPerTable?: number | null;
}): Promise<EventDrawCandidate[]> {
  const excludedEmailRows = input.excludeWinnerEmails
    ? await query<{ winner_email: string }>(
        `
          select distinct lower(winner_email) as winner_email
          from event_winners
          where event_id = $1
            and winner_email is not null
            and trim(winner_email) <> ''
        `,
        [input.eventId],
      )
    : [];

  const excludedEmails = new Set(
    excludedEmailRows
      .map((row) => String(row.winner_email || "").trim().toLowerCase())
      .filter(Boolean),
  );

  const alreadyDrawnRows = await query<{
    event_order_item_id: string | null;
    event_seat_id: string | null;
  }>(
    `
      select
        event_order_item_id,
        event_seat_id
      from event_winners
      where event_id = $1
        and status = 'drawn'
    `,
    [input.eventId],
  );

  const alreadyDrawnOrderItemIds = new Set(
    alreadyDrawnRows
      .map((row) => row.event_order_item_id)
      .filter(Boolean) as string[],
  );

  const alreadyDrawnSeatIds = new Set(
    alreadyDrawnRows
      .map((row) => row.event_seat_id)
      .filter(Boolean) as string[],
  );

  const paidCandidates = await query<EventDrawCandidate>(
    `
      select
        eo.id as event_order_id,
        eoi.id as event_order_item_id,
        es.id as event_seat_id,
        coalesce(es.ticket_type_id, eoi.ticket_type_id) as ticket_type_id,
        es.table_number,
        es.row_label,
        es.seat_number,
        coalesce(
          es.guest_name,
          eoi.guest_name,
          es.customer_name,
          eo.customer_name
        ) as winner_name,
        lower(
          coalesce(
            es.guest_email,
            es.customer_email,
            eo.customer_email
          )
        ) as winner_email,
        es.seat_purpose
      from event_orders eo
      inner join event_order_items eoi
        on eoi.order_id = eo.id
      left join event_seats es
        on es.id = eoi.seat_id
      where eo.event_id = $1
        and eo.status = 'paid'
      order by eo.created_at asc, eoi.created_at asc
    `,
    [input.eventId],
  );

  const adminSeatCandidates = await query<EventDrawCandidate>(
    `
      select
        null::uuid as event_order_id,
        null::uuid as event_order_item_id,
        es.id as event_seat_id,
        es.ticket_type_id,
        es.table_number,
        es.row_label,
        es.seat_number,
        coalesce(es.guest_name, es.customer_name) as winner_name,
        lower(coalesce(es.guest_email, es.customer_email)) as winner_email,
        es.seat_purpose
      from event_seats es
      where es.event_id = $1
        and es.status <> 'blocked'
        and es.seat_purpose in (
          'vip',
          'complimentary',
          'staff',
          'sponsor',
          'guest'
        )
        and (
          coalesce(trim(es.guest_email), '') <> ''
          or coalesce(trim(es.customer_email), '') <> ''
        )
      order by
        case
          when es.table_number ~ '^[0-9]+$'
          then es.table_number::int
          else null
        end asc nulls last,
        es.table_number asc nulls last,
        es.row_label asc nulls last,
        case
          when es.seat_number ~ '^[0-9]+$'
          then es.seat_number::int
          else null
        end asc nulls last,
        es.seat_number asc nulls last,
        es.created_at asc
    `,
    [input.eventId],
  );

  const candidatesByKey = new Map<string, EventDrawCandidate>();

  for (const candidate of [...paidCandidates, ...adminSeatCandidates]) {
    const key =
      candidate.event_order_item_id ||
      candidate.event_seat_id ||
      `${candidate.winner_email}-${candidate.table_number}-${candidate.row_label}-${candidate.seat_number}`;

    if (key) {
      candidatesByKey.set(key, candidate);
    }
  }

  const rows = Array.from(candidatesByKey.values());

  const tableWinnerCounts = new Map<string, number>();

  if (input.maxWinnersPerTable && input.maxWinnersPerTable > 0) {
    const existingTableWinners = await query<{
      table_number: string | null;
      total: string;
    }>(
      `
        select
          table_number,
          count(*)::text as total
        from event_winners
        where event_id = $1
          and status = 'drawn'
          and table_number is not null
        group by table_number
      `,
      [input.eventId],
    );

    for (const row of existingTableWinners) {
      if (!row.table_number) continue;
      tableWinnerCounts.set(row.table_number, Number(row.total || 0));
    }
  }

  return rows.filter((candidate) => {
    if (
      candidate.event_order_item_id &&
      alreadyDrawnOrderItemIds.has(candidate.event_order_item_id)
    ) {
      return false;
    }

    if (
      candidate.event_seat_id &&
      alreadyDrawnSeatIds.has(candidate.event_seat_id)
    ) {
      return false;
    }

    if (!candidate.winner_email) {
      return false;
    }

    const purpose = String(candidate.seat_purpose || "");

    if (purpose === "complimentary" && input.includeComplimentary === false) {
      return false;
    }

    if (purpose === "vip" && input.includeVip === false) {
      return false;
    }

    if (purpose === "staff" && input.includeStaff === false) {
      return false;
    }

    if (purpose === "sponsor" && input.includeSponsors === false) {
      return false;
    }

    if (purpose === "guest" && input.includeGuests === false) {
      return false;
    }

    if (
      input.excludeWinnerEmails &&
      excludedEmails.has(String(candidate.winner_email).trim().toLowerCase())
    ) {
      return false;
    }

    if (
      input.maxWinnersPerTable &&
      input.maxWinnersPerTable > 0 &&
      candidate.table_number
    ) {
      const currentCount = tableWinnerCounts.get(candidate.table_number) || 0;

      if (currentCount >= input.maxWinnersPerTable) {
        return false;
      }
    }

    return true;
  });
}

/* =========================
   ORDERS
========================= */

export async function listEventOrders(eventId: string): Promise<EventOrder[]> {
  return query<EventOrder>(
    `
      select *
      from event_orders
      where event_id = $1
      order by created_at desc
    `,
    [eventId],
  );
}

export async function listEventOrderItems(
  orderId: string,
): Promise<EventOrderItem[]> {
  return query<EventOrderItem>(
    `
      select *
      from event_order_items
      where order_id = $1
      order by created_at asc
    `,
    [orderId],
  );
}

export async function deleteEvent(id: string): Promise<void> {
  await query(
    `
      delete from event_winners
      where event_id = $1
    `,
    [id],
  );

  await query(
    `
      delete from event_order_items
      where event_id = $1
    `,
    [id],
  );

  await query(
    `
      delete from event_seats
      where event_id = $1
    `,
    [id],
  );

  await query(
    `
      delete from event_orders
      where event_id = $1
    `,
    [id],
  );

  await query(
    `
      delete from event_ticket_types
      where event_id = $1
    `,
    [id],
  );

  await query(
    `
      delete from events
      where id = $1
    `,
    [id],
  );
}

export async function createPendingEventOrder(input: {
  tenantSlug: string;
  eventId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  amountTotal: number;
  currency: string;
}): Promise<EventOrder> {
  const customerName =
    input.customerName ?? input.buyerName ?? input.buyer_name ?? null;

  const customerEmail =
    input.customerEmail ?? input.buyerEmail ?? input.buyer_email ?? null;

  const created = await queryOne<EventOrder>(
    `
      insert into event_orders (
        tenant_slug,
        event_id,
        customer_name,
        customer_email,
        amount_total,
        currency,
        status
      )
      values ($1,$2,$3,$4,$5,$6,'pending')
      returning *
    `,
    [
      input.tenantSlug,
      input.eventId,
      customerName,
      customerEmail,
      input.amountTotal,
      input.currency.toLowerCase(),
    ],
  );

  if (!created) {
    throw new Error("Failed to create event order");
  }

  return created;
}

export async function updateEventOrderStripeSession(input: {
  orderId: string;
  stripeSessionId: string;
}): Promise<void> {
  await query(
    `
      update event_orders
      set stripe_session_id = $2
      where id = $1
    `,
    [input.orderId, input.stripeSessionId],
  );
}

export async function updateEventOrderStatus(input: {
  orderId: string;
  status: string;
  customerName?: string | null;
  customerEmail?: string | null;
}): Promise<void> {
  await query(
    `
      update event_orders
      set
        status = $2,
        customer_name = coalesce($3, customer_name),
        customer_email = coalesce($4, customer_email)
      where id = $1
    `,
    [
      input.orderId,
      input.status,
      input.customerName ?? null,
      input.customerEmail ?? null,
    ],
  );
}

export async function createEventOrderItem(input: {
  orderId: string;
  eventId: string;
  ticketTypeId: string | null;
  seatId: string | null;
  label: string;
  quantity: number;
  unitAmount: number;
  guest_name?: string | null;
  dietary_requirements?: string | null;
  menu_choice?: string | null;
}): Promise<EventOrderItem> {
  const created = await queryOne<EventOrderItem>(
    `
      insert into event_order_items (
        order_id,
        event_id,
        ticket_type_id,
        seat_id,
        label,
        quantity,
        unit_amount,
        guest_name,
        dietary_requirements,
        menu_choice
      )
      values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      )
      returning *
    `,
    [
      input.orderId,
      input.eventId,
      input.ticketTypeId,
      input.seatId,
      input.label,
      input.quantity,
      input.unitAmount,
      input.guest_name ?? null,
      input.dietary_requirements ?? null,
      input.menu_choice ?? null,
    ],
  );

  if (!created) {
    throw new Error("Failed to create event order item");
  }

  return created;
}

export async function reserveEventSeatsForOrder(input: {
  eventId: string;
  orderId: string;
  seatIds: string[];
}): Promise<number> {
  if (input.seatIds.length === 0) return 0;

  const rows = await query<{ id: string }>(
    `
      update event_seats
      set
        status = 'reserved',
        order_id = $2,
        updated_at = now()
      where event_id = $1
        and id = any($3::uuid[])
        and status = 'available'
      returning id
    `,
    [input.eventId, input.orderId, input.seatIds],
  );

  return rows.length;
}

export async function attachStripeSessionToReservedSeats(input: {
  orderId: string;
  stripeSessionId: string;
}): Promise<void> {
  await query(
    `
      update event_seats
      set
        stripe_session_id = $2,
        updated_at = now()
      where order_id = $1
        and status = 'reserved'
    `,
    [input.orderId, input.stripeSessionId],
  );
}

export async function markEventSeatsSoldForStripeSession(input: {
  stripeSessionId: string;
  customerName?: string | null;
  customerEmail?: string | null;
}): Promise<void> {
  await query(
    `
      update event_seats
      set
        status = 'sold',
        customer_name = $2,
        customer_email = $3,
        updated_at = now()
      where stripe_session_id = $1
        and status = 'reserved'
    `,
    [
      input.stripeSessionId,
      input.customerName ?? null,
      input.customerEmail ?? null,
    ],
  );
}

export async function releaseEventSeatsForStripeSession(input: {
  stripeSessionId: string;
}): Promise<void> {
  await query(
    `
      update event_seats
      set
        status = 'available',
        stripe_session_id = null,
        order_id = null,
        customer_name = null,
        customer_email = null,
        updated_at = now()
      where stripe_session_id = $1
        and status = 'reserved'
    `,
    [input.stripeSessionId],
  );
}

export async function deleteEventOrderAndItems(orderId: string): Promise<void> {
  await query(
    `
      delete from event_order_items
      where order_id = $1
    `,
    [orderId],
  );

  await query(
    `
      delete from event_orders
      where id = $1
    `,
    [orderId],
  );
}
