import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  role: string;
  tenantId: string;
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading admin...</div>;

  if (!user) {
    return <div>You must be logged in.</div>;
  }

  if (user.role !== "admin") {
    return <div>Access denied. Admins only.</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Admin Dashboard</h1>

      <p>
        Logged in as <strong>{user.email}</strong>
      </p>
      <p>Tenant: {user.tenantId}</p>

      <hr />

      <h2>Tools</h2>

      <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
        <button onClick={() => alert("TODO: Create raffle")}>
          Create Raffle
        </button>

        <button onClick={() => alert("TODO: Manage raffles")}>
          Manage Raffles
        </button>

        <button onClick={() => alert("TODO: View orders")}>
          View Orders
        </button>

        <button onClick={() => alert("TODO: Tenant settings")}>
          Tenant Settings
        </button>
      </div>
    </div>
  );
}
