import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { normalizeTenantSlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: {
    callbackUrl?: string;
    error?: string;
  };
};

type TenantRow = {
  slug: string;
  name: string | null;
};

function safeCallbackUrl(value: string | null | undefined) {
  const clean = String(value || "").trim();

  if (!clean || !clean.startsWith("/") || clean.startsWith("//")) {
    return "/admin";
  }

  if (clean.startsWith("/admin/login")) return "/admin";
  if (clean.startsWith("/admin/select-tenant")) return "/admin";

  return clean;
}

async function getTenantRows(tenantSlugs: string[]) {
  if (tenantSlugs.length === 0) return [];

  return query<TenantRow>(
    `
      select
        slug,
        name
      from tenants
      where slug = any($1::text[])
      order by
        case when slug = 'demo-a' then 0 else 1 end,
        name asc nulls last,
        slug asc
    `,
    [tenantSlugs],
  );
}

export default async function AdminSelectTenantPage({
  searchParams,
}: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const tenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? Array.from(
        new Set(
          session.user.tenantSlugs
            .map((value) => normalizeTenantSlug(String(value)))
            .filter(Boolean),
        ),
      )
    : [];

  if (tenantSlugs.length === 0) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  if (tenantSlugs.length === 1) {
    redirect(
      `/api/admin/select-tenant?tenant=${encodeURIComponent(
        tenantSlugs[0],
      )}&callbackUrl=${encodeURIComponent(
        safeCallbackUrl(searchParams?.callbackUrl),
      )}`,
    );
  }

  const callbackUrl = safeCallbackUrl(searchParams?.callbackUrl);
  const tenantRows = await getTenantRows(tenantSlugs);

  const tenantCards = tenantSlugs.map((slug) => {
    const row = tenantRows.find((tenant) => tenant.slug === slug);

    return {
      slug,
      name: row?.name || slug,
    };
  });

  return (
    <main style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="select-shell" style={styles.shell}>
        <div style={styles.heroPanel}>
          <div style={styles.logoPill}>SO Fundraising Platform</div>

          <h1 className="select-title" style={styles.title}>
            Choose site
          </h1>

          <p style={styles.subtitle}>
            Your account has access to more than one organisation. Choose the
            site you want to manage.
          </p>

          {searchParams?.error === "tenant_access_denied" ? (
            <div style={styles.errorBox}>
              That account does not have access to the selected site. Choose one
              of your available sites below.
            </div>
          ) : null}
        </div>

        <section style={styles.cardPanel}>
          <div style={styles.cardHeader}>
            <div style={styles.eyebrow}>Available sites</div>
            <h2 style={styles.cardTitle}>Select organisation</h2>
          </div>

          <div style={styles.tenantGrid}>
            {tenantCards.map((tenant) => (
              <form
                key={tenant.slug}
                action="/api/admin/select-tenant"
                method="post"
                style={styles.tenantForm}
              >
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <input type="hidden" name="callbackUrl" value={callbackUrl} />

                <button type="submit" style={styles.tenantButton}>
                  <span style={styles.tenantName}>{tenant.name}</span>
                  <span style={styles.tenantSlug}>{tenant.slug}</span>
                  <span style={styles.manageText}>Manage this site →</span>
                </button>
              </form>
            ))}
          </div>

          <div style={styles.footer}>
            <a href="/api/auth/signout" style={styles.footerLinkMuted}>
              Sign out
            </a>

            <span style={styles.footerDivider}>·</span>

            <a href="/" style={styles.footerLinkMuted}>
              Back to home
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}

const responsiveStyles = `
.select-shell,
.select-shell * {
  box-sizing: border-box;
}

@media (max-width: 860px) {
  .select-shell {
    grid-template-columns: 1fr !important;
  }

  .select-title {
    font-size: clamp(44px, 13vw, 72px) !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 20,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.18), transparent 28%), radial-gradient(circle at bottom right, rgba(22,131,248,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #1e3a8a 100%)",
    color: "#ffffff",
  },

  shell: {
    width: "100%",
    maxWidth: 1040,
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.9fr) minmax(360px, 1fr)",
    gap: 24,
    alignItems: "stretch",
  },

  heroPanel: {
    borderRadius: 34,
    padding: 34,
    minHeight: 420,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.045) 100%)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.34)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  logoPill: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 13px",
    borderRadius: 999,
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.58)",
    background: "rgba(15,23,42,0.22)",
    fontWeight: 950,
    fontSize: 12,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  title: {
    margin: "24px 0 16px",
    fontSize: "clamp(56px, 8vw, 88px)",
    lineHeight: 0.92,
    letterSpacing: "-0.075em",
    color: "#ffffff",
  },

  subtitle: {
    margin: 0,
    color: "#dbeafe",
    fontSize: 18,
    lineHeight: 1.62,
    fontWeight: 700,
  },

  errorBox: {
    marginTop: 18,
    padding: 13,
    borderRadius: 16,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
  },

  cardPanel: {
    borderRadius: 34,
    padding: 24,
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid rgba(219,234,254,0.92)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.28)",
    display: "grid",
    alignContent: "center",
    gap: 18,
  },

  cardHeader: {
    display: "grid",
    gap: 8,
  },

  eyebrow: {
    display: "inline-flex",
    width: "fit-content",
    padding: "7px 11px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 36,
    lineHeight: 1,
    letterSpacing: "-0.05em",
  },

  tenantGrid: {
    display: "grid",
    gap: 12,
  },

  tenantForm: {
    margin: 0,
  },

  tenantButton: {
    width: "100%",
    display: "grid",
    gap: 5,
    textAlign: "left",
    padding: 16,
    borderRadius: 20,
    border: "1px solid #dbeafe",
    background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
    cursor: "pointer",
  },

  tenantName: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },

  tenantSlug: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
    overflowWrap: "anywhere",
  },

  manageText: {
    marginTop: 4,
    color: "#2563eb",
    fontSize: 13,
    fontWeight: 950,
  },

  footer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    flexWrap: "wrap",
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: 800,
  },

  footerLinkMuted: {
    color: "#64748b",
    textDecoration: "none",
    fontWeight: 850,
  },

  footerDivider: {
    color: "#cbd5e1",
  },
};
