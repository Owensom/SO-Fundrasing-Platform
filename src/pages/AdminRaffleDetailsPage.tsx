import { useEffect, useState } from "react";

type AdminRafflePurchasesResponse = {
  raffle: {
    id: string;
    tenantSlug?: string;
    slug: string;
    title: string;
    description: string;
    imageUrl?: string | null;
    ticketPrice: number;
    totalTickets: number;
    soldTickets: number;
    remainingTickets: number;
    isSoldOut: boolean;
    status: string;
    createdAt?: string;
    updatedAt?: string;
  };
  purchases: Array<{
    id: string;
    tenantSlug?: string;
    raffleId?: string;
    raffleSlug?: string;
    customerName: string;
    customerEmail: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    paymentStatus: string;
    paidAt?: string | null;
    createdAt: string;
    updatedAt?: string;
  }>;
  summary: {
    totalTickets: number;
    soldTickets: number;
    remainingTickets: number;
    purchaseCount: number;
  };
  error?: string;
};

export default function AdminRaffleDetailsPage() {
  const [data, setData] = useState<AdminRafflePurchasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const slug = window.location.pathname.split("/").pop();

    if (!slug) {
      setError("Missing raffle slug.");
      setLoading(false);
      return;
    }

    const safeSlug: string = slug;

    async function load() {
      try {
        const response = await fetch(
          `/api/admin/raffle-details?slug=${encodeURIComponent(
            safeSlug
          )}&tenantSlug=demo-a`,
          {
            headers: { "x-tenant-slug": "demo-a" },
          }
        );

        const raw = await response.text();
        const contentType = response.headers.get("content-type") || "";

        let json: AdminRafflePurchasesResponse | null = null;
        if (contentType.includes("application/json")) {
          json = JSON.parse(raw) as AdminRafflePurchasesResponse;
        }

        if (!response.ok) {
          throw new Error(json?.error || raw || "Failed to load raffle details");
        }

        if (!json) {
          throw new Error("Admin API did not return JSON.");
        }

        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) return <div style={styles.page}>Loading...</div>;

  if (error || !data) {
    return (
      <div style={styles.page}>
        <h1>Raffle details</h1>
        <p style={styles.error}>{error || "Not found"}</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin</p>
          <h1 style={styles.title}>{data.raffle.title}</h1>
          <p style={styles.meta}>Slug: {data.raffle.slug}</p>
        </div>

        <div>
          <a
            href={`/admin/raffles/${encodeURIComponent(data.raffle.slug)}/edit`}
            style={styles.editButton}
          >
            Edit raffle
          </a>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard
          label="Total tickets"
          value={String(data.summary.totalTickets)}
        />
        <SummaryCard
          label="Sold tickets"
          value={String(data.summary.soldTickets)}
        />
        <SummaryCard
          label="Remaining"
          value={String(data.summary.remainingTickets)}
        />
        <SummaryCard
          label="Purchases"
          value={String(data.summary.purchaseCount)}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={styles.card}>
      <div style={styles.label}>{label}</div>
      <div style={styles.value}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#f6f7fb",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  eyebrow: {
    fontSize: 14,
    textTransform: "uppercase",
    color: "#64748b",
  },
  title: {
    fontSize: 32,
  },
  meta: {
    color: "#475569",
  },
  editButton: {
    padding: "10px 14px",
    background: "#111827",
    color: "#fff",
    borderRadius: 8,
    textDecoration: "none",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  card: {
    background: "#fff",
    padding: 20,
    borderRadius: 12,
  },
  label: {
    color: "#64748b",
  },
  value: {
    fontSize: 24,
    fontWeight: 700,
  },
  error: {
    color: "red",
  },
};
