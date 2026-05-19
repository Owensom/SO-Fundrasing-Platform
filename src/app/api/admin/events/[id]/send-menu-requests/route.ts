import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import { checkSubscriptionCapability } from "@/lib/subscription-capabilities";
import { sendEventMenuRequestEmail } from "@/lib/event-menu-request-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    id: string;
  };
};

type EventRow = {
  id: string;
  tenant_slug: string;
  title: string;
  location: string | null;
  starts_at: string | null;
};

type GuestMenuRequestRow = {
  event_order_id: string;
  event_order_item_id: string;
  customer_email: string | null;
  customer_name: string | null;
  guest_name: string | null;
  menu_choice: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createRawToken() {
  return randomBytes(32).toString("base64url");
}

function getRequestOrigin(request: Request) {
  const url = new URL(request.url);

  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, "")}`;
  }

  return `${url.protocol}//${url.host}`;
}

function normaliseEmail(value: string | null | undefined) {
  const clean = String(value || "").trim().toLowerCase();
  return clean || null;
}

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised" },
      { status: 401 },
    );
  }

  const eventId = String(context.params.id || "").trim();

  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: "Missing event id" },
      { status: 400 },
    );
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return NextResponse.json(
      { ok: false, error: "Tenant access denied" },
      { status: 403 },
    );
  }

  const tenantSettings = await getTenantSettings(tenantSlug);

  const menuRequestCapability = checkSubscriptionCapability(
    tenantSettings,
    "event_guest_menu_request_emails",
  );

  if (!menuRequestCapability.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error:
          menuRequestCapability.reason ||
          "Menu request emails require the Foundation plan.",
      },
      { status: 403 },
    );
  }

  const eventRows = await query<EventRow>(
    `
      select
        id,
        tenant_slug,
        title,
        location,
        starts_at
      from events
      where id = $1
      limit 1
    `,
    [eventId],
  );

  const event = eventRows[0];

  if (!event) {
    return NextResponse.json(
      { ok: false, error: "Event not found" },
      { status: 404 },
    );
  }

  if (event.tenant_slug !== tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant access denied" },
      { status: 403 },
    );
  }

  const guests = await query<GuestMenuRequestRow>(
    `
      select
        eo.id as event_order_id,
        eoi.id as event_order_item_id,
        eo.customer_email,
        eo.customer_name,
        eoi.guest_name,
        eoi.menu_choice
      from event_orders eo
      inner join event_order_items eoi
        on eoi.order_id = eo.id
      where eo.event_id = $1
        and eo.tenant_slug = $2
        and eo.status = 'paid'
        and nullif(trim(coalesce(eoi.menu_choice, '')), '') is null
      order by eo.created_at asc, eoi.created_at asc
    `,
    [eventId, tenantSlug],
  );

  const origin = getRequestOrigin(request);
  const requestedByEmail = String(session.user.email || "").trim() || null;

  let sent = 0;
  let skippedNoEmail = 0;
  let failed = 0;

  const failures: Array<{
    event_order_item_id: string;
    email: string | null;
    error: string;
  }> = [];

  for (const guest of guests) {
    const email = normaliseEmail(guest.customer_email);

    if (!email) {
      skippedNoEmail += 1;
      continue;
    }

    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 21);
    const updateUrl = `${origin}/menu-update/${encodeURIComponent(rawToken)}`;

    try {
      await query(
        `
          insert into event_guest_update_tokens (
            tenant_slug,
            event_id,
            event_order_id,
            event_order_item_id,
            customer_email,
            guest_name,
            token_hash,
            requested_by_email,
            request_reason,
            expires_at,
            last_sent_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, 'menu_choice_request', $9, now())
        `,
        [
          tenantSlug,
          event.id,
          guest.event_order_id,
          guest.event_order_item_id,
          email,
          guest.guest_name || guest.customer_name || null,
          tokenHash,
          requestedByEmail,
          expiresAt.toISOString(),
        ],
      );

      await sendEventMenuRequestEmail({
        to: email,
        name: guest.customer_name,
        guestName: guest.guest_name,
        eventTitle: event.title,
        eventDate: event.starts_at,
        location: event.location,
        updateUrl,
        expiresAt: expiresAt.toISOString(),
      });

      sent += 1;
    } catch (error) {
      failed += 1;

      failures.push({
        event_order_item_id: guest.event_order_item_id,
        email,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create token or send email",
      });

      console.error("Event menu request failed", {
        eventId: event.id,
        tenantSlug,
        eventOrderItemId: guest.event_order_item_id,
        email,
        error,
      });
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    eventId: event.id,
    checked: guests.length,
    sent,
    skippedNoEmail,
    failed,
    failures,
  });
}
