import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  getMerchandiseUpgradeMessage,
  getTierLabel,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import { createMerchandiseProduct } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

function cleanText(value: unknown, fallback = "") {
  const clean = String(value ?? "").trim();
  return clean || fallback;
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

export default async function NewMerchandiseProductPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tenantSlug = await requireTenantAccess();
  const params = searchParams ? await searchParams : {};
  const error = cleanText(params.error);

  const tenantSettingsRaw = await getTenantSettings(tenantSlug);
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

  return (
    <main className="admin-merchandise-form-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="form-hero" style={styles.hero}>
        <div>
          <Link href="/admin/merchandise" style={styles.backLink}>
            ← Back to merchandise
          </Link>

          <p style={styles.badge}>Phase 7A setup</p>

          <h1 className="merchandise-form-title" style={styles.title}>
            New merchandise product
          </h1>

          <p style={styles.subtitle}>
            Create the product record now. Public shop display and checkout will
            be connected later after the admin setup is stable.
          </p>

          <p style={styles.tenantLine}>
            Tenant: <strong>{tenantSlug}</strong> · Plan:{" "}
            <strong>{getTierLabel(tier)}</strong>
          </p>
        </div>
      </section>

      {error ? (
        <section style={styles.errorPanel}>
          {error === "title-required"
            ? "Product title is required."
            : "Please check the product details and try again."}
        </section>
      ) : null}

      <form action={createMerchandiseProduct} style={styles.form}>
        <section style={styles.card}>
          <p style={styles.kicker}>Product basics</p>

          <div className="form-grid" style={styles.formGrid}>
            <Field label="Product title" required>
              <input
                name="title"
                type="text"
                placeholder="Example: Brave Ceilidh T-shirt"
                required
                style={styles.input}
              />
            </Field>

            <Field label="Status">
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              name="description"
              placeholder="Short product description for organisers. Public display comes later."
              rows={5}
              style={styles.textarea}
            />
          </Field>
        </section>

        <section style={styles.card}>
          <p style={styles.kicker}>Pricing and stock</p>

          <div className="form-grid" style={styles.formGrid}>
            <Field label="Price" helper="Enter pounds, for example 15 or 15.00.">
              <input
                name="price"
                type="text"
                inputMode="decimal"
                placeholder="15.00"
                defaultValue="0.00"
                style={styles.input}
              />
            </Field>

            <Field label="Currency">
              <input
                name="currency"
                type="text"
                defaultValue="GBP"
                maxLength={3}
                style={styles.input}
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
                placeholder="Optional"
                style={styles.input}
              />
            </Field>
          </div>
        </section>

        <section style={styles.card}>
          <p style={styles.kicker}>Image setup</p>

          <Field
            label="Image URL"
            helper="Use a Cloudinary/image URL for now. Platform image upload can be wired later."
          >
            <input
              name="image_url"
              type="url"
              placeholder="https://..."
              style={styles.input}
            />
          </Field>

          <div className="form-grid" style={styles.formGrid}>
            <Field label="Image focus X" helper="0 left, 50 centre, 100 right.">
              <input
                name="image_focus_x"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue="50"
                style={styles.input}
              />
            </Field>

            <Field label="Image focus Y" helper="0 top, 50 centre, 100 bottom.">
              <input
                name="image_focus_y"
                type="number"
                min="0"
                max="100"
                step="1"
                defaultValue="50"
                style={styles.input}
              />
            </Field>
          </div>
        </section>

        <section style={styles.actions}>
          <button type="submit" style={styles.primaryButton}>
            Create product
          </button>

          <Link href="/admin/merchandise" style={styles.secondaryButton}>
            Cancel
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
  children: React.ReactNode;
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

  .admin-merchandise-form-page .form-grid {
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

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
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
};
