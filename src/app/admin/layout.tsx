import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const tenantSlug = await getTenantSlugFromHeaders();

  const tenantSlugs = Array.isArray(session?.user?.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value)).filter(Boolean)
    : [];

  const showAdminBar = Boolean(session?.user);

  return (
    <>
      {showAdminBar ? (
        <div style={styles.adminBarShell}>
          <div style={styles.adminBar}>
            <div style={styles.adminIdentity}>
              <span style={styles.adminLabel}>Admin</span>
              <strong style={styles.tenantName}>
                {tenantSlug || "Select site"}
              </strong>
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
    background: "#0f172a",
    borderBottom: "1px solid rgba(148,163,184,0.24)",
    boxSizing: "border-box",
  },

  adminBar: {
    width: "100%",
    maxWidth: 1200,
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

  adminLabel: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    color: "#bfdbfe",
    border: "1px solid rgba(191,219,254,0.22)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  tenantName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 950,
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
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.14)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },

  signOutLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
  },
};
