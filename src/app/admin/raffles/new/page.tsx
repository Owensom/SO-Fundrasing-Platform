import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";

export default async function NewRafflePage() {
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
    <main style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
      <h1>Create raffle</h1>

      <p>
        Tenant: <strong>{tenantSlug}</strong>
      </p>

      <form
        action="/api/admin/raffles"
        method="post"
        style={{ display: "grid", gap: 12, marginTop: 24, maxWidth: 640 }}
      >
        <input type="hidden" name="tenantSlug" value={tenantSlug} />

        <label>
          <div style={{ marginBottom: 6 }}>Title</div>
          <input
            name="title"
            required
            style={{ width: "100%", padding: 12 }}
            placeholder="Spring Cash Raffle"
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Slug</div>
          <input
            name="slug"
            required
            style={{ width: "100%", padding: 12 }}
            placeholder="spring-cash-raffle"
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Description</div>
          <textarea
            name="description"
            rows={4}
            style={{ width: "100%", padding: 12 }}
            placeholder="Describe the raffle..."
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Image URL</div>
          <input
            name="image_url"
            style={{ width: "100%", padding: 12 }}
            placeholder="https://..."
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Currency</div>
          <select name="currency" defaultValue="EUR" style={{ width: "100%", padding: 12 }}>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Single ticket price</div>
          <input
            name="ticket_price"
            type="number"
            min="0"
            step="0.01"
            defaultValue="5"
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Total tickets</div>
          <input
            name="total_tickets"
            type="number"
            min="0"
            step="1"
            defaultValue="20"
            style={{ width: "100%", padding: 12 }}
          />
        </label>

        <label>
          <div style={{ marginBottom: 6 }}>Status</div>
          <select name="status" defaultValue="draft" style={{ width: "100%", padding: 12 }}>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="closed">closed</option>
          </select>
        </label>

        <button
          type="submit"
          style={{
            width: "100%",
            padding: 14,
            border: "none",
            borderRadius: 9999,
            background: "#1683f8",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Create raffle
        </button>
      </form>
    </main>
  );
}
