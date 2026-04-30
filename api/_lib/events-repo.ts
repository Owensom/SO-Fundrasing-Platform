import { query, queryOne } from "@/lib/db";

export type EventType = "general_admission" | "reserved_seating" | "tables";
export type EventStatus = "draft" | "published" | "closed";
export type EventSeatStatus = "available" | "reserved" | "sold" | "blocked";

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
  section: string | null;
  row_label: string | null;
  seat_number: string | null;
  table_number: string | null;
  status: EventSeatStatus;
  customer_name: string | null;
  customer_email: string | null;
  stripe_session_id: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EventItem = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  location: string | null;
  starts_at: string | null;
  ends_at: string | null;
  currency: string;
  event_type: EventType;
  status: EventStatus;
  capacity: number | null;
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
  created_at: string;
};

export type CreateEventInput = {
  tenantSlug: string;
  slug: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  currency?: string;
  eventType?: EventType;
  status?: EventStatus;
  capacity?: number | null;
};

export type UpdateEventInput = {
  slug?: string;
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  location?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  currency?: string;
  eventType?: EventType;
  status?: EventStatus;
  capacity?: number | null;
};

function normaliseEventType(value: string | null | undefined): EventType {
  if (value === "reserved_seating" || value === "tables") return value;
  return "general_admission";
}

function normaliseStatus(value: string | null | undefined): EventStatus {
  if (value === "published" || value === "closed") return value;
  return "draft";
}

function normaliseSeatStatus(value: string | null | undefined): EventSeatStatus {
  if (value === "reserved" || value === "sold" || value === "blocked") {
    return value;
  }

  return "available";
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

export async function listEvents(tenantSlug: string): Promise<EventItem[]> {
  return query<EventItem>(
    `
    select *
    from events
    where tenant_slug = $1
    order by created_at desc
    `,
    [tenantSlug],
  );
}

export async function listPublishedEvents(
  tenantSlug: string,
): Promise<EventItem[]> {
  return query<EventItem>(
    `
    select *
    from events
    where tenant_slug = $1
      and status = 'published'
    order by starts_at asc nulls last, created_at desc
    `,
    [tenantSlug],
  );
}

export async function hydrateEvent(event: EventItem): Promise<EventItem> {
  const [ticketTypes, seats] = await Promise.all([
    listEventTicketTypes(event.id),
    listEventSeats(event.id),
  ]);

  return {
    ...event,
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

  if (!event) return null;

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

  if (!event) return null;

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
      location,
      starts_at,
      ends_at,
      currency,
      event_type,
      status,
      capacity
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    returning *
    `,
    [
      input.tenantSlug,
      input.slug,
      input.title,
      input.description ?? null,
      input.imageUrl ?? null,
      input.location ?? null,
      input.startsAt || null,
      input.endsAt || null,
      input.currency || "GBP",
      normaliseEventType(input.eventType),
      normaliseStatus(input.status),
      input.capacity ?? null,
    ],
  );

  if (!created) {
    throw new Error("Failed to create event");
  }

  return created;
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput,
): Promise<EventItem | null> {
  const existing = await getEventById(id);
  if (!existing) return null;

  return queryOne<EventItem>(
    `
    update events
    set
      slug = $2,
      title = $3,
      description = $4,
      image_url = $5,
      location = $6,
      starts_at = $7,
      ends_at = $8,
      currency = $9,
      event_type = $10,
      status = $11,
      capacity = $12,
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
      input.location ?? existing.location,
      input.startsAt ?? existing.starts_at,
      input.endsAt ?? existing.ends_at,
      input.currency ?? existing.currency,
      normaliseEventType(input.eventType ?? existing.event_type),
      normaliseStatus(input.status ?? existing.status),
      input.capacity ?? existing.capacity,
    ],
  );
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
}) {
  return queryOne<EventTicketType>(
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
}

export async function updateEventTicketType(
  id: string,
  input: {
    name?: string;
    description?: string | null;
    price?: number;
    capacity?: number | null;
    sortOrder?: number;
    isActive?: boolean;
  },
) {
  return queryOne<EventTicketType>(
    `
    update event_ticket_types
    set
      name = coalesce($2, name),
      description = coalesce($3, description),
      price = coalesce($4, price),
      capacity = coalesce($5, capacity),
      sort_order = coalesce($6, sort_order),
      is_active = coalesce($7, is_active)
    where id = $1
    returning *
    `,
    [
      id,
      input.name,
      input.description,
      input.price,
      input.capacity,
      input.sortOrder,
      input.isActive,
    ],
  );
}

export async function deleteEventTicketType(id: string) {
  return query(`delete from event_ticket_types where id = $1`, [id]);
}

export async function deleteEventTicketTypes(eventId: string) {
  return query(`delete from event_ticket_types where event_id = $1`, [
    eventId,
  ]);
}

/* =========================
   SEATS / TABLES
========================= */

export async function listEventSeats(
  eventId: string,
): Promise<EventSeat[]> {
  return query<EventSeat>(
    `
    select *
    from event_seats
    where event_id = $1
    order by
      coalesce(section, ''),
      coalesce(row_label, ''),
      coalesce(table_number, ''),
      coalesce(seat_number, '')
    `,
    [eventId],
  );
}

export async function createEventSeat(input: {
  eventId: string;
  ticketTypeId?: string | null;
  section?: string | null;
  rowLabel?: string | null;
  seatNumber?: string | null;
  tableNumber?: string | null;
  status?: EventSeatStatus;
}) {
  return queryOne<EventSeat>(
    `
    insert into event_seats (
      event_id,
      ticket_type_id,
      section,
      row_label,
      seat_number,
      table_number,
      status
    )
    values ($1,$2,$3,$4,$5,$6,$7)
    returning *
    `,
    [
      input.eventId,
      input.ticketTypeId ?? null,
      input.section ?? null,
      input.rowLabel ?? null,
      input.seatNumber ?? null,
      input.tableNumber ?? null,
      normaliseSeatStatus(input.status),
    ],
  );
}

export async function updateEventSeat(
  id: string,
  input: {
    ticketTypeId?: string | null;
    section?: string | null;
    rowLabel?: string | null;
    seatNumber?: string | null;
    tableNumber?: string | null;
    status?: EventSeatStatus;
    customerName?: string | null;
    customerEmail?: string | null;
  },
) {
  return queryOne<EventSeat>(
    `
    update event_seats
    set
      ticket_type_id = coalesce($2, ticket_type_id),
      section = coalesce($3, section),
      row_label = coalesce($4, row_label),
      seat_number = coalesce($5, seat_number),
      table_number = coalesce($6, table_number),
      status = coalesce($7, status),
      customer_name = coalesce($8, customer_name),
      customer_email = coalesce($9, customer_email),
      updated_at = now()
    where id = $1
    returning *
    `,
    [
      id,
      input.ticketTypeId,
      input.section,
      input.rowLabel,
      input.seatNumber,
      input.tableNumber,
      input.status,
      input.customerName,
      input.customerEmail,
    ],
  );
}

export async function deleteEventSeat(id: string) {
  return query(`delete from event_seats where id = $1`, [id]);
}

export async function deleteEventSeats(eventId: string) {
  return query(`delete from event_seats where event_id = $1`, [eventId]);
}

/* =========================
   EVENT DELETE
========================= */

export async function deleteEvent(id: string) {
  await query(`delete from event_seats where event_id = $1`, [id]);
  await query(`delete from event_ticket_types where event_id = $1`, [id]);
  return query(`delete from events where id = $1`, [id]);
}
