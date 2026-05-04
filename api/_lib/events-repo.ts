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
  aisle_after: number | null;
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
  prizes_json?: any; // ✅ NEW
  created_at: string;
  updated_at: string;
  ticket_types?: EventTicketType[];
  seats?: EventSeat[];
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
  prizesJson?: any; // ✅ NEW
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
  prizesJson?: any; // ✅ NEW
};

function normaliseEventType(value: string | null | undefined): EventType {
  if (value === "reserved_seating" || value === "tables") return value;
  return "general_admission";
}

function normaliseStatus(value: string | null | undefined): EventStatus {
  if (value === "published" || value === "closed") return value;
  return "draft";
}

/* =========================
   EVENTS
========================= */

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

export async function getEventById(id: string): Promise<EventItem | null> {
  return queryOne<EventItem>(
    `
    select *
    from events
    where id = $1
    limit 1
    `,
    [id],
  );
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
      capacity,
      prizes_json
    )
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
      input.prizesJson ?? [],
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
      prizes_json = $13,
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
      input.prizesJson ?? existing.prizes_json ?? [],
    ],
  );
}
