import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import { query, queryOne } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  getMerchandiseUpgradeMessage,
  getTierLabel,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import { updateMerchandiseProduct } from "../actions";

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
  description: string;
  image_url: string | null;
  image_focus_x: number | null;
  image_focus_y: number | null;
  price_cents: number;
  currency: string;
  stock_quantity: number | null;
  sold_quantity: number;
  options_json: MerchandiseOption[] | null;
  status: string;
  created_at: string;
  updated_at: string;

  linked_event_id: string | null;
  event_linking_enabled: boolean | null;
  fulfilment_collect_stand_enabled: boolean | null;
  fulfilment_collect_table_enabled: boolean | null;
  fulfilment_deliver_table_enabled: boolean | null;
  fulfilment_deliver_seat_enabled: boolean | null;
  fulfilment_post_enabled: boolean | null;
  fulfilment_arrange_with_organiser_enabled: boolean | null;
  fulfilment_notes: string | null;
  require_booking_reference: boolean | null;
  require_table_number: boolean | null;
  require_seat_number: boolean | null;
  require_guest_name: boolean | null;
};

type MerchandiseEventOption = {
  id: string;
  title: string | null;
  status: string | null;
};

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

const STANDARD_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function normaliseFocus(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function formatMoneyValue(cents: number) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatEventLabel(event: MerchandiseEventOption) {
  const title = cleanText(event.title, "Untitled event");
  const status = cleanText(event.status, "draft");

  return `${title} · ${status}`;
}

function getSizeOptions(product: MerchandiseProduct) {
  if (!Array.isArray(product.options_json)) return [];

  return product.options_json
    .filter((option) => cleanText(option?.type).toLowerCase() === "size")
    .map((option) => cleanText(option?.label || option?.value))
    .filter(Boolean);
}

function getStandardSelectedSizes(product: MerchandiseProduct) {
  const sizeOptions = getSizeOptions(product).map((value) =>
    value.toUpperCase(),
  );

  return new Set(
    sizeOptions.filter((value) => STANDARD_SIZE_OPTIONS.includes(value)),
  );
}

function getCustomSizeOptions(product: MerchandiseProduct) {
  const standardSelected = getStandardSelectedSizes(product);

  return getSizeOptions(product)
    .filter((value) => !standardSelected.has(value.toUpperCase()))
    .join(", ");
}

function isEnabled(value: boolean | null | undefined, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function getLinkedEventLabel({
  linkedEventId,
  eventOptions,
}: {
  linkedEventId: string | null;
  eventOptions: MerchandiseEventOption[];
}) {
  if (!linkedEventId) return "No linked event";

  const matchingEvent = eventOptions.find((event) => event.id === linkedEventId);

  if (!matchingEvent) {
    return "Linked event saved, but not found in this tenant’s current event list";
  }

  return formatEventLabel(matchingEvent);
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

async function getProduct({
  tenantSlug,
  productId,
}: {
  tenantSlug: string;
  productId: string;
}) {
  return queryOne<MerchandiseProduct>(
    `
      select
        id,
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
        sold_quantity,
        options_json,
        status,
        created_at::text,
        updated_at::text,
        linked_event_id::text,
        event_linking_enabled,
        fulfilment_collect_stand_enabled,
        fulfilment_collect_table_enabled,
        fulfilment_deliver_table_enabled,
        fulfilment_deliver_seat_enabled,
        fulfilment_post_enabled,
        fulfilment_arrange_with_organiser_enabled,
        fulfilment_notes,
        require_booking_reference,
        require_table_number,
        require_seat_number,
        require_guest_name
      from merchandise_products
      where tenant_slug = $1
        and id = $2
      limit 1
    `,
    [tenantSlug, productId],
  );
}

async function getTenantEventOptions(tenantSlug: string) {
  return query<MerchandiseEventOption>(
    `
      select
        id::text,
        title,
        status
      from events
      where tenant_slug = $1
      order by
        case
          when status = 'published' then 1
          when status = 'draft' then 2
          when status = 'closed' then 3
          else 4
        end,
        title asc
      limit 100
    `,
    [tenantSlug],
  );
}

export default async function EditMerchandiseProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenantSlug = await requireTenantAccess();
  const { id } = await params;
  const paramsValue = searchParams ? await searchParams : {};
  const error = cleanText(paramsValue.error);
  const saved = cleanText(paramsValue.saved) === "1";

  const [tenantSettingsRaw, product, eventOptions] = await Promise.all([
    getTenantSettings(tenantSlug),
    getProduct({ tenantSlug, productId: id }),
    getTenantEventOptions(tenantSlug),
  ]);

  if (!product) {
    notFound();
  }

  const tenantSettings = tenantSettingsRaw as TenantSettingsLike | null;
  const tier = normaliseSubscriptionTier(tenantSettings?.subscription_tier);

  const subscriptionTenant = {
    subscription_tier: tier,
    subscription_status:
      cleanText(tenantSettings?.subscription_status, "active") || "active",
    platform_owner_bypass: Boolean(tenantSettings?.platform_owner_bypass),
  };

  const merchandiseCapability = checkSubscriptionCapability(
    subscriptionTenant,
    "merchandise",
  );

  if (!merchandiseCapability.allowed) {
    return (
      <main className="admin-merchandise-form-page" style={styles.page}>
        <section style={styles.lockedPanel}>
          <p style={styles.kicker}>Upgrade required</p>
          <h1 style={styles.lockedTitle}>Merchandise is not available</h1>
          <p style={styles.lockedText}>
            {merchandiseCapability.reason || getMerchandiseUpgradeMessage()}
          </p>
          <Link href="/admin/settings/billing" style={styles.primaryButton}>
            View billing →
          </Link>
        </section>
      </main>
    );
  }

  const selectedStandardSizes = getStandardSelectedSizes(product);
  const customSizeOptions = getCustomSizeOptions(product);
  const allSizes = getSizeOptions(product);
  const imageFocusX = normaliseFocus(product.image_focus_x);
  const imageFocusY = normaliseFocus(product.image_focus_y);

  const eventLinkingEnabled = isEnabled(product.event_linking_enabled);
  const collectStandEnabled = isEnabled(
    product.fulfilment_collect_stand_enabled,
    true,
  );
  const collectTableEnabled = isEnabled(
    product.fulfilment_collect_table_enabled,
  );
  const deliverTableEnabled = isEnabled(
    product.fulfilment_deliver_table_enabled,
  );
  const deliverSeatEnabled = isEnabled(product.fulfilment_deliver_seat_enabled);
  const postEnabled = isEnabled(product.fulfilment_post_enabled);
  const arrangeWithOrganiserEnabled = isEnabled(
    product.fulfilment_arrange_with_organiser_enabled,
    true,
  );

  const linkedEventLabel = getLinkedEventLabel({
    linkedEventId: product.linked_event_id,
    eventOptions,
  });

  return (
    <main className="admin-merchandise-form-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="form-hero" style={styles.hero}>
        <div>
          <Link href="/admin/merchandise" style={styles.backLink}>
            ← Back to merchandise
          </Link>

          <p style={styles.badge}>Phase 7C/7D setup</p>

          <h1 className="merchandise-form-title" style={styles.title}>
            Edit merchandise product
          </h1>

          <p style={styles.subtitle}>
            Update the product record. Event linking and fulfilment setup are
            now being prepared, while checkout remains intentionally
            disconnected until a later phase.
          </p>

          <p style={styles.tenantLine}>
            Tenant: <strong>{tenantSlug}</strong> · Plan:{" "}
            <strong>{getTierLabel(tier)}</strong>
          </p>
        </div>
      </section>

      {saved ? (
        <section style={styles.successPanel}>Product saved successfully.</section>
      ) : null}

      {error ? (
        <section style={styles.errorPanel}>
          {error === "title-required"
            ? "Product title is required."
            : "Please check the product details and try again."}
        </section>
      ) : null}

      <section className="product-meta-grid" style={styles.metaPanel}>
        <div>
          <span style={styles.metaLabel}>Product slug</span>
          <strong style={styles.metaValue}>{product.slug}</strong>
        </div>

        <div>
          <span style={styles.metaLabel}>Created</span>
          <strong style={styles.metaValue}>
            {formatDate(product.created_at)}
          </strong>
        </div>

        <div>
          <span style={styles.metaLabel}>Updated</span>
          <strong style={styles.metaValue}>
            {formatDate(product.updated_at)}
          </strong>
        </div>

        <div>
          <span style={styles.metaLabel}>Sold quantity</span>
          <strong style={styles.metaValue}>{product.sold_quantity}</strong>
        </div>
      </section>

      <form action={updateMerchandiseProduct} style={styles.form}>
        <input type="hidden" name="product_id" value={product.id} />

        <section style={styles.card}>
          <p style={styles.kicker}>Product basics</p>

          <div className="form-grid" style={styles.formGrid}>
            <Field label="Product title" required>
              <input
                name="title"
                type="text"
                defaultValue={product.title}
                required
                style={styles.input}
              />
            </Field>

            <Field label="Status">
              <select
                name="status"
                defaultValue={product.status}
                style={styles.input}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              rows={5}
              defaultValue={product.description || ""}
              style={styles.textarea}
            />
          </Field>
        </section>

        <section style={styles.card}>
          <p style={styles.kicker}>Pricing and stock</p>

          <div className="pricing-grid" style={styles.pricingGrid}>
            <Field label="Price" helper="Enter pounds, for example 15 or 15.00.">
              <input
                name="price"
                type="text"
                inputMode="decimal"
                defaultValue={formatMoneyValue(product.price_cents)}
                style={styles.input}
              />
            </Field>

            <Field label="Currency">
              <input
                name="currency"
                type="text"
                defaultValue={product.currency || "GBP"}
                maxLength={3}
                style={styles.currencyInput}
              />
            </Field>

            <Field
              label="Stock quantity"
              helper="Leave blank if stock is not tracked yet."
            >
              <input
                name="stock_quantity"
                type="number"
                min="0"
                step="1"
                defaultValue={product.stock_quantity ?? ""}
                placeholder="Optional"
                style={styles.input}
              />
            </Field>
          </div>
        </section>

        <section style={styles.card}>
          <p style={styles.kicker}>Size options</p>

          <p style={styles.sectionHelp}>
            Use sizes for clothing such as T-shirts, hoodies and tops. Leave
            blank for products without sizes.
          </p>

          <div className="size-grid" style={styles.sizeGrid}>
            {STANDARD_SIZE_OPTIONS.map((size) => (
              <label key={size} style={styles.sizeOption}>
                <input
                  type="checkbox"
                  name="size_options"
                  value={size}
                  defaultChecked={selectedStandardSizes.has(size)}
                  style={styles.checkbox}
                />
                <span>{size}</span>
              </label>
            ))}
          </div>

          <Field
            label="Other sizes or options"
            helper="Optional. Separate with commas, for example Age 11-12, Age 13-14, One size."
          >
            <input
              name="custom_size_options"
              type="text"
              defaultValue={customSizeOptions}
              placeholder="Optional custom sizes"
              style={styles.input}
            />
          </Field>

          <div style={styles.currentOptionsPanel}>
            <span style={styles.currentOptionsLabel}>Current options</span>
            <strong style={styles.currentOptionsValue}>
              {allSizes.length ? allSizes.join(", ") : "No size options set"}
            </strong>
          </div>
        </section>

        <section style={styles.card}>
          <p style={styles.kicker}>Event linking and fulfilment setup</p>

          <p style={styles.sectionHelp}>
            Optional setup for products connected to an event, such as ceilidh
            merchandise, table delivery, collection stands or post-event
            fulfilment. This prepares the product record only. Checkout,
            payments, orders and fulfilment automation are not enabled in this
            phase.
          </p>

          <div style={styles.readinessPanel}>
            <div
              style={{
                ...styles.readinessItem,
                ...(eventLinkingEnabled
                  ? styles.readinessItemGood
                  : styles.readinessItemNeutral),
              }}
            >
              <span style={styles.readinessLabel}>Event linking</span>
              <strong style={styles.readinessValue}>
                {eventLinkingEnabled ? linkedEventLabel : "Not enabled"}
              </strong>
            </div>

            <div
              style={{
                ...styles.readinessItem,
                ...(collectStandEnabled ||
                collectTableEnabled ||
                deliverTableEnabled ||
                deliverSeatEnabled ||
                postEnabled ||
                arrangeWithOrganiserEnabled
                  ? styles.readinessItemGood
                  : styles.readinessItemWarning),
              }}
            >
              <span style={styles.readinessLabel}>Fulfilment options</span>
              <strong style={styles.readinessValue}>
                {collectStandEnabled ||
                collectTableEnabled ||
                deliverTableEnabled ||
                deliverSeatEnabled ||
                postEnabled ||
                arrangeWithOrganiserEnabled
                  ? "At least one option selected"
                  : "Needs at least one option"}
              </strong>
            </div>
          </div>

          <label style={styles.toggleRow}>
            <input
              type="checkbox"
              name="event_linking_enabled"
              value="1"
              defaultChecked={eventLinkingEnabled}
              style={styles.checkbox}
            />
            <span>
              <strong style={styles.toggleTitle}>
                Link this product to an event
              </strong>
              <small style={styles.toggleHelp}>
                Use this when merchandise is designed for a specific event or
                may need table, seat or booking details later.
              </small>
            </span>
          </label>

          <Field
            label="Linked event"
            helper={
              eventOptions.length
                ? "Choose one of this tenant’s events. This only stores the product relationship for later checkout and fulfilment phases."
                : "No tenant events found yet. Create an event first, then return here to link merchandise."
            }
          >
            <select
              name="linked_event_id"
              defaultValue={product.linked_event_id || ""}
              style={styles.input}
            >
              <option value="">No linked event</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {formatEventLabel(event)}
                </option>
              ))}
            </select>
          </Field>

          <div style={styles.currentOptionsPanel}>
            <span style={styles.currentOptionsLabel}>Current linked event</span>
            <strong style={styles.currentOptionsValue}>{linkedEventLabel}</strong>
          </div>

          <div style={styles.fulfilmentBox}>
            <span style={styles.fulfilmentTitle}>Fulfilment choices</span>

            <div className="fulfilment-grid" style={styles.fulfilmentGrid}>
              <CheckboxCard
                name="fulfilment_collect_stand_enabled"
                title="Collect from merchandise stand"
                helper="Best default for event merchandise."
                defaultChecked={collectStandEnabled}
              />

              <CheckboxCard
                name="fulfilment_collect_table_enabled"
                title="Collect from table"
                helper="Useful when the organiser has table packs or table hosts."
                defaultChecked={collectTableEnabled}
              />

              <CheckboxCard
                name="fulfilment_deliver_table_enabled"
                title="Deliver to table"
                helper="For seated events where table delivery may be offered."
                defaultChecked={deliverTableEnabled}
              />

              <CheckboxCard
                name="fulfilment_deliver_seat_enabled"
                title="Deliver to seat"
                helper="For ticketed seating where seat details may be needed."
                defaultChecked={deliverSeatEnabled}
              />

              <CheckboxCard
                name="fulfilment_post_enabled"
                title="Post after event"
                helper="For items that can be sent later."
                defaultChecked={postEnabled}
              />

              <CheckboxCard
                name="fulfilment_arrange_with_organiser_enabled"
                title="Arrange with organiser"
                helper="A safe fallback while fulfilment automation is not live."
                defaultChecked={arrangeWithOrganiserEnabled}
              />
            </div>
          </div>

          <div style={styles.fulfilmentBox}>
            <span style={styles.fulfilmentTitle}>
              Details to request later at checkout
            </span>

            <p style={styles.sectionHelp}>
              These settings only prepare the product. They do not currently
              change checkout or create merchandise orders.
            </p>

            <div className="fulfilment-grid" style={styles.fulfilmentGrid}>
              <CheckboxCard
                name="require_booking_reference"
                title="Booking reference"
                helper="Useful for event-linked collection or table delivery."
                defaultChecked={isEnabled(product.require_booking_reference)}
              />

              <CheckboxCard
                name="require_table_number"
                title="Table number"
                helper="Useful for table collection or delivery."
                defaultChecked={isEnabled(product.require_table_number)}
              />

              <CheckboxCard
                name="require_seat_number"
                title="Seat number"
                helper="Useful for seated events."
                defaultChecked={isEnabled(product.require_seat_number)}
              />

              <CheckboxCard
                name="require_guest_name"
                title="Guest name"
                helper="Useful when buying for someone else."
                defaultChecked={isEnabled(product.require_guest_name)}
              />
            </div>
          </div>

          <Field
            label="Fulfilment notes"
            helper="Optional internal guidance for the organiser. This is setup-only and is not sent to customers yet."
          >
            <textarea
              name="fulfilment_notes"
              rows={4}
              defaultValue={product.fulfilment_notes || ""}
              placeholder="Example: Collect from the merchandise table beside the entrance. Event-linked delivery may be added later."
              style={styles.textarea}
            />
          </Field>
        </section>

        <section style={styles.card}>
          <p style={styles.kicker}>Image setup</p>

          <ImageFocusUploadField
            currentImageUrl={product.image_url || ""}
            currentFocusX={imageFocusX}
            currentFocusY={imageFocusY}
            imageFieldName="image_url"
            focusXFieldName="image_focus_x"
            focusYFieldName="image_focus_y"
            label="Product image"
            previewAlt={`${product.title} product image preview`}
            subscriptionTier={tier}
            customImagesAllowed={merchandiseCapability.allowed}
          />
        </section>

        <section style={styles.actions}>
          <button type="submit" style={styles.primaryButton}>
            Save product
          </button>

          <Link href="/admin/merchandise" style={styles.secondaryButton}>
            Back to merchandise
          </Link>
        </section>
      </form>
    </main>
  );
}

