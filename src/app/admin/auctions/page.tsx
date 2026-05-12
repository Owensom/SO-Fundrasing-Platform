import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  deleteAuction,
  listAuctions,
  updateAuction,
  type AuctionStatus,
} from "../../../../api/_lib/auctions-repo";

const DEFAULT_AUCTION_IMAGE = "/brand/so-default-auctions.png";
const AUCTION_LOGO_IMAGE = "/brand/so-default-auctions.png";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function focusValue(value: number | null | undefined) {
  const number = Number(value);

  if (!Number.isFinite(number)) return 50;

  return Math.max(0, Math.min(100, Math.round(number)));
}

function getStatusStyle(status: string | null | undefined): CSSProperties {
  const clean = String(status || "draft").toLowerCase();

  if (clean === "published") {
    return {
      background: "#dcfce7",
      color: "#166534",
      borderColor: "#bbf7d0",
    };
  }

  if (clean === "closed") {
    return {
      background: "#fff7ed",
      color: "#9a3412",
      borderColor: "#fed7aa",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function cleanAuctionStatus(value: FormDataEntryValue | null): AuctionStatus {
  const clean = String(value || "").trim().toLowerCase();

  if (clean === "published" || clean === "closed" || clean === "draft") {
    return clean as AuctionStatus;
  }

  return "draft" as AuctionStatus;
}

async function requireAuctionDashboardAccess() {
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

async function updateAuctionStatusAction(formData: FormData) {
  "use server";

  const tenantSlug = await requireAuctionDashboardAccess();

  const id = String(formData.get("id") || "").trim();
  const status = cleanAuctionStatus(formData.get("status"));

  if (!id) {
    redirect("/admin/auctions?error=missing-auction");
  }

  const auctions = await listAuctions(tenantSlug);
  const auction = auctions.find((item) => item.id === id);

  if (!auction || auction.tenant_slug !== tenantSlug) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  await updateAuction(id, {
    status,
  });

  redirect("/admin/auctions?saved=status");
}

async function deleteAuctionAction(formData: FormData) {
  "use server";

  const tenantSlug = await requireAuctionDashboardAccess();

  const id = String(formData.get("id") || "").trim();

  if (!id) {
    redirect("/admin/auctions?error=missing-auction");
  }

  const auctions = await listAuctions(tenantSlug);
  const auction = auctions.find((item) => item.id === id);

  if (!auction || auction.tenant_slug !== tenantSlug) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  if (auction.status !== "closed") {
    redirect("/admin/auctions?error=close-before-delete");
  }

  await deleteAuction(id);

  redirect("/admin/auctions?saved=deleted");
}

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams?: {
    saved?: string;
    error?: string;
  };
}) {
  const tenantSlug = await requireAuctionDashboardAccess();
  const auctions = await listAuctions(tenantSlug);

  const published = auctions.filter(
    (auction) => auction.status === "published",
  ).length;
  const draft = auctions.filter((auction) => auction.status === "draft").length;
  const closed = auctions.filter((auction) => auction.status === "closed").length;

  const liveAuctions = auctions.filter((auction) => auction.status !== "closed");
  const closedAuctions = auctions.filter((auction) => auction.status === "closed");

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <p style={styles.eyebrow}>Auctions admin</p>

          <h1 className="so-brand-heading" style={styles.heroTitle}>
            Manage auctions
          </h1>

          <p style={styles.heroText}>
            Create, publish, close and manage silent auction campaigns for{" "}
            <strong>{tenantSlug}</strong>.
          </p>

          <div style={styles.heroActions}>
            <Link href="/admin" style={styles.secondaryButton}>
              ← Dashboard
            </Link>

            <Link href="/admin/auctions/new" style={styles.primaryButton}>
              + Create auction
            </Link>

            <Link href={`/c/${tenantSlug}`} target="_blank" style={styles.whiteButton}>
              Public site
            </Link>
          </div>
        </div>

        <div style={styles.heroImageWrap}>
          <img
            src={AUCTION_LOGO_IMAGE}
            alt="SO Auctions"
            style={styles.heroImage}
          />
        </div>
      </section>

      <nav style={styles.tabs}>
        <Link href="/admin/raffles" style={styles.tab}>
          Raffles
        </Link>

        <Link href="/admin/squares" style={styles.tab}>
          Squares
        </Link>

        <Link href="/admin/events" style={styles.tab}>
          Events
        </Link>

        <span style={styles.tabActive}>Auctions</span>
      </nav>

      {searchParams?.saved ? (
        <div style={styles.successBox}>Saved successfully.</div>
      ) : null}

      {searchParams?.error ? (
        <div style={styles.errorBox}>
          {searchParams.error === "close-before-delete"
            ? "Close the auction before deleting it."
            : "Please check the auction and try again."}
        </div>
      ) : null}

      <CollapsibleSection
        id="auction-overview"
        eyebrow="Section 1"
        title="Auction overview"
        description="Headline totals and current campaign status."
        defaultOpen
      >
        <section style={styles.statsGrid}>
          <StatCard
            label="Total auctions"
            value={auctions.length}
            image={AUCTION_LOGO_IMAGE}
            accent="#1683f8"
            tint="#eff6ff"
          />

          <StatCard
            label="Published"
            value={published}
            icon="✓"
            accent="#16a34a"
            tint="#ecfdf5"
          />

          <StatCard
            label="Draft"
            value={draft}
            icon="•"
            accent="#64748b"
            tint="#f8fafc"
          />

          <StatCard
            label="Closed"
            value={closed}
            icon="×"
            accent="#d97706"
            tint="#fffbeb"
          />
        </section>
      </CollapsibleSection>

      <CollapsibleSection
        id="auction-campaigns"
        eyebrow="Section 2"
        title="Active auction campaigns"
        description="Manage draft and published auctions. Delete is only available after an auction is closed."
        defaultOpen
      >
        {auctions.length === 0 ? (
          <section style={styles.emptyCard}>
            <h2 className="so-brand-card-title" style={{ margin: 0 }}>
              No auctions yet
            </h2>

            <p style={styles.muted}>Create your first auction campaign.</p>

            <Link href="/admin/auctions/new" style={styles.primaryButton}>
              + Create auction
            </Link>
          </section>
        ) : liveAuctions.length === 0 ? (
          <section style={styles.emptyCard}>
            <h2 className="so-brand-card-title" style={{ margin: 0 }}>
              No active auctions
            </h2>

            <p style={styles.muted}>
              Closed auctions are shown in the delete-after-close section below.
            </p>
          </section>
        ) : (
          <section style={styles.list}>
            {liveAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                statusAction={updateAuctionStatusAction}
                deleteAction={deleteAuctionAction}
              />
            ))}
          </section>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="closed-auctions"
        eyebrow="Section 3"
        title="Closed auctions and delete"
        description="Delete controls only appear here once an auction has been closed."
      >
        {closedAuctions.length === 0 ? (
          <section style={styles.emptyCard}>
            <h2 className="so-brand-card-title" style={{ margin: 0 }}>
              No closed auctions
            </h2>

            <p style={styles.muted}>
              Close an auction first before deleting it from the platform.
            </p>
          </section>
        ) : (
          <section style={styles.list}>
            {closedAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                statusAction={updateAuctionStatusAction}
                deleteAction={deleteAuctionAction}
                showDelete
              />
            ))}
          </section>
        )}
      </CollapsibleSection>
    </main>
  );
}

