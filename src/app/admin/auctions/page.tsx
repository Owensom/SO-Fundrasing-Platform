import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  deleteAuction,
  listAuctions,
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
      background: "#ecfdf5",
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
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

async function deleteAuctionAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const id = String(formData.get("id") || "").trim();
  if (id) await deleteAuction(id);

  redirect("/admin/auctions");
}

export default async function AdminAuctionsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlug = await getTenantSlugFromHeaders();
  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((v) => String(v))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  const auctions = await listAuctions(tenantSlug);

  const published = auctions.filter(
    (auction) => auction.status === "published",
  ).length;
  const draft = auctions.filter((auction) => auction.status === "draft").length;
  const closed = auctions.filter((auction) => auction.status === "closed").length;

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div style={styles.badge}>Admin dashboard</div>

          <h1 className="so-brand-heading" style={styles.title}>
            Manage auctions
          </h1>

          <p style={styles.subtitle}>
            Tenant: <strong style={{ color: "#0f172a" }}>{tenantSlug}</strong>
          </p>
        </div>

        <div style={styles.nav}>
          <Link href="/admin" style={styles.navButton}>
            ← Dashboard
          </Link>

          <Link href="/admin/raffles" style={styles.navButton}>
            Raffles
          </Link>

          <Link href="/admin/squares" style={styles.navButton}>
            Squares
          </Link>

          <Link href="/admin/events" style={styles.navButton}>
            Events
          </Link>

          <div style={styles.navButtonActive}>Auctions</div>

          <Link href={`/c/${tenantSlug}`} target="_blank" style={styles.navButton}>
            Public site
          </Link>

          <Link href="/admin/auctions/new" style={styles.createButton}>
            + Create auction
          </Link>
        </div>
      </section>

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

      {auctions.length === 0 ? (
        <section style={styles.emptyCard}>
          <h2 className="so-brand-card-title" style={{ margin: 0 }}>
            No auctions yet
          </h2>

          <p style={styles.muted}>Create your first auction campaign.</p>

          <Link href="/admin/auctions/new" style={styles.createButton}>
            + Create auction
          </Link>
        </section>
      ) : (
        <section style={styles.list}>
          {auctions.map((auction) => {
            const hasCustomImage = Boolean(auction.image_url);
            const publicStatus =
              auction.status === "published" ? "Visible" : "Not published";

            return (
              <article key={auction.id} style={styles.card}>
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
                        padding: hasCustomImage ? 0 : 12,
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
                        <h2
                          className="so-brand-card-title"
                          style={styles.cardTitle}
                        >
                          {auction.title || "Untitled auction"}
                        </h2>

                        <p style={styles.slug}>/a/{auction.slug}</p>
                      </div>

                      <span
                        style={{
                          ...styles.status,
                          ...getStatusStyle(auction.status),
                        }}
                      >
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

                    <div style={styles.actions}>
                      <Link
                        href={`/admin/auctions/${auction.id}`}
                        style={styles.openButton}
                      >
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

                      <form action={deleteAuctionAction} style={styles.deleteForm}>
                        <input type="hidden" name="id" value={auction.id} />
                        <button type="submit" style={styles.deleteButton}>
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
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
            padding: image ? 4 : 0,
            overflow: "hidden",
          }}
        >
          {image ? (
            <img
              src={image}
              alt={label}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
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
    padding: "32px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 22,
  },
  badge: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 10,
  },
  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },
  subtitle: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 15,
  },
  nav: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  navButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 900,
  },
  navButtonActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 900,
  },
  createButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "13px 18px",
    borderRadius: 9999,
    background: "#1683f8",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 22,
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
    width: 34,
    height: 34,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 900,
    flexShrink: 0,
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
    gridTemplateColumns: "104px 1fr",
    gap: 16,
    alignItems: "start",
  },
  imageWrap: {
    width: 104,
    height: 104,
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
    borderRadius: 9999,
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
