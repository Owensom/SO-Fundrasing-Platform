import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type AdminLayoutUser = {
  tenantSlugs?: string[];
  isPlatformOwner?: boolean | null;
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionUser = session?.user as AdminLayoutUser | undefined;

  const tenantSlugs = Array.isArray(sessionUser?.tenantSlugs)
    ? sessionUser.tenantSlugs.map((value) => String(value)).filter(Boolean)
    : [];

  const showAdminBar = Boolean(session?.user);
  const isPlatformOwner = Boolean(sessionUser?.isPlatformOwner);

  const publicSiteHref = tenantSlug
    ? `/c/${tenantSlug}?adminReturn=${encodeURIComponent("/admin")}`
    : "/admin";

  return (
    <>
      {showAdminBar ? (
        <div className="admin-top-shell" style={styles.adminBarShell}>
          <style>{responsiveStyles}</style>

          <div className="admin-top-bar" style={styles.adminBar}>
            <div className="admin-top-identity" style={styles.adminIdentity}>
              <span style={styles.adminBadge}>Admin</span>

              <div style={styles.tenantBlock}>
                <span style={styles.tenantLabel}>Current site</span>
                <strong style={styles.tenantName}>
                  {tenantSlug || "Select site"}
                </strong>
              </div>
            </div>

            <nav
              className="admin-top-actions"
              style={styles.adminActions}
              aria-label="Admin actions"
            >
              <Link href="/admin" className="admin-top-pill" style={styles.adminLink}>
                Dashboard
              </Link>

              <Link
                href="/admin/launch-readiness"
                className="admin-top-pill admin-top-pill-feature"
                style={styles.launchLink}
              >
                Launch Readiness
              </Link>

              <Link href="/admin/orders" className="admin-top-pill" style={styles.adminLink}>
                Orders
              </Link>

              <Link href="/admin/events" className="admin-top-pill" style={styles.adminLink}>
                Events
              </Link>

              <Link
                href={publicSiteHref}
                target="_blank"
                className="admin-top-pill"
                style={styles.adminLink}
              >
                Public site
              </Link>

              <Link href="/admin/support" className="admin-top-pill" style={styles.adminLink}>
                Support
              </Link>

              {tenantSlugs.length > 1 ? (
                <Link
                  href="/admin/select-tenant"
                  className="admin-top-pill"
                  style={styles.adminLink}
                >
                  Switch site
                </Link>
              ) : null}

              {isPlatformOwner ? (
                <Link
                  href="/admin/platform"
                  className="admin-top-pill admin-top-pill-owner"
                  style={styles.ownerToolsLink}
                >
                  Owner tools
                </Link>
              ) : null}

              <a
                href="/api/auth/signout"
                className="admin-top-pill admin-top-pill-signout"
                style={styles.signOutLink}
              >
                Sign out
              </a>
            </nav>
          </div>
        </div>
      ) : null}

      {children}
    </>
  );
}

const responsiveStyles = `
.admin-top-shell,
.admin-top-shell * {
  box-sizing: border-box;
}

.admin-top-shell {
  overflow-x: hidden;
}

.admin-top-bar,
.admin-top-identity,
.admin-top-actions,
.admin-top-pill {
  min-width: 0;
  max-width: 100%;
}

@media (max-width: 860px) {
  .admin-top-bar {
    display: grid !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
    justify-content: stretch !important;
    gap: 8px !important;
    padding: 9px 12px 10px !important;
  }

  .admin-top-identity {
    width: 100% !important;
    justify-content: flex-start !important;
    gap: 10px !important;
  }

  .admin-top-actions {
    display: flex !important;
    flex-wrap: nowrap !important;
    justify-content: flex-start !important;
    gap: 7px !important;
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch !important;
    scrollbar-width: none !important;
    padding: 0 2px 3px !important;
  }

  .admin-top-actions::-webkit-scrollbar {
    display: none !important;
  }

  .admin-top-pill {
    flex: 0 0 auto !important;
    width: auto !important;
    max-width: none !important;
    min-height: 34px !important;
    padding: 8px 11px !important;
    border-radius: 999px !important;
    font-size: 12px !important;
    line-height: 1.1 !important;
    white-space: nowrap !important;
    text-align: center !important;
  }

  .admin-top-pill-feature {
    min-width: max-content !important;
  }
}

@media (max-width: 420px) {
  .admin-top-bar {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  .admin-top-pill {
    min-height: 32px !important;
    padding: 7px 10px !important;
    font-size: 11.5px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  adminBarShell: {
    width: "100%",
    background:
      "linear-gradient(180deg, #ffffff 0%, rgba(248,250,252,0.98) 100%)",
    borderBottom: "1px solid #e2e8f0",
    boxShadow: "0 8px 22px rgba(15,23,42,0.045)",
    boxSizing: "border-box",
    position: "relative",
    zIndex: 20,
  },

  adminBar: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "10px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    boxSizing: "border-box",
  },

  adminIdentity: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flexWrap: "wrap",
  },

  adminBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  tenantBlock: {
    display: "grid",
    gap: 1,
    minWidth: 0,
  },

  tenantLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    lineHeight: 1.1,
  },

  tenantName: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },

  adminActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },

  adminLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    whiteSpace: "nowrap",
  },

  launchLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background:
      "linear-gradient(135deg, rgba(22,131,248,0.12), rgba(255,255,255,1))",
    color: "#1d4ed8",
    border: "1px solid #93c5fd",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    whiteSpace: "nowrap",
  },

  ownerToolsLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.18), rgba(255,255,255,1))",
    color: "#92400e",
    border: "1px solid #facc15",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    whiteSpace: "nowrap",
  },

  signOutLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 13px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    boxShadow: "0 8px 18px rgba(15,23,42,0.16)",
    whiteSpace: "nowrap",
  },
};