function AuctionCard({
  auction,
  statusAction,
  deleteAction,
  showDelete = false,
}: {
  auction: any;
  statusAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  showDelete?: boolean;
}) {
  const hasCustomImage = Boolean(auction.image_url);
  const publicStatus = auction.status === "published" ? "Visible" : "Not published";

  return (
    <article style={styles.card}>
      <div style={styles.cardTop}>
        <div style={styles.imageWrap}>
          <img
            src={auction.image_url || DEFAULT_AUCTION_IMAGE}
            alt={auction.title || "SO Auctions"}
            style={{
              ...styles.image,
              objectFit: hasCustomImage ? "cover" : "contain",
              objectPosition: hasCustomImage
                ? `${focusValue(auction.image_focus_x)}% ${focusValue(
                    auction.image_focus_y,
                  )}%`
                : "center",
              padding: hasCustomImage ? 0 : 18,
              background: hasCustomImage
                ? "#f1f5f9"
                : "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={styles.cardMain}>
          <div style={styles.cardHeader}>
            <div style={{ minWidth: 0 }}>
              <h2 className="so-brand-card-title" style={styles.cardTitle}>
                {auction.title || "Untitled auction"}
              </h2>

              <p style={styles.slug}>/a/{auction.slug}</p>
            </div>

            <span style={{ ...styles.status, ...getStatusStyle(auction.status) }}>
              {auction.status}
            </span>
          </div>

          <div style={styles.headlineGrid}>
            <div style={styles.headlineBox}>
              <div style={styles.headlineLabel}>Opens</div>
              <div style={styles.headlineValue}>
                {formatDate(auction.opens_at)}
              </div>
            </div>

            <div style={styles.headlineBox}>
              <div style={styles.headlineLabel}>Closes</div>
              <div style={styles.headlineValue}>
                {formatDate(auction.closes_at)}
              </div>
            </div>
          </div>

          <div style={styles.detailGrid}>
            <Detail label="Opens" value={formatDate(auction.opens_at)} />
            <Detail label="Closes" value={formatDate(auction.closes_at)} />
            <Detail label="Currency" value={auction.currency || "GBP"} />
            <Detail label="Public page" value={publicStatus} />
          </div>

          <details style={styles.toolDetails}>
            <summary style={styles.toolSummary}>
              <span>Status tools</span>
              <span style={styles.toolToggle}>Open / close</span>
            </summary>

            <div style={styles.statusTools}>
              <StatusButton
                auctionId={auction.id}
                status="draft"
                label="Set draft"
                action={statusAction}
                disabled={auction.status === "draft"}
              />

              <StatusButton
                auctionId={auction.id}
                status="published"
                label="Publish"
                action={statusAction}
                disabled={auction.status === "published"}
              />

              <StatusButton
                auctionId={auction.id}
                status="closed"
                label="Close auction"
                action={statusAction}
                disabled={auction.status === "closed"}
                danger
              />

              {showDelete ? (
                <form action={deleteAction} style={styles.deleteForm}>
                  <input type="hidden" name="id" value={auction.id} />
                  <button type="submit" style={styles.deleteButton}>
                    Delete closed auction
                  </button>
                </form>
              ) : (
                <div style={styles.deleteHint}>
                  Delete appears after the auction is closed.
                </div>
              )}
            </div>
          </details>

          <div style={styles.actions}>
            <Link href={`/admin/auctions/${auction.id}`} style={styles.openButton}>
              Manage
            </Link>

            <a
              href={`/a/${auction.slug}`}
              target="_blank"
              rel="noreferrer"
              style={styles.viewButton}
            >
              View auction
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function StatusButton({
  auctionId,
  status,
  label,
  action,
  disabled,
  danger = false,
}: {
  auctionId: string;
  status: AuctionStatus;
  label: string;
  action: (formData: FormData) => Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={action} style={styles.statusForm}>
      <input type="hidden" name="id" value={auctionId} />
      <input type="hidden" name="status" value={status} />

      <button
        type="submit"
        disabled={disabled}
        style={{
          ...styles.statusToolButton,
          background: danger ? "#fff7ed" : "#ffffff",
          color: danger ? "#9a3412" : "#0f172a",
          borderColor: danger ? "#fed7aa" : "#cbd5e1",
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {label}
      </button>
    </form>
  );
}

function CollapsibleSection({
  id,
  title,
  eyebrow,
  description,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  eyebrow?: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} open={defaultOpen} style={styles.section}>
      <summary style={styles.collapsibleSummary}>
        <div style={styles.collapsibleHeading}>
          {eyebrow ? <p style={styles.sectionEyebrow}>{eyebrow}</p> : null}

          <h2 className="so-brand-card-title" style={styles.sectionTitle}>
            {title}
          </h2>

          {description ? <p style={styles.sectionText}>{description}</p> : null}
        </div>

        <span style={styles.collapsibleToggle}>Open / close</span>
      </summary>

      <div style={styles.collapsibleBody}>{children}</div>
    </details>
  );
}

function StatCard({
  label,
  value,
  icon,
  image,
  accent,
  tint,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  image?: string;
  accent: string;
  tint: string;
}) {
  return (
    <div
      style={{
        ...styles.statCard,
        borderTopColor: accent,
      }}
    >
      <div style={styles.statTop}>
        <div>
          <div style={styles.statLabel}>{label}</div>
          <div style={styles.statValue}>{value}</div>
        </div>

        <div
          style={{
            ...styles.statIcon,
            background: tint,
            color: accent,
            borderColor: accent,
            padding: image ? 5 : 0,
            overflow: "hidden",
          }}
        >
          {image ? (
            <img src={image} alt={label} style={styles.statIconImage} />
          ) : (
            icon
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.detail}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value}</div>
    </div>
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
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: 18,
    alignItems: "center",
    padding: 22,
    borderRadius: 24,
    background: "#0f172a",
    color: "#ffffff",
    marginBottom: 16,
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    margin: "0 0 10px",
  },
  heroTitle: {
    margin: 0,
    fontSize: 38,
    lineHeight: 1.02,
    letterSpacing: "-0.055em",
    color: "#ffffff",
    wordBreak: "break-word",
  },
  heroText: {
    margin: "12px 0 0",
    color: "#cbd5e1",
    lineHeight: 1.55,
    maxWidth: 720,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  heroImageWrap: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
    border: "1px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    padding: 28,
    boxSizing: "border-box",
    display: "block",
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  tab: {
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  tabActive: {
    padding: "10px 12px",
    border: "1px solid #0f172a",
    borderRadius: 999,
    color: "#ffffff",
    background: "#0f172a",
    fontWeight: 900,
    fontSize: 14,
  },
  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.24)",
    textDecoration: "none",
    fontWeight: 900,
  },
  whiteButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
  },
  successBox: {
    padding: 12,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 16,
    marginBottom: 12,
    fontWeight: 900,
  },
  errorBox: {
    padding: 12,
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    borderRadius: 16,
    marginBottom: 12,
    fontWeight: 900,
  },
  section: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    marginBottom: 16,
  },
  collapsibleSummary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    cursor: "pointer",
    listStyle: "none",
  },
  collapsibleHeading: {
    minWidth: 0,
  },
  collapsibleToggle: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  collapsibleBody: {
    marginTop: 16,
  },
  sectionEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontWeight: 900,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.02em",
  },
  sectionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
  },
  statCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderTop: "4px solid #1683f8",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  statTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 900,
    flexShrink: 0,
  },
  statIconImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },
  statValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },
  list: {
    display: "grid",
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  cardTop: {
    display: "grid",
    gridTemplateColumns: "132px 1fr",
    gap: 16,
    alignItems: "start",
  },
  imageWrap: {
    width: 132,
    height: 132,
    borderRadius: 20,
    overflow: "hidden",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7)",
  },
  image: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  cardMain: {
    minWidth: 0,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.15,
    color: "#0f172a",
    letterSpacing: "-0.02em",
    wordBreak: "break-word",
  },
  slug: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    wordBreak: "break-word",
  },
  status: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 900,
    textTransform: "capitalize",
  },
  headlineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginTop: 14,
  },
  headlineBox: {
    padding: "13px 14px",
    borderRadius: 16,
    background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
    border: "1px solid #e2e8f0",
  },
  headlineLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
  },
  headlineValue: {
    marginTop: 4,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    wordBreak: "break-word",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 16,
  },
  detail: {
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  detailLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  detailValue: {
    marginTop: 4,
    color: "#0f172a",
    fontWeight: 900,
    wordBreak: "break-word",
  },
  toolDetails: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  toolSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    cursor: "pointer",
    listStyle: "none",
    fontWeight: 950,
    color: "#0f172a",
  },
  toolToggle: {
    flexShrink: 0,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  statusTools: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
    alignItems: "center",
  },
  statusForm: {
    margin: 0,
  },
  statusToolButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 900,
    fontSize: 14,
  },
  deleteHint: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
  },
  viewButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#f8fafc",
    color: "#334155",
    border: "1px solid #dbe3ef",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
    boxShadow: "none",
  },
  deleteForm: {
    margin: 0,
  },
  deleteButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "#dc2626",
    color: "#ffffff",
    border: "none",
    fontWeight: 900,
    fontSize: 14,
    cursor: "pointer",
  },
  emptyCard: {
    padding: 28,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  muted: {
    color: "#64748b",
    margin: "8px 0 18px",
  },
};
