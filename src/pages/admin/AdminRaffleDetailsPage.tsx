import React from "react";

type Props = {
  raffleId?: string;
};

export default function AdminRaffleDetailsPage({ raffleId }: Props) {
  if (!raffleId) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.heading}>Raffle details</h1>
          <div style={styles.error}>
            Missing raffle id. Open this page from the admin raffle list.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Raffle details</h1>
        <div style={styles.card}>
          <div style={styles.text}>Raffle ID: {raffleId}</div>
          <div style={styles.muted}>
            This page needs to be opened with a valid raffle id from your admin list.
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
    maxWidth: 900,
    margin: "0 auto",
  },
  heading: {
    marginBottom: 20,
    fontSize: 28,
  },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
  },
  text: {
    fontSize: 16,
    fontWeight: 600,
  },
  muted: {
    marginTop: 10,
    color: "#6b7280",
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    padding: 12,
    borderRadius: 10,
  },
};
