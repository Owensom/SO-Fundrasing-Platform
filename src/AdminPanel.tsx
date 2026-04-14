import React from "react";
import { Database } from "lucide-react";

type Order = {
  id: string;
  fullName?: string;
  email?: string;
  amountTotalCents: number;
  currency?: string;
  status?: string;
  createdAt?: string;
};

function formatMoney(cents: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format((cents || 0) / 100);
}

export default function AdminPanel() {
  // placeholder data (replace later with real API)
  const orders: Order[] = [];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <Database size={28} />
            <h1 style={styles.heading}>Admin Dashboard</h1>
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Orders</h2>

          {orders.length === 0 ? (
            <div style={styles.empty}>
              No orders yet. Purchases will appear here.
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td style={styles.td}>{order.fullName}</td>
                    <td style={styles.td}>{order.email}</td>
                    <td style={styles.td}>
                      {formatMoney(order.amountTotalCents, order.currency)}
                    </td>
                    <td style={styles.td}>{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>System</h2>
          <div style={styles.systemGrid}>
            <div style={styles.systemItem}>
              <strong>Raffles</strong>
              <div>Manage raffles from admin pages</div>
            </div>
            <div style={styles.systemItem}>
              <strong>Purchases</strong>
              <div>Stripe integration coming next</div>
            </div>
            <div style={styles.systemItem}>
              <strong>Tenants</strong>
              <div>Multi-tenant support active</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 24,
    background: "#f3f4f6",
    minHeight: "100vh",
  },
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  heading: {
    fontSize: 28,
    margin: 0,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 12,
  },
  empty: {
    color: "#6b7280",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: 8,
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    padding: 8,
    borderBottom: "1px solid #f3f4f6",
  },
  systemGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
  },
  systemItem: {
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#f9fafb",
  },
};
