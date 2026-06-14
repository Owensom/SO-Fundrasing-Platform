"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

type SlugRow = {
  slug: string;
};

type ProductIdRow = {
  id: string;
};

type MerchandiseOption = {
  type: "size";
  label: string;
  value: string;
};

const STANDARD_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function normaliseStatus(value: unknown) {
  const clean = cleanText(value).toLowerCase();

  if (clean === "published") return "published";
  if (clean === "closed") return "closed";

  return "draft";
}

function normaliseCurrency(value: unknown) {
  const clean = cleanText(value, "GBP").toUpperCase();

  if (/^[A-Z]{3}$/.test(clean)) {
    return clean;
  }

  return "GBP";
}

function parsePriceCents(value: unknown) {
  const clean = cleanText(value)
    .replace(/[£,$]/g, "")
    .replace(":", ".")
    .replace(/[^\d.]/g, "");

  if (!clean) return 0;

  const number = Number(clean);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.round(number * 100);
}

function parseNullableInteger(value: unknown) {
  const clean = cleanText(value);

  if (!clean) return null;

  const number = Number(clean);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return Math.floor(number);
}

function parseFocus(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function parseCheckbox(formData: FormData, name: string) {
  return formData.get(name) === "1";
}

function parseNullableUuid(value: unknown) {
  const clean = cleanText(value);

  if (!clean) return null;

  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      clean,
    )
  ) {
    return clean;
  }

  return null;
}

function slugify(value: string) {
  return (
    cleanText(value)
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 80) || "product"
  );
}

function buildSizeOptions(formData: FormData) {
  const selectedStandardSizes = formData
    .getAll("size_options")
    .map((value) => cleanText(value).toUpperCase())
    .filter((value) => STANDARD_SIZE_OPTIONS.includes(value));

  const customSizes = cleanText(formData.get("custom_size_options"))
    .split(",")
    .map((value) => cleanText(value))
    .filter(Boolean);

  const seen = new Set<string>();
  const options: MerchandiseOption[] = [];

  for (const size of [...selectedStandardSizes, ...customSizes]) {
    const label = cleanText(size);
    const key = label.toLowerCase();

    if (!label || seen.has(key)) continue;

    seen.add(key);

    options.push({
      type: "size",
      label,
      value: label,
    });
  }

  return options;
}

async function requireTenantAccess() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return tenantSlug;
}

async function requireMerchandiseCapability(tenantSlug: string) {
  const tenantSettingsRaw = await getTenantSettings(tenantSlug);
  const tenantSettings = tenantSettingsRaw as TenantSettingsLike | null;
  const tier = normaliseSubscriptionTier(tenantSettings?.subscription_tier);

  const subscriptionTenant = {
    subscription_tier: tier,
    subscription_status:
      cleanText(tenantSettings?.subscription_status, "active") || "active",
    platform_owner_bypass: Boolean(tenantSettings?.platform_owner_bypass),
  };

  const capability = checkSubscriptionCapability(
    subscriptionTenant,
    "merchandise",
  );

  if (!capability.allowed) {
    redirect("/admin/merchandise?error=upgrade-required");
  }
}

