import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MerchandiseOption = {
  type?: string | null;
  label?: string | null;
  value?: string | null;
};

type MerchandiseProduct = {
  id: string;
  tenant_slug: string;
  slug: string;
  title: string;
  status: string;
  price_cents: number;
  currency: string;
  stock_quantity: number | null;
  sold_quantity: number;
  options_json: MerchandiseOption[] | null;

  linked_event_id: string | null;
  event_linking_enabled: boolean | null;

  fulfilment_collect_stand_enabled: boolean | null;
  fulfilment_collect_table_enabled: boolean | null;
  fulfilment_deliver_table_enabled: boolean | null;
  fulfilment_deliver_seat_enabled: boolean | null;
  fulfilment_post_enabled: boolean | null;
  fulfilment_arrange_with_organiser_enabled: boolean | null;

  require_booking_reference: boolean | null;
  require_table_number: boolean | null;
  require_seat_number: boolean | null;
  require_guest_name: boolean | null;
};

type TenantSettings = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

type CheckoutPayload = {
  tenantSlug?: unknown;
  productSlug?: unknown;
  quantity?: unknown;
  optionLabel?: unknown;
  fulfilmentMethod?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
  customerPhone?: unknown;
  bookingReference?: unknown;
  tableNumber?: unknown;
  seatNumber?: unknown;
  guestName?: unknown;
  customerNote?: unknown;
};

const FULFILMENT_METHODS = [
  "collect_stand",
  "collect_table",
  "deliver_table",
  "deliver_seat",
  "post_after_event",
  "arrange_with_organiser",
] as const;