function Field({
  label,
  helper,
  required = false,
  children,
}: {
  label: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label}
        {required ? <strong style={styles.required}> *</strong> : null}
      </span>
      {children}
      {helper ? <span style={styles.helper}>{helper}</span> : null}
    </label>
  );
}

function CheckboxCard({
  name,
  title,
  helper,
  defaultChecked,
}: {
  name: string;
  title: string;
  helper: string;
  defaultChecked: boolean;
}) {
  return (
    <label style={styles.checkboxCard}>
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        style={styles.checkbox}
      />
      <span style={styles.checkboxCardText}>
        <strong style={styles.checkboxCardTitle}>{title}</strong>
        <small style={styles.checkboxCardHelp}>{helper}</small>
      </span>
    </label>
  );
}

const responsiveStyles = `
.admin-merchandise-form-page,
.admin-merchandise-form-page * {
  box-sizing: border-box;
}

.admin-merchandise-form-page {
  overflow-x: hidden;
}

.admin-merchandise-form-page section,
.admin-merchandise-form-page div,
.admin-merchandise-form-page form,
.admin-merchandise-form-page label,
.admin-merchandise-form-page input,
.admin-merchandise-form-page textarea,
.admin-merchandise-form-page select,
.admin-merchandise-form-page a,
.admin-merchandise-form-page button {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 860px) {
  .admin-merchandise-form-page .size-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  }

  .admin-merchandise-form-page .fulfilment-grid {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 780px) {
  .admin-merchandise-form-page .pricing-grid {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-form-page .currency-field {
    max-width: 100% !important;
  }
}

@media (max-width: 720px) {
  .admin-merchandise-form-page {
    padding: 18px 12px 44px !important;
  }

  .admin-merchandise-form-page .form-hero {
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .admin-merchandise-form-page .merchandise-form-title {
    font-size: clamp(38px, 12vw, 56px) !important;
    line-height: 0.98 !important;
  }

  .admin-merchandise-form-page .form-grid,
  .admin-merchandise-form-page .product-meta-grid,
  .admin-merchandise-form-page .size-grid,
  .admin-merchandise-form-page .readiness-grid {
    grid-template-columns: 1fr !important;
  }

  .admin-merchandise-form-page a,
  .admin-merchandise-form-page button {
    width: 100% !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 34%), #f8fafc",
    color: "#0f172a",
    overflowX: "hidden",
  },

  hero: {
    padding: 28,
    borderRadius: 32,
    background:
      "radial-gradient(circle at bottom right, rgba(250,204,21,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    border: "1px solid rgba(148,163,184,0.22)",
  },

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },

  badge: {
    display: "inline-flex",
    margin: "0 0 14px",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(37,99,235,0.22)",
    color: "#dbeafe",
    border: "1px solid rgba(147,197,253,0.34)",
    fontSize: 13,
    fontWeight: 950,
  },

  title: {
    margin: 0,
    fontSize: "clamp(50px, 7vw, 78px)",
    lineHeight: 0.92,
    letterSpacing: "-0.08em",
    color: "#ffffff",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: "18px 0 0",
    maxWidth: 780,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 700,
  },

  tenantLine: {
    margin: "16px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 850,
  },

  form: {
    display: "grid",
    gap: 16,
  },

  card: {
    display: "grid",
    gap: 14,
    padding: 20,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15,23,42,0.05)",
  },

  kicker: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sectionHelp: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 740,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },

  pricingGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(112px, 150px)",
    gap: 14,
    alignItems: "start",
  },

  sizeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 8,
  },

  sizeOption: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 44,
    padding: "9px 10px",
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #dbeafe",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#1683f8",
    flexShrink: 0,
  },

  currentOptionsPanel: {
    display: "grid",
    gap: 5,
    padding: 13,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  currentOptionsLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  currentOptionsValue: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  field: {
    display: "grid",
    gap: 7,
  },

  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },

  required: {
    color: "#dc2626",
  },

  input: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "11px 13px",
    fontSize: 15,
    fontWeight: 750,
    boxSizing: "border-box",
  },

  currencyInput: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "11px 13px",
    fontSize: 15,
    fontWeight: 850,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    textAlign: "center",
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    minHeight: 130,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    padding: "12px 13px",
    fontSize: 15,
    lineHeight: 1.5,
    fontWeight: 730,
    resize: "vertical",
    boxSizing: "border-box",
  },

  helper: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 700,
  },

  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    width: "fit-content",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    textDecoration: "none",
    fontWeight: 950,
    cursor: "pointer",
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    width: "fit-content",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
  },

  errorPanel: {
    padding: 14,
    borderRadius: 18,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 850,
    marginBottom: 16,
  },

  successPanel: {
    padding: 14,
    borderRadius: 18,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontWeight: 850,
    marginBottom: 16,
  },

  lockedPanel: {
    display: "grid",
    gap: 10,
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #fed7aa",
  },

  lockedTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 32,
    letterSpacing: "-0.05em",
  },

  lockedText: {
    margin: 0,
    color: "#7c2d12",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  metaPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    padding: 14,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 16,
    boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
  },

  metaLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 5,
  },

  metaValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  readinessPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  readinessItem: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
  },

  readinessItemGood: {
    background: "#f0fdf4",
    borderColor: "#bbf7d0",
  },

  readinessItemWarning: {
    background: "#fffbeb",
    borderColor: "#fde68a",
  },

  readinessItemNeutral: {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
  },

  readinessLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  readinessValue: {
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 950,
  },

  toggleRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    cursor: "pointer",
  },

  toggleTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.3,
    fontWeight: 950,
  },

  toggleHelp: {
    display: "block",
    marginTop: 4,
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 700,
  },

  fulfilmentBox: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  fulfilmentTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },

  fulfilmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  checkboxCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 76,
    padding: 13,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #dbeafe",
    cursor: "pointer",
  },

  checkboxCardText: {
    display: "grid",
    gap: 4,
  },

  checkboxCardTitle: {
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.25,
    fontWeight: 950,
  },

  checkboxCardHelp: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 700,
  },
};