async function buildUniqueSlug({
  tenantSlug,
  title,
  currentProductId,
}: {
  tenantSlug: string;
  title: string;
  currentProductId?: string;
}) {
  const baseSlug = slugify(title);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const rows = await query<SlugRow>(
      `
        select slug
        from merchandise_products
        where tenant_slug = $1
          and slug = $2
          and ($3::text is null or id <> $3::text)
        limit 1
      `,
      [tenantSlug, candidate, currentProductId || null],
    );

    if (rows.length === 0) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function createMerchandiseProduct(formData: FormData) {
  const tenantSlug = await requireTenantAccess();
  await requireMerchandiseCapability(tenantSlug);

  const title = cleanText(formData.get("title"));
  const description = cleanText(formData.get("description"));
  const imageUrl = cleanText(formData.get("image_url"));
  const priceCents = parsePriceCents(formData.get("price"));
  const currency = normaliseCurrency(formData.get("currency"));
  const stockQuantity = parseNullableInteger(formData.get("stock_quantity"));
  const status = normaliseStatus(formData.get("status"));
  const imageFocusX = parseFocus(formData.get("image_focus_x"));
  const imageFocusY = parseFocus(formData.get("image_focus_y"));
  const options = buildSizeOptions(formData);

  if (!title) {
    redirect("/admin/merchandise/new?error=title-required");
  }

  const slug = await buildUniqueSlug({
    tenantSlug,
    title,
  });

  const created = await queryOne<ProductIdRow>(
    `
      insert into merchandise_products (
        tenant_slug,
        slug,
        title,
        description,
        image_url,
        image_focus_x,
        image_focus_y,
        price_cents,
        currency,
        stock_quantity,
        status,
        options_json
      )
      values (
        $1,
        $2,
        $3,
        $4,
        nullif($5, ''),
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12::jsonb
      )
      returning id
    `,
    [
      tenantSlug,
      slug,
      title,
      description,
      imageUrl,
      imageFocusX,
      imageFocusY,
      priceCents,
      currency,
      stockQuantity,
      status,
      JSON.stringify(options),
    ],
  );

  revalidatePath("/admin/merchandise");

  redirect(`/admin/merchandise/${encodeURIComponent(created?.id || "")}`);
}

export async function updateMerchandiseProduct(formData: FormData) {
  const tenantSlug = await requireTenantAccess();
  await requireMerchandiseCapability(tenantSlug);

  const productId = cleanText(formData.get("product_id"));

  if (!productId) {
    redirect("/admin/merchandise?error=missing-product");
  }

  const title = cleanText(formData.get("title"));
  const description = cleanText(formData.get("description"));
  const imageUrl = cleanText(formData.get("image_url"));
  const priceCents = parsePriceCents(formData.get("price"));
  const currency = normaliseCurrency(formData.get("currency"));
  const stockQuantity = parseNullableInteger(formData.get("stock_quantity"));
  const status = normaliseStatus(formData.get("status"));
  const imageFocusX = parseFocus(formData.get("image_focus_x"));
  const imageFocusY = parseFocus(formData.get("image_focus_y"));
  const options = buildSizeOptions(formData);

  const eventLinkingEnabled = parseCheckbox(formData, "event_linking_enabled");
  const linkedEventId = eventLinkingEnabled
    ? parseNullableUuid(formData.get("linked_event_id"))
    : null;

  const fulfilmentCollectStandEnabled = parseCheckbox(
    formData,
    "fulfilment_collect_stand_enabled",
  );
  const fulfilmentCollectTableEnabled = parseCheckbox(
    formData,
    "fulfilment_collect_table_enabled",
  );
  const fulfilmentDeliverTableEnabled = parseCheckbox(
    formData,
    "fulfilment_deliver_table_enabled",
  );
  const fulfilmentDeliverSeatEnabled = parseCheckbox(
    formData,
    "fulfilment_deliver_seat_enabled",
  );
  const fulfilmentPostEnabled = parseCheckbox(
    formData,
    "fulfilment_post_enabled",
  );
  const fulfilmentArrangeWithOrganiserEnabled = parseCheckbox(
    formData,
    "fulfilment_arrange_with_organiser_enabled",
  );

  const requireBookingReference = parseCheckbox(
    formData,
    "require_booking_reference",
  );
  const requireTableNumber = parseCheckbox(formData, "require_table_number");
  const requireSeatNumber = parseCheckbox(formData, "require_seat_number");
  const requireGuestName = parseCheckbox(formData, "require_guest_name");
  const fulfilmentNotes = cleanText(formData.get("fulfilment_notes"));

  if (!title) {
    redirect(
      `/admin/merchandise/${encodeURIComponent(
        productId,
      )}?error=title-required`,
    );
  }

  const slug = await buildUniqueSlug({
    tenantSlug,
    title,
    currentProductId: productId,
  });

  await query(
    `
      update merchandise_products
      set
        slug = $3,
        title = $4,
        description = $5,
        image_url = nullif($6, ''),
        image_focus_x = $7,
        image_focus_y = $8,
        price_cents = $9,
        currency = $10,
        stock_quantity = $11,
        status = $12,
        options_json = $13::jsonb,
        linked_event_id = $14::uuid,
        event_linking_enabled = $15,
        fulfilment_collect_stand_enabled = $16,
        fulfilment_collect_table_enabled = $17,
        fulfilment_deliver_table_enabled = $18,
        fulfilment_deliver_seat_enabled = $19,
        fulfilment_post_enabled = $20,
        fulfilment_arrange_with_organiser_enabled = $21,
        fulfilment_notes = nullif($22, ''),
        require_booking_reference = $23,
        require_table_number = $24,
        require_seat_number = $25,
        require_guest_name = $26,
        updated_at = now()
      where tenant_slug = $1
        and id = $2
    `,
    [
      tenantSlug,
      productId,
      slug,
      title,
      description,
      imageUrl,
      imageFocusX,
      imageFocusY,
      priceCents,
      currency,
      stockQuantity,
      status,
      JSON.stringify(options),
      linkedEventId,
      eventLinkingEnabled,
      fulfilmentCollectStandEnabled,
      fulfilmentCollectTableEnabled,
      fulfilmentDeliverTableEnabled,
      fulfilmentDeliverSeatEnabled,
      fulfilmentPostEnabled,
      fulfilmentArrangeWithOrganiserEnabled,
      fulfilmentNotes,
      requireBookingReference,
      requireTableNumber,
      requireSeatNumber,
      requireGuestName,
    ],
  );

  revalidatePath("/admin/merchandise");
  revalidatePath(`/admin/merchandise/${productId}`);

  redirect(`/admin/merchandise/${encodeURIComponent(productId)}?saved=1`);
}
