import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  role: string;
  tenantId: string;
};

type MeResponse = {
  user?: User | null;
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load user");
        }

        const data: MeResponse = await res.json();

        if (mounted) {
          setUser(data.user ?? null);
        }
      } catch {
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading admin...</div>;
  }

  if (!user) {
    return <div style={{ padding: 24 }}>No active session.</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Admin Dashboard</h1>
          <p>
            Signed in as <strong>{user.email}</strong>
          </p>
          <p>Tenant: {user.tenantId}</p>
          <p>Role: {user.role}</p>
        </div>

        <button onClick={handleLogout}>Logout</button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2>Raffles</h2>
          <p>Create, edit, and manage raffles for this tenant.</p>
          <button>Create Raffle</button>
        </section>

        <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2>Orders</h2>
          <p>Review purchases, payments, and buyer activity.</p>
          <button>View Orders</button>
        </section>

        <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2>Buyers</h2>
          <p>Look up entrants and export buyer data later.</p>
          <button>View Buyers</button>
        </section>

        <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2>Tenant Settings</h2>
          <p>Update tenant branding and configuration.</p>
          <button>Open Settings</button>
        </section>
      </div>
    </div>
  );
}
