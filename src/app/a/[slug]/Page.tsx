import type { CSSProperties } from "react";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  getAuctionBySlug,
  listAuctionItems,
} from "../../../../api/_lib/auctions-repo";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublicAuctionDiagnosticPage({
  params,
}: PageProps) {
  const resolvedParams = await params;
  const tenantSlug = await getTenantSlugFromHeaders();

  let auctionResult: Awaited<ReturnType<typeof getAuctionBySlug>> | null = null;
  let auctionError: string | null = null;
  let itemsCount: number | null = null;
  let itemsError: string | null = null;

  if (tenantSlug) {
    try {
      auctionResult = await getAuctionBySlug(resolvedParams.slug, tenantSlug);
    } catch (error) {
      auctionError =
        error instanceof Error ? error.message : "Unknown auction lookup error";
    }
  }

  if (auctionResult?.id) {
    try {
      const items = await listAuctionItems(auctionResult.id);
      itemsCount = items.length;
    } catch (error) {
      itemsError =
        error instanceof Error ? error.message : "Unknown items lookup error";
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>Silent auction diagnostic</p>

        <h1 style={styles.title}>Public auction route is loading</h1>

        <p style={styles.text}>
          This temporary page proves the route is being hit and shows exactly
          where the auction lookup is failing.
        </p>

        <div style={styles.grid}>
          <div style={styles.row}>
            <span style={styles.label}>Requested slug</span>
            <strong style={styles.value}>{resolvedParams.slug}</strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Tenant slug from headers</span>
            <strong style={styles.value}>{tenantSlug || "MISSING"}</strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Auction found</span>
            <strong style={styles.value}>{auctionResult ? "YES" : "NO"}</strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Auction lookup error</span>
            <strong style={styles.value}>{auctionError || "None"}</strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Auction ID</span>
            <strong style={styles.value}>{auctionResult?.id || "None"}</strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Auction tenant_slug</span>
            <strong style={styles.value}>
              {auctionResult?.tenant_slug || "None"}
            </strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Auction slug in database</span>
            <strong style={styles.value}>{auctionResult?.slug || "None"}</strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Auction title</span>
            <strong style={styles.value}>
              {auctionResult?.title || "None"}
            </strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Auction status</span>
            <strong style={styles.value}>
              {auctionResult?.status || "None"}
            </strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Opens at</span>
            <strong style={styles.value}>
              {auctionResult?.opens_at || "None"}
            </strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Closes at</span>
            <strong style={styles.value}>
              {auctionResult?.closes_at || "None"}
            </strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Items count</span>
            <strong style={styles.value}>
              {itemsCount === null ? "Not checked" : itemsCount}
            </strong>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Items lookup error</span>
            <strong style={styles.value}>{itemsError || "None"}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px 16px",
    background: "#f8fafc",
    color: "#0f172a",
  },
  card: {
    maxWidth: 980,
    margin: "0 auto",
    padding: 28,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  },
  eyebrow: {
    margin: 0,
    color: "#1683f8",
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontSize: 12,
  },
  title: {
    margin: "10px 0 0",
    fontSize: 34,
    letterSpacing: "-0.04em",
  },
  text: {
    margin: "10px 0 22px",
    color: "#475569",
    lineHeight: 1.6,
  },
  grid: {
    display: "grid",
    gap: 10,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "240px minmax(0, 1fr)",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  label: {
    color: "#64748b",
    fontWeight: 850,
  },
  value: {
    color: "#0f172a",
    overflowWrap: "anywhere",
  },
};
