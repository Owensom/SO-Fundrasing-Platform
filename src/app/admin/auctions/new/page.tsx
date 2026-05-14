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
      <section style={styles.topActions}>
        <Link href="/admin/auctions" style={styles.backButton}>
          ← Back to auctions
        </Link>

        <Link href="/admin" style={styles.dashboardButton}>
          Dashboard
        </Link>
      </section>

      <section style={styles.hero}>
        <div style={styles.heroCopy}>
          <div style={styles.eyebrow}>Auction builder</div>

          <div style={styles.titleRow}>
            <h1 style={styles.title}>Build a premium silent auction</h1>
            <span style={styles.statusPill}>Draft</span>
          </div>

          <p style={styles.pathText}>/a/auction-slug</p>

          <p style={styles.subtitle}>
            Create the public auction page, set timing, upload a polished
            campaign image and prepare your auction for items, bids and winner
            management.
          </p>

          <div style={styles.callout}>
            Ideal for charity dinners, galas, fundraising evenings, prize
            auctions, business donations and supporter-led campaigns.
          </div>

          <div style={styles.heroStats}>
            <div style={styles.heroStat}>
              <span>Auction type</span>
              <strong>Silent auction</strong>
            </div>

            <div style={styles.heroStat}>
              <span>Status</span>
              <strong>Draft</strong>
            </div>

            <div style={styles.heroStat}>
              <span>Public path</span>
              <strong>/a/slug</strong>
            </div>

            <div style={styles.heroStat}>
              <span>Items</span>
              <strong>Add next</strong>
            </div>
          </div>
        </div>

        <aside style={styles.previewPanel}>
          <div style={styles.previewKicker}>Public preview</div>

          <div style={styles.previewImageCard}>
            <img
              src={DEFAULT_AUCTION_IMAGE_URL}
              alt="Default auction campaign preview"
              style={styles.previewImage}
            />
          </div>

          <div style={styles.previewInfoCard}>
            <h2 style={styles.previewTitle}>Your auction title</h2>

            <p style={styles.previewText}>
              A short public summary of your auction will appear here.
            </p>

            <div style={styles.previewMetaGrid}>
              <span>Silent auction</span>
              <span>Date to be confirmed</span>
              <span>Items added later</span>
              <span>Draft</span>
            </div>
          </div>
        </aside>
      </section>

      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span>Auction type</span>
          <strong>Silent auction</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Starting status</span>
          <strong>Draft</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Currency</span>
          <strong>GBP</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Public image</span>
          <strong>Ready</strong>
        </div>

        <div style={styles.summaryCard}>
          <span>Items</span>
          <strong>Next step</strong>
        </div>
      </section>

      <form action={createAuctionAction} style={styles.form}>
        <section style={styles.layoutGrid}>
          <div style={styles.mainColumn}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <p style={styles.cardKicker}>Section 1</p>

                <h2 style={styles.sectionTitle}>Auction basics</h2>

                <p style={styles.sectionText}>
                  Set the public title, slug, description, status and dates that
                  supporters see first.
                </p>
              </div>

              <div style={styles.fieldGrid}>
                <label style={styles.fieldWide}>
                  <span style={styles.fieldLabel}>Auction title</span>

                  <input
                    name="title"
                    required
                    placeholder="Friends of Anchor Silent Auction"
                    style={styles.input}
                  />
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

                  <select
                    name="status"
                    defaultValue="draft"
                    style={styles.input}
                  >
                    <option value="draft">
                      Draft — hidden from public bidding
                    </option>
                    <option value="published">
                      Published — visible and open by dates
                    </option>
                    <option value="closed">
                      Closed — visible but not accepting bids
                    </option>
                  </select>
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Currency</span>

                  <input
                    name="currency"
                    defaultValue="GBP"
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Opens</span>

                  <input
                    name="opens_at"
                    type="datetime-local"
                    style={styles.input}
                  />
                </label>

                <label style={styles.field}>
                  <span style={styles.fieldLabel}>Closes</span>

                  <input
                    name="closes_at"
                    type="datetime-local"
                    style={styles.input}
                  />
                </label>

                <label style={styles.fieldFull}>
                  <span style={styles.fieldLabel}>Description</span>

                  <textarea
                    name="description"
                    placeholder="Tell supporters what this auction is supporting and why their bids matter."
                    rows={5}
                    style={styles.textarea}
                  />
                </label>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <p style={styles.cardKicker}>Section 2</p>

                <h2 style={styles.sectionTitle}>Public auction image</h2>

                <p style={styles.sectionText}>
                  A branded auction image is already selected. Upload a custom
                  campaign image only if you want to replace it.
                </p>
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
                <p style={styles.cardKicker}>Section 3</p>

                <h2 style={styles.sectionTitle}>Auction rules</h2>

                <p style={styles.sectionText}>
                  Optional public terms shown underneath the auction. Keep this
                  short and clear.
                </p>
              </div>

              <label style={styles.fieldFull}>
                <span style={styles.fieldLabel}>Terms / auction rules</span>

                <textarea
                  name="terms_text"
                  placeholder="Bids are binding. Winning bidders will be contacted after the auction closes. Payment and collection details will be confirmed by the organiser."
                  rows={6}
                  style={styles.textarea}
                />
              </label>
            </section>
          </div>

          <aside style={styles.sideColumn}>
            <section style={styles.readinessCard}>
              <p style={styles.cardKicker}>Campaign readiness</p>

              <h2 style={styles.sideTitle}>Before publishing</h2>

              <div style={styles.checkList}>
                <div style={styles.checkItem}>
                  <span style={styles.checkDot}>1</span>
                  <span>Add auction title</span>
                </div>

                <div style={styles.checkItem}>
                  <span style={styles.checkDot}>2</span>
                  <span>Set opening and closing times</span>
                </div>

                <div style={styles.checkItem}>
                  <span style={styles.checkDot}>3</span>
                  <span>Add items from the edit screen</span>
                </div>

                <div style={styles.checkItem}>
                  <span style={styles.checkDot}>4</span>
                  <span>Publish when ready for bidding</span>
                </div>
              </div>
            </section>

            <section style={styles.helpCard}>
              <h2 style={styles.sideTitle}>What happens next?</h2>

              <p style={styles.sideText}>
                After creation you’ll be taken to the auction edit page, where
                items, donors, images, starting bids, increments and winner
                tools are managed.
              </p>
            </section>
          </aside>
        </section>

        <section style={styles.nextCard}>
          <div style={styles.nextCopy}>
            <h2 style={styles.nextTitle}>Ready to create the auction?</h2>

            <p style={styles.nextText}>
              Save the auction shell now, then add the lots and bidding details
              on the next screen.
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
    width: "100%",
    maxWidth: 1280,
    margin: "0 auto",
    padding: "28px 16px 64px",
    minHeight: "100vh",
    overflowX: "hidden",
    boxSizing: "border-box",
    background:
      "radial-gradient(circle at top left, rgba(251,191,36,0.13), transparent 32%), #f8fafc",
  },

  topActions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  backButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
    minHeight: 44,
  },

  dashboardButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "12px 18px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 24px rgba(15,23,42,0.16)",
    minHeight: 44,
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: 26,
    alignItems: "stretch",
    padding: "clamp(20px, 5vw, 32px)",
    borderRadius: 30,
    marginBottom: 18,
    background:
      "linear-gradient(135deg, #070f24 0%, #111c3d 48%, #1e2b63 100%)",
    color: "#ffffff",
    boxShadow: "0 24px 60px rgba(15,23,42,0.22)",
    overflow: "hidden",
    minWidth: 0,
  },

  heroCopy: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  },

  eyebrow: {
    display: "inline-flex",
    alignSelf: "flex-start",
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.18)",
    color: "#cbd5e1",
    textTransform: "uppercase",
    letterSpacing: "0.11em",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 16,
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    minWidth: 0,
  },

  title: {
    margin: 0,
    fontSize: "clamp(34px, 9vw, 62px)",
    lineHeight: 0.98,
    letterSpacing: "-0.065em",
    maxWidth: 760,
    overflowWrap: "anywhere",
    minWidth: 0,
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 13px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.22)",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
    flexShrink: 0,
  },

  pathText: {
    margin: "16px 0 0",
    color: "#cbd5e1",
    fontSize: 16,
    fontWeight: 950,
    fontStyle: "italic",
    overflowWrap: "anywhere",
  },

  subtitle: {
    margin: "18px 0 0",
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 1.6,
    maxWidth: 720,
    overflowWrap: "anywhere",
  },

  callout: {
    marginTop: 18,
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#dbeafe",
    fontWeight: 900,
    lineHeight: 1.35,
    maxWidth: 680,
    overflowWrap: "anywhere",
  },

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 135px), 1fr))",
    gap: 12,
    marginTop: 24,
    minWidth: 0,
  },

  heroStat: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.13)",
    minWidth: 0,
    overflow: "hidden",
  },

  previewPanel: {
    alignSelf: "stretch",
    padding: 16,
    borderRadius: 26,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },

  previewKicker: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 12,
  },

  previewImageCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 220,
    borderRadius: 20,
    background: "#ffffff",
    overflow: "hidden",
    marginBottom: 12,
  },

  previewImage: {
    width: "100%",
    height: "100%",
    maxHeight: 250,
    objectFit: "contain",
    display: "block",
  },

  previewInfoCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
    minWidth: 0,
  },

  previewTitle: {
    margin: 0,
    fontSize: 20,
    letterSpacing: "-0.03em",
    overflowWrap: "anywhere",
  },

  previewText: {
    margin: "6px 0 12px",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 750,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },

  previewMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 130px), 1fr))",
    gap: 8,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  summaryCard: {
    display: "grid",
    gap: 5,
    padding: 18,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 22px rgba(15,23,42,0.06)",
    minWidth: 0,
    overflowWrap: "anywhere",
  },

  form: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  layoutGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: 18,
    alignItems: "start",
    minWidth: 0,
  },

  mainColumn: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  sideColumn: {
    display: "grid",
    gap: 18,
    position: "static",
    minWidth: 0,
  },

  card: {
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    overflow: "hidden",
    minWidth: 0,
  },

  cardHeader: {
    marginBottom: 18,
  },

  cardKicker: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontWeight: 950,
  },

  sectionTitle: {
    margin: 0,
    fontSize: "clamp(24px, 6vw, 28px)",
    color: "#0f172a",
    letterSpacing: "-0.04em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 650,
    overflowWrap: "anywhere",
  },

  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 16,
    alignItems: "start",
    minWidth: 0,
  },

  field: {
    display: "grid",
    gap: 7,
    color: "#0f172a",
    fontWeight: 900,
    minWidth: 0,
  },

  fieldWide: {
    display: "grid",
    gridColumn: "1 / -1",
    gap: 7,
    color: "#0f172a",
    fontWeight: 900,
    minWidth: 0,
  },

  fieldFull: {
    display: "grid",
    gridColumn: "1 / -1",
    gap: 7,
    color: "#0f172a",
    fontWeight: 900,
    minWidth: 0,
  },

  fieldLabel: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1.2,
  },

  input: {
    width: "100%",
    height: 56,
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 13px",
    fontSize: 16,
    color: "#0f172a",
    background: "#ffffff",
    outlineColor: "#2563eb",
    minWidth: 0,
  },

  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "12px 13px",
    fontSize: 16,
    color: "#0f172a",
    background: "#ffffff",
    resize: "vertical",
    fontFamily: "inherit",
    outlineColor: "#2563eb",
    minWidth: 0,
  },

  helpText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },

  uploadShell: {
    padding: 16,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    minWidth: 0,
  },

  readinessCard: {
    padding: 22,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15,23,42,0.06)",
    minWidth: 0,
    overflow: "hidden",
  },

  helpCard: {
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
    minWidth: 0,
    overflow: "hidden",
  },

  sideTitle: {
    margin: 0,
    color: "inherit",
    fontSize: 22,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  sideText: {
    margin: "10px 0 0",
    color: "#cbd5e1",
    lineHeight: 1.55,
    fontWeight: 650,
    overflowWrap: "anywhere",
  },

  checkList: {
    display: "grid",
    gap: 12,
    marginTop: 16,
  },

  checkItem: {
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
    color: "#334155",
    fontWeight: 900,
    lineHeight: 1.25,
    minWidth: 0,
  },

  checkDot: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 950,
  },

  nextCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 28,
    background: "#0f172a",
    color: "#ffffff",
    boxShadow: "0 18px 42px rgba(15,23,42,0.18)",
    minWidth: 0,
    overflow: "hidden",
  },

  nextCopy: {
    minWidth: 0,
    flex: "1 1 260px",
  },

  nextTitle: {
    margin: 0,
    fontSize: "clamp(22px, 5vw, 25px)",
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  nextText: {
    margin: "7px 0 0",
    color: "#cbd5e1",
    lineHeight: 1.55,
    fontWeight: 650,
    overflowWrap: "anywhere",
  },

  actionRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    minWidth: 0,
  },

  cancelButton: {
    padding: "12px 18px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    textDecoration: "none",
    fontWeight: 950,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
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
    minHeight: 44,
  },
};
};
