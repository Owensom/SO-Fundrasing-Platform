import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BasketPayloadItem = {
  productId?: unknown;
  productSlug?: unknown;
  optionLabel?: unknown;
  quantity?: unknown;
};

type BasketValidationPayload = {
  tenantSlug?: unknown;
  items?: unknown;
};

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

type BasketValidationLine = {
  productId: string;
  productSlug: string;
  title: string;
  optionLabel: string | null;
  quantity: number;
  currency: string;
  unitPriceCents: number;
  lineTotalCents: number;
  stockQuantity: number | null;
  soldQuantity: number;
  remainingStock: number | null;
  eventLinked: boolean;
  linkedEventId: string | null;
  requiredDetails: {
    bookingReference: boolean;
    tableNumber: boolean;
    seatNumber: boolean;
    guestName: boolean;
  };
  fulfilmentMethods: string[];
};

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

function getFulfilmentMethods(product: MerchandiseProduct) {
  const methods: string[] = [];

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

function getBasketItems(value: unknown): BasketPayloadItem[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item) => item && typeof item === "object") as BasketPayloadItem[];
}

async function getTenantSettings(tenantSlug: string) {
  const rows = await query<TenantSettings>(
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

  return rows[0] || null;
}

async function getProductsByIds({
  tenantSlug,
  productIds,
}: {
  tenantSlug: string;
  productIds: string[];
}) {
  if (productIds.length === 0) return [];

  return query<MerchandiseProduct>(
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
        and id = any($2::text[])
    `,
    [tenantSlug, productIds],
  );
}

export async function POST(request: Request) {
  let payload: BasketValidationPayload;

  try {
    payload = (await request.json()) as BasketValidationPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid basket request. Please refresh the page and try again.",
      },
      { status: 400 },
    );
  }

  const tenantSlug = cleanText(payload.tenantSlug);
  const basketItems = getBasketItems(payload.items);

  if (!tenantSlug) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing shop details. Please go back to the shop and try again.",
      },
      { status: 400 },
    );
  }

  if (basketItems.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Your basket is empty.",
      },
      { status: 400 },
    );
  }

  if (basketItems.length > 50) {
    return NextResponse.json(
      {
        ok: false,
        error: "There are too many items in your basket. Please reduce the basket and try again.",
      },
      { status: 400 },
    );
  }

  const tenantSettings = await getTenantSettings(tenantSlug);

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

  const productIds = Array.from(
    new Set(
      basketItems
        .map((item) => cleanText(item.productId))
        .filter(Boolean),
    ),
  );

  if (productIds.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Your basket does not contain any valid products.",
      },
      { status: 400 },
    );
  }

  const products = await getProductsByIds({ tenantSlug, productIds });
  const productById = new Map(products.map((product) => [product.id, product]));

  const errors: string[] = [];
  const validatedLines: BasketValidationLine[] = [];
  const quantityByProductAndOption = new Map<string, number>();

  for (const item of basketItems) {
    const productId = cleanText(item.productId);
    const productSlug = cleanText(item.productSlug);
    const optionLabel = cleanText(item.optionLabel) || null;
    const quantity = normaliseQuantity(item.quantity);

    if (!productId) {
      errors.push("A basket item is missing its product ID.");
      continue;
    }

    const product = productById.get(productId);

    if (!product) {
      errors.push("One of the products in your basket is no longer available.");
      continue;
    }

    if (product.tenant_slug !== tenantSlug) {
      errors.push(`${product.title} is not available in this shop.`);
      continue;
    }

    if (product.status !== "published") {
      errors.push(`${product.title} is no longer published.`);
      continue;
    }

    if (productSlug && productSlug !== product.slug) {
      errors.push(`${product.title} has changed. Please remove it and add it again.`);
      continue;
    }

    if (quantity < 1 || quantity > 20) {
      errors.push(`${product.title} must have a quantity between 1 and 20.`);
      continue;
    }

    const sizeOptions = getSizeOptions(product);

    if (sizeOptions.length > 0 && !optionLabel) {
      errors.push(`Please choose a size or option for ${product.title}.`);
      continue;
    }

    if (optionLabel && sizeOptions.length > 0 && !sizeOptions.includes(optionLabel)) {
      errors.push(`${optionLabel} is not a valid option for ${product.title}.`);
      continue;
    }

    const stockKey = `${product.id}::${optionLabel || "__no_option__"}`;
    quantityByProductAndOption.set(
      stockKey,
      Number(quantityByProductAndOption.get(stockKey) || 0) + quantity,
    );

    const remainingStock = getRemainingStock(product);
    const requestedQuantityForLine = Number(quantityByProductAndOption.get(stockKey) || 0);

    if (remainingStock !== null && remainingStock <= 0) {
      errors.push(`${product.title} is currently out of stock.`);
      continue;
    }

    if (remainingStock !== null && requestedQuantityForLine > remainingStock) {
      errors.push(
        `Only ${remainingStock} item${
          remainingStock === 1 ? "" : "s"
        } are currently available for ${product.title}.`,
      );
      continue;
    }

    validatedLines.push({
      productId: product.id,
      productSlug: product.slug,
      title: product.title,
      optionLabel,
      quantity,
      currency: product.currency,
      unitPriceCents: Number(product.price_cents || 0),
      lineTotalCents: Number(product.price_cents || 0) * quantity,
      stockQuantity: product.stock_quantity,
      soldQuantity: Number(product.sold_quantity || 0),
      remainingStock,
      eventLinked: isEnabled(product.event_linking_enabled),
      linkedEventId: cleanText(product.linked_event_id) || null,
      requiredDetails: {
        bookingReference: isEnabled(product.require_booking_reference),
        tableNumber: isEnabled(product.require_table_number),
        seatNumber: isEnabled(product.require_seat_number),
        guestName: isEnabled(product.require_guest_name),
      },
      fulfilmentMethods: getFulfilmentMethods(product),
    });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: errors[0],
        errors,
      },
      { status: 400 },
    );
  }

  if (validatedLines.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Your basket could not be validated.",
      },
      { status: 400 },
    );
  }

  const currency = validatedLines[0]?.currency || "GBP";
  const mixedCurrency = validatedLines.some((line) => line.currency !== currency);

  if (mixedCurrency) {
    return NextResponse.json(
      {
        ok: false,
        error: "Your basket contains items with different currencies. Please contact the organiser.",
      },
      { status: 400 },
    );
  }

  const itemCount = validatedLines.reduce(
    (total, line) => total + Number(line.quantity || 0),
    0,
  );

  const subtotalCents = validatedLines.reduce(
    (total, line) => total + Number(line.lineTotalCents || 0),
    0,
  );

  return NextResponse.json({
    ok: true,
    mode: "basket_validation_only",
    message: "Basket is valid. Stripe checkout is not connected yet.",
    basket: {
      tenantSlug,
      itemCount,
      currency,
      subtotalCents,
      lines: validatedLines,
    },
  });
}
