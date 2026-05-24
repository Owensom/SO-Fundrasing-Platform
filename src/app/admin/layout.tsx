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

  return (
    <>
      {showAdminBar ? (
        <div style={styles.adminBarShell}>
          <div style={styles.adminBar}>
            <div style={styles.adminIdentity}>
              <span style={styles.adminBadge}>Admin</span>

              <div style={styles.tenantBlock}>
                <span style={styles.tenantLabel}>Current site</span>
                <strong style={styles.tenantName}>
                  {tenantSlug || "Select site"}
                </strong>
              </div>
            </div>

            <nav style={styles.adminActions} aria-label="Admin actions">
              <Link href="/admin" style={styles.adminLink}>
                Dashboard
              </Link>

              {tenantSlugs.length > 1 ? (
                <Link href="/admin/select-tenant" style={styles.adminLink}>
                  Switch site
                </Link>
              ) : null}

              {isPlatformOwner ? (
                <Link href="/admin/platform" style={styles.ownerToolsLink}>
                  Owner tools
                </Link>
              ) : null}

              <a href="/api/auth/signout" style={styles.signOutLink}>
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
  },
};
