import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export default async function AdminDashboardPage() {
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
    <main
      style={{
        maxWidth: 1180,
        margin: "0 auto",
        padding: "34px 16px 60px",
        background:
          "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), #f8fafc",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: 30,
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              padding: "6px 10px",
              borderRadius: 999,
              background: "#dbeafe",
              color: "#1d4ed8",
              fontWeight: 900,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            SO Foundation Platform
          </div>

          <h1
            className="so-brand-heading"
            style={{
              margin: 0,
              fontSize: "clamp(38px, 8vw, 58px)",
              lineHeight: 1,
              letterSpacing: "-0.06em",
              color: "#0f172a",
            }}
          >
            Admin dashboard
          </h1>

          <p
            style={{
              margin: "14px 0 0",
              color: "#64748b",
              fontSize: 16,
              lineHeight: 1.6,
              maxWidth: 760,
            }}
          >
            Manage raffles, squares, events and auctions across your tenant.
          </p>

          <p
            style={{
              margin: "10px 0 0",
              color: "#0f172a",
              fontWeight: 800,
            }}
          >
            Tenant: {tenantSlug}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/c/${tenantSlug}`}
            target="_blank"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "13px 18px",
              borderRadius: 999,
              background: "#ffffff",
              color: "#0f172a",
              border: "1px solid #cbd5e1",
              textDecoration: "none",
              fontWeight: 900,
            }}
          >
            Public campaigns page
          </Link>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
        }}
      >
        <DashboardCard
          href="/admin/raffles"
          emoji="🎟️"
          title="Raffles"
          description="Create, manage and draw fundraising raffles."
        />

        <DashboardCard
          href="/admin/squares"
          emoji="🔲"
          title="Squares"
          description="Run football cards and live squares competitions."
        />

        <DashboardCard
          href="/admin/events"
          emoji="🎫"
          title="Events"
          description="Manage seating plans, ticketing and guest experiences."
        />

        <DashboardCard
          href="/admin/auctions"
          emoji="🔨"
          title="Auctions"
          description="Run premium silent auction fundraising campaigns."
        />
      </section>
    </main>
  );
}

function DashboardCard({
  href,
  emoji,
  title,
  description,
}: {
  href: string;
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
      }}
    >
      <article
        style={{
          height: "100%",
          borderRadius: 28,
          padding: 24,
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            background:
              "linear-gradient(135deg, #eff6ff 0%, #ffffff 50%, #f8fafc 100%)",
            border: "1px solid #dbeafe",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            marginBottom: 18,
          }}
        >
          {emoji}
        </div>

        <h2
          className="so-brand-card-title"
          style={{
            margin: 0,
            fontSize: 28,
            lineHeight: 1.1,
            color: "#0f172a",
            letterSpacing: "-0.04em",
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin: "12px 0 0",
            color: "#64748b",
            lineHeight: 1.65,
            fontSize: 15,
          }}
        >
          {description}
        </p>

        <div
          style={{
            marginTop: 20,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#1683f8",
            fontWeight: 900,
          }}
        >
          Open dashboard →
        </div>
      </article>
    </Link>
  );
}