type FulfilmentMethod = (typeof FULFILMENT_METHODS)[number];

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function isEnabled(value: boolean | null | undefined, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function normaliseQuantity(value: unknown) {
  const number = Number(value);

  if (!Number.isInteger(number)) return 1;

  return number;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getSizeOptions(product: MerchandiseProduct) {
  if (!Array.isArray(product.options_json)) return [];

  return product.options_json
    .filter((option) => cleanText(option?.type).toLowerCase() === "size")
    .map((option) => cleanText(option?.label || option?.value))
    .filter(Boolean);
}

function getRemainingStock(product: MerchandiseProduct) {
  if (product.stock_quantity === null) return null;

  return Math.max(
    0,
    Number(product.stock_quantity || 0) - Number(product.sold_quantity || 0),
  );
}

function getAllowedFulfilmentMethods(product: MerchandiseProduct) {
  const methods: FulfilmentMethod[] = [];

  if (isEnabled(product.fulfilment_collect_stand_enabled, true)) {
    methods.push("collect_stand");
  }

  if (isEnabled(product.fulfilment_collect_table_enabled)) {
    methods.push("collect_table");
  }

  if (isEnabled(product.fulfilment_deliver_table_enabled)) {
    methods.push("deliver_table");
  }

  if (isEnabled(product.fulfilment_deliver_seat_enabled)) {
    methods.push("deliver_seat");
  }

  if (isEnabled(product.fulfilment_post_enabled)) {
    methods.push("post_after_event");
  }

  if (isEnabled(product.fulfilment_arrange_with_organiser_enabled, true)) {
    methods.push("arrange_with_organiser");
  }

  return methods;
}

function isFulfilmentMethod(value: string): value is FulfilmentMethod {
  return FULFILMENT_METHODS.includes(value as FulfilmentMethod);
}

async function getTenantSettings(tenantSlug: string) {
  return queryOne<TenantSettings>(
    `
      select
        subscription_tier,
        subscription_status,
        platform_owner_bypass
      from tenant_settings
      where tenant_slug = $1
      limit 1
    `,
    [tenantSlug],
  );
}

async function getPublishedProduct({
  tenantSlug,
  productSlug,
}: {
  tenantSlug: string;
  productSlug: string;
}) {
  return queryOne<MerchandiseProduct>(
    `
      select
        id,
        tenant_slug,
        slug,
        title,
        status,
        price_cents,
        currency,
        stock_quantity,
        sold_quantity,
        options_json,
        linked_event_id::text,
        event_linking_enabled,
        fulfilment_collect_stand_enabled,
        fulfilment_collect_table_enabled,
        fulfilment_deliver_table_enabled,
        fulfilment_deliver_seat_enabled,
        fulfilment_post_enabled,
        fulfilment_arrange_with_organiser_enabled,
        require_booking_reference,
        require_table_number,
        require_seat_number,
        require_guest_name
      from merchandise_products
      where tenant_slug = $1
        and slug = $2
        and status = 'published'
      limit 1
    `,
    [tenantSlug, productSlug],
  );
}

export async function POST(request: Request) {
  let payload: CheckoutPayload;

  try {
    payload = (await request.json()) as CheckoutPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid request. Please refresh the page and try again.",
      },
      { status: 400 },
    );
  }

  const tenantSlug = cleanText(payload.tenantSlug);
  const productSlug = cleanText(payload.productSlug);
  const quantity = normaliseQuantity(payload.quantity);
  const optionLabel = cleanText(payload.optionLabel);
  const fulfilmentMethod = cleanText(payload.fulfilmentMethod);
  const customerName = cleanText(payload.customerName);
  const customerEmail = cleanText(payload.customerEmail).toLowerCase();
  const customerPhone = cleanText(payload.customerPhone);
  const bookingReference = cleanText(payload.bookingReference);
  const tableNumber = cleanText(payload.tableNumber);
  const seatNumber = cleanText(payload.seatNumber);
  const guestName = cleanText(payload.guestName);
  const customerNote = cleanText(payload.customerNote);

  if (!tenantSlug || !productSlug) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing product details. Please go back to the shop and try again.",
      },
      { status: 400 },
    );
  }

  const [tenantSettings, product] = await Promise.all([
    getTenantSettings(tenantSlug),
    getPublishedProduct({ tenantSlug, productSlug }),
  ]);

  if (!tenantSettings) {
    return NextResponse.json(
      {
        ok: false,
        error: "This shop is not available.",
      },
      { status: 404 },
    );
  }

  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings.subscription_tier,
  );

  const merchandiseCapability = checkSubscriptionCapability(
    {
      subscription_tier: subscriptionTier,
      subscription_status: cleanText(
        tenantSettings.subscription_status,
        "active",
      ),
      platform_owner_bypass: Boolean(tenantSettings.platform_owner_bypass),
    },
    "merchandise",
  );

  if (!merchandiseCapability.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Merchandise checkout is not available for this shop.",
      },
      { status: 403 },
    );
  }

  if (!product) {
    return NextResponse.json(
      {
        ok: false,
        error: "This merchandise item is not available.",
      },
      { status: 404 },
    );
  }

  if (quantity < 1 || quantity > 20) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please choose a quantity between 1 and 20.",
      },
      { status: 400 },
    );
  }

  const remainingStock = getRemainingStock(product);

  if (remainingStock !== null && remainingStock <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "This item is currently out of stock. Please contact the organiser.",
      },
      { status: 400 },
    );
  }

  if (remainingStock !== null && quantity > remainingStock) {
    return NextResponse.json(
      {
        ok: false,
        error: `Only ${remainingStock} item${
          remainingStock === 1 ? "" : "s"
        } are currently available.`,
      },
      { status: 400 },
    );
  }

  const sizeOptions = getSizeOptions(product);

  if (sizeOptions.length > 0 && !optionLabel) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please choose a size or option.",
      },
      { status: 400 },
    );
  }

  if (optionLabel && sizeOptions.length > 0 && !sizeOptions.includes(optionLabel)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please choose a valid size or option.",
      },
      { status: 400 },
    );
  }

  const allowedFulfilmentMethods = getAllowedFulfilmentMethods(product);

  if (!fulfilmentMethod) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please choose a fulfilment option.",
      },
      { status: 400 },
    );
  }

  if (
    !isFulfilmentMethod(fulfilmentMethod) ||
    !allowedFulfilmentMethods.includes(fulfilmentMethod)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please choose a valid fulfilment option.",
      },
      { status: 400 },
    );
  }

  if (!customerName) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter your name.",
      },
      { status: 400 },
    );
  }

  if (!customerEmail || !isValidEmail(customerEmail)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter a valid email address.",
      },
      { status: 400 },
    );
  }

  if (isEnabled(product.require_booking_reference) && !bookingReference) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter your booking reference.",
      },
      { status: 400 },
    );
  }

  if (isEnabled(product.require_table_number) && !tableNumber) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter your table number.",
      },
      { status: 400 },
    );
  }

  if (isEnabled(product.require_seat_number) && !seatNumber) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter your seat number.",
      },
      { status: 400 },
    );
  }

  if (isEnabled(product.require_guest_name) && !guestName) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter the guest name.",
      },
      { status: 400 },
    );
  }

  if (customerName.length > 160 || customerEmail.length > 180) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please shorten your name or email address.",
      },
      { status: 400 },
    );
  }

  if (
    customerPhone.length > 80 ||
    bookingReference.length > 120 ||
    tableNumber.length > 80 ||
    seatNumber.length > 80 ||
    guestName.length > 160 ||
    customerNote.length > 500
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "One of the details entered is too long. Please shorten it and try again.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "validation_only",
    message: "Merchandise checkout details are valid. Stripe is not connected yet.",
    checkoutPreview: {
      tenantSlug,
      productId: product.id,
      productSlug: product.slug,
      productTitle: product.title,
      quantity,
      optionLabel: optionLabel || null,
      fulfilmentMethod,
      customerName,
      customerEmail,
      customerPhone: customerPhone || null,
      bookingReference: bookingReference || null,
      tableNumber: tableNumber || null,
      seatNumber: seatNumber || null,
      guestName: guestName || null,
      customerNote: customerNote || null,
      currency: product.currency,
      unitPriceCents: product.price_cents,
      subtotalCents: Number(product.price_cents || 0) * quantity,
    },
  });
}
