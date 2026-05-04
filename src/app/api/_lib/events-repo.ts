import { query, queryOne } from "@/lib/db";

/* =========================
   TYPES
========================= */

export type EventOrderItem = {
  id: string;
  order_id: string;
  event_id: string;
  ticket_type_id: string | null;
  seat_id: string | null;
  label: string;
  quantity: number;
  unit_amount: number;

  // ✅ NEW FIELDS (fixes your error)
  guest_name: string | null;
  dietary_requirements: string | null;
  menu_choice: string | null;

  created_at: string;
};

/* =========================
   ORDER ITEMS (FIXED)
========================= */

export async function createEventOrderItem(input: {
  orderId: string;
  eventId: string;
  ticketTypeId: string | null;
  seatId: string | null;
  label: string;
  quantity: number;
  unitAmount: number;

  // ✅ MUST EXIST or build fails
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
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
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

      // ✅ IMPORTANT: prevents crash
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
