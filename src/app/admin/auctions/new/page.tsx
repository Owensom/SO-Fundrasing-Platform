import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";
import {
  createAuction,
  slugifyAuctionTitle,
  type AuctionStatus,
} from "../../../../../api/_lib/auctions-repo";

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function cleanDateTime(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function cleanFocus(value: FormDataEntryValue | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

async function createAuctionAction(formData: FormData) {
  "use server";

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

  const title = String(formData.get("title") || "").trim() || "Untitled auction";
  const slug =
    String(formData.get("slug") || "").trim().toLowerCase() ||
    slugifyAuctionTitle(title);

  const auction = await createAuction({
    tenantSlug,
    title,
    slug,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: String(formData.get("image_url") || "").trim() || null,
    imageFocusX: cleanFocus(formData.get("image_focus_x")),
    imageFocusY: cleanFocus(formData.get("image_focus_y")),
    status: String(formData.get("status") || "draft") as AuctionStatus,
    currency: String(formData.get("currency") || "GBP").trim() || "GBP",
    opensAt: cleanDateTime(formData.get("opens_at")),
    closesAt: cleanDateTime(formData.get("closes_at")),
    termsText: String(formData.get("terms_text") || "").trim() || null,
  });

  redirect(`/admin/auctions/${auction?.id}`);
}

export default async function NewAuctionPage() {
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

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Silent auction</div>
          <h1 style={styles.title}>Create auction</h1>
          <p style={styles.subtitle}>
            Tenant: <strong>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.nav}>
          <Link href="/admin/auctions" style={styles.navButton}>
            ← Back to auctions
          </Link>

          <Link href="/admin/events" style={styles.navButton}>
            Events
          </Link>

          <Link href="/admin/raffles" style={styles.navButton}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.navButton}>
            Squares
          </Link>
        </div>
      </section>

      <form action={createAuctionAction} style={styles.form}>
        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Auction details</h2>
              <p style={styles.sectionText}>
                Create the public silent auction campaign. Items and bids are
                managed after creation.
              </p>
            </div>
          </div>

          <div style={styles.grid}>
            <label style={styles.label}>
              Auction title
              <input
                name="title"
                required
                placeholder="Charity dinner silent auction"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Public slug
              <input
                name="slug"
                placeholder="charity-dinner-auction"
                style={styles.input}
              />
              <span style={styles.helpText}>
                Leave blank to generate from the title.
              </span>
            </label>

            <label style={styles.label}>
              Status
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label style={styles.label}>
              Currency
              <input name="currency" defaultValue="GBP" style={styles.input} />
            </label>

            <label style={styles.label}>
              Opens
              <input
                name="opens_at"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(null)}
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Closes
              <input
                name="closes_at"
                type="datetime-local"
                defaultValue={toDateTimeLocalValue(null)}
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.label}>
            Description
            <textarea
              name="description"
              placeholder="Tell supporters what this auction is supporting."
              rows={5}
              style={styles.textarea}
            />
          </label>

          <section style={styles.imageFocusPanel}>
            <div>
              <h3 style={styles.subTitle}>Main auction image</h3>
              <p style={styles.sectionText}>
                Upload the main public image, then use the live previews to set
                the image focus point.
              </p>
            </div>

            <div style={styles.uploadBox}>
              <ImageFocusUploadField
                currentImageUrl=""
                currentFocusX={50}
                currentFocusY={50}
                label="Main auction image"
                previewAlt="Auction image preview"
              />
            </div>
          </section>

          <label style={styles.label}>
            Terms / auction rules
            <textarea
              name="terms_text"
              placeholder="Bids are binding. Winning bidders will be contacted after the auction closes..."
              rows={5}
              style={styles.textarea}
            />
          </label>
        </section>

        <section style={styles.actionsCard}>
          <Link href="/admin/auctions" style={styles.cancelButton}>
            Cancel
          </Link>

          <button type="submit" style={styles.saveButton}>
            Create auction
          </button>
        </section>
      </form>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 24,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 38,
    lineHeight: 1.1,
    color: "#0f172a",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
  },
  nav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  navButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  form: {
    display: "grid",
    gap: 18,
  },
  card: {
    padding: 22,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
  },
  subTitle: {
    margin: 0,
    fontSize: 20,
    color: "#0f172a",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 7,
    marginTop: 14,
    color: "#0f172a",
    fontWeight: 900,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 13px",
    fontSize: 15,
    color: "#0f172a",
    background: "#ffffff",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 13px",
    fontSize: 15,
    color: "#0f172a",
    background: "#ffffff",
    resize: "vertical",
    fontFamily: "inherit",
  },
  helpText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
  },
  imageFocusPanel: {
    marginTop: 18,
    padding: 18,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  uploadBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  actionsCard: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  cancelButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  saveButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
};
