"use server";

import { createHash } from "crypto";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";

type TokenLookupRow = {
  id: string;
  tenant_slug: string;
  event_id: string;
  event_order_id: string;
  event_order_item_id: string;
  customer_email: string;
  expires_at: string;
  seat_id: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  return String(value || "").trim() || null;
}

export async function updateGuestMenuChoiceAction(formData: FormData) {
  const rawToken = String(formData.get("token") || "").trim();
  const guestName = cleanOptionalText(formData.get("guest_name"));
  const menuChoice = cleanOptionalText(formData.get("menu_choice"));
  const dietaryRequirements = cleanOptionalText(
    formData.get("dietary_requirements"),
  );

  if (!rawToken) {
    redirect("/menu-update/invalid?error=missing-token");
  }

  const tokenHash = hashToken(rawToken);

  const tokenRows = await query<TokenLookupRow>(
    `
      select
        egut.id,
        egut.tenant_slug,
        egut.event_id,
        egut.event_order_id,
        egut.event_order_item_id,
        egut.customer_email,
        egut.expires_at,
        eoi.seat_id
      from event_guest_update_tokens egut
      inner join event_order_items eoi
        on eoi.id = egut.event_order_item_id
      inner join event_orders eo
        on eo.id = egut.event_order_id
       and eo.id = eoi.order_id
      inner join events e
        on e.id = egut.event_id
      where egut.token_hash = $1
        and egut.expires_at > now()
        and eo.status = 'paid'
        and e.tenant_slug = egut.tenant_slug
      limit 1
    `,
    [tokenHash],
  );

  const tokenRow = tokenRows[0];

  if (!tokenRow) {
    redirect(`/menu-update/${encodeURIComponent(rawToken)}?error=invalid`);
  }

  await query(
    `
      update event_order_items
      set
        guest_name = $3,
        menu_choice = $4,
        dietary_requirements = $5
      where id = $1
        and order_id = $2
    `,
    [
      tokenRow.event_order_item_id,
      tokenRow.event_order_id,
      guestName,
      menuChoice,
      dietaryRequirements,
    ],
  );

  if (tokenRow.seat_id) {
    await query(
      `
        update event_seats
        set
          customer_name = $3,
          guest_name = $3,
          customer_email = $4,
          guest_email = $4,
          menu_choice = $5,
          dietary_requirements = $6,
          updated_at = now()
        where id = $1
          and event_id = $2
      `,
      [
        tokenRow.seat_id,
        tokenRow.event_id,
        guestName,
        tokenRow.customer_email,
        menuChoice,
        dietaryRequirements,
      ],
    );
  }

  await query(
    `
      update event_guest_update_tokens
      set
        guest_name = $2,
        submitted_at = now(),
        updated_at = now()
      where id = $1
    `,
    [tokenRow.id, guestName],
  );

  redirect(`/menu-update/${encodeURIComponent(rawToken)}?saved=1`);
}
