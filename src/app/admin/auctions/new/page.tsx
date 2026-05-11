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

const DEFAULT_AUCTION_IMAGE_URL = "/brand/so-default-auctions.png";

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

  const submittedImageUrl = String(formData.get("image_url") || "").trim();

  const auction = await createAuction({
    tenantSlug,
    title,
    slug,
    description: String(formData.get("description") || "").trim() || null,
    imageUrl: submittedImageUrl || DEFAULT_AUCTION_IMAGE_URL,
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
      <section style={styles.hero}>
        <div style={styles.heroCopy}>
          <div style={styles.eyebrow}>Silent auction builder</div>
          <h1 style={styles.title}>Create a premium silent auction</h1>
          <p style={styles.subtitle}>
            Build the auction shell first, then add lots, images, bids and
            winner management from the edit screen.
          </p>

          <div style={styles.heroStats}>
            <div style={styles.heroStat}>
              <span>Tenant</span>
              <strong>{tenantSlug}</strong>
            </div>
            <div style={styles.heroStat}>
              <span>Public path</span>
              <strong>/a/your-slug</strong>
            </div>
            <div style={styles.heroStat}>
              <span>Recommended</span>
              <strong>Start as draft</strong>
            </div>
          </div>
        </div>

        <div style={styles.heroImageWrap}>
          <div
            aria-label="Default auction campaign image"
            role="img"
            style={{
              ...styles.heroImage,
              backgroundImage: `url(${DEFAULT_AUCTION_IMAGE_URL})`,
            }}
          />
        </div>
      </section>

      <section style={styles.topActions}>
        <Link href="/admin/auctions" style={styles.secondaryButton}>
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
      </section>

      <form action={createAuctionAction} style={styles.form}>
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardKicker}>Step 1</p>
              <h2 style={styles.sectionTitle}>Core auction details</h2>
              <p style={styles.sectionText}>
                These details create the public auction campaign and control
                whether supporters can view or bid.
              </p>
            </div>
          </div>

          <div style={styles.fieldGrid}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Auction title</span>
              <input
                name="title"
                required
                placeholder="Friends of Anchor Silent Auction"
                style={styles.input}
              />
              <span style={styles.fieldHelpSpacer} />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Public slug</span>
              <input
                name="slug"
                placeholder="friends-of-anchor"
                style={styles.input}
              />
              <span style={styles.helpText}>
                Leave blank to generate from the title.
              </span>
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Status</span>
              <select name="status" defaultValue="draft" style={styles.input}>
                <option value="draft">Draft — hidden from public bidding</option>
                <option value="published">
                  Published — visible and open by dates
                </option>
                <option value="closed">
                  Closed — visible but not accepting bids
                </option>
              </select>
              <span style={styles.fieldHelpSpacer} />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Currency</span>
              <input name="currency" defaultValue="GBP" style={styles.input} />
              <span style={styles.fieldHelpSpacer} />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Opens</span>
              <input
                name="opens_at"
                type="datetime-local"
                style={styles.input}
              />
              <span style={styles.fieldHelpSpacer} />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>Closes</span>
              <input
                name="closes_at"
                type="datetime-local"
                style={styles.input}
              />
              <span style={styles.fieldHelpSpacer} />
            </label>
          </div>

          <label style={styles.fullWidthField}>
            <span style={styles.fieldLabel}>Description</span>
            <textarea
              name="description"
              placeholder="Tell supporters what this auction is supporting and why their bids matter."
              rows={5}
              style={styles.textarea}
            />
          </label>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardKicker}>Step 2</p>
              <h2 style={styles.sectionTitle}>Public auction image</h2>
              <p style={styles.sectionText}>
                A branded auction image is already selected. Upload a custom
                campaign image only if you want to replace it. The focus controls
                help the public page crop the image cleanly on desktop and
                mobile.
              </p>
            </div>
          </div>

          <div style={styles.uploadShell}>
            <ImageFocusUploadField
              currentImageUrl={DEFAULT_AUCTION_IMAGE_URL}
              currentFocusX={50}
              currentFocusY={50}
              label="Main auction image"
              previewAlt="Auction image preview"
            />
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <p style={styles.cardKicker}>Step 3</p>
              <h2 style={styles.sectionTitle}>Auction rules</h2>
              <p style={styles.sectionText}>
                Optional public terms shown underneath the auction. Keep this
                short and clear.
              </p>
            </div>
          </div>

          <label style={styles.fullWidthField}>
            <span style={styles.fieldLabel}>Terms / auction rules</span>
            <textarea
              name="terms_text"
              placeholder="Bids are binding. Winning bidders will be contacted after the auction closes. Payment and collection details will be confirmed by the organiser."
              rows={6}
              style={styles.textarea}
            />
          </label>
        </section>

        <section style={styles.nextCard}>
          <div>
            <h2 style={styles.nextTitle}>Next: add auction items</h2>
            <p style={styles.nextText}>
              After creation you’ll be taken to the edit page, where items,
              donors, images, starting bids and increments are managed.
            </p>
          </div>

          <div style={styles.actionRow}>
            <Link href="/admin/auctions" style={styles.cancelButton}>
              Cancel
            </Link>

            <button type="submit" style={styles.saveButton}>
              Create auction
            </button>
          </div>
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
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.14), transparent 34%), #f8fafc",
    minHeight: "100vh",
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(250px, 360px)",
    gap: 24,
    alignItems: "center",
    padding: 30,
    borderRadius: 32,
    marginBottom: 18,
    background:
      "linear-gradient(135deg, #0f172a 0%, #172554 48%, #78350f 122%)",
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
  },
  heroCopy: {
    position: "relative",
    zIndex: 2,
  },
  heroImageWrap: {
    position: "relative",
    zIndex: 2,
    borderRadius: 26,
    overflow: "hidden",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
  },
  heroImage: {
    width: "100%",
    height: 250,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  eyebrow: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.16)",
    color: "#fef3c7",
    border: "1px solid rgba(251,191,36,0.3)",
    fontSize: 13,
    fontWeight: 950,
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: "clamp(34px, 7vw, 58px)",
    lineHeight: 1,
    letterSpacing: "-0.055em",
    maxWidth: 760,
  },
  subtitle: {
    margin: "14px 0 0",
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 1.65,
    maxWidth: 760,
  },
  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginTop: 24,
  },
  heroStat: {
    display: "grid",
    gap: 5,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.13)",
  },
  topActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  secondaryButton: {
    padding: "11px 15px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
  },
  navButton: {
    padding: "11px 15px",
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
    padding: 24,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 14px rgba(15,23,42,0.05)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  cardKicker: {
    margin: "0 0 7px",
    color: "#b45309",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 950,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 26,
    color: "#0f172a",
    letterSpacing: "-0.035em",
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    columnGap: 14,
    rowGap: 16,
    alignItems: "start",
  },
  field: {
    display: "grid",
    gridTemplateRows: "24px 58px 18px",
    gap: 6,
    color: "#0f172a",
    fontWeight: 900,
    minWidth: 0,
  },
  fullWidthField: {
    display: "grid",
    gap: 7,
    marginTop: 16,
    color: "#0f172a",
    fontWeight: 900,
  },
  fieldLabel: {
    display: "flex",
    alignItems: "center",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1.2,
  },
  input: {
    width: "100%",
    height: 58,
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
    lineHeight: 1.2,
  },
  fieldHelpSpacer: {
    minHeight: 18,
  },
  uploadShell: {
    padding: 16,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  nextCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 28,
    background: "#0f172a",
    color: "#ffffff",
    boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
  },
  nextTitle: {
    margin: 0,
    fontSize: 24,
    letterSpacing: "-0.03em",
  },
  nextText: {
    margin: "7px 0 0",
    color: "#cbd5e1",
    lineHeight: 1.55,
  },
  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  cancelButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 950,
  },
  saveButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "#f59e0b",
    color: "#111827",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(245,158,11,0.22)",
  },
};
