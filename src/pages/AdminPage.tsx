import { FormEvent, useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  email: string;
  role: string;
  tenantId: string;
};

type MeResponse = {
  user?: User | null;
};

type Raffle = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  isPublished: boolean;
  createdAt: string;
};

type RafflesResponse = {
  raffles: Raffle[];
};

type CreateRaffleResponse = {
  raffle?: Raffle;
  message?: string;
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rafflesLoading, setRafflesLoading] = useState(true);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState("5");
  const [maxTickets, setMaxTickets] = useState("100");
  const [isPublished, setIsPublished] = useState(true);

  const publicUrl = useMemo(() => {
    if (!slug) return "";
    return `${window.location.origin}/r/${slug}`;
  }, [slug]);

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load session");
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
          setAuthLoading(false);
        }
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setRafflesLoading(false);
      return;
    }

    let mounted = true;

    async function loadRaffles() {
      try {
        const res = await fetch("/api/admin/raffles", {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load raffles");
        }

        const data: RafflesResponse = await res.json();

        if (mounted) {
          setRaffles(data.raffles ?? []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load raffles");
        }
      } finally {
        if (mounted) {
          setRafflesLoading(false);
        }
      }
    }

    loadRaffles();

    return () => {
      mounted = false;
    };
  }, [user]);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slug) {
      setSlug(slugify(value));
    }
  }

  async function handleCreateRaffle(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/raffles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          slug,
          description,
          ticketPrice: Number(ticketPrice),
          maxTickets: Number(maxTickets),
          isPublished,
        }),
      });

      const data: CreateRaffleResponse = await res.json();

      if (!res.ok || !data.raffle) {
        throw new Error(data.message || "Failed to create raffle");
      }

      setRaffles((prev) => [data.raffle as Raffle, ...prev]);
      setSuccess("Raffle created successfully.");
      setTitle("");
      setSlug("");
      setDescription("");
      setTicketPrice("5");
      setMaxTickets("100");
      setIsPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create raffle");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  if (authLoading) {
    return <div style={{ padding: 24 }}>Loading admin...</div>;
  }

  if (!user) {
    return <div style={{ padding: 24 }}>No active session.</div>;
  }

  if (user.role !== "admin") {
    return <div style={{ padding: 24 }}>Admins only.</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 8 }}>Admin Dashboard</h1>
          <div>Signed in as: {user.email}</div>
          <div>Tenant: {user.tenantId}</div>
          <div>Role: {user.role}</div>
        </div>

        <button onClick={handleLogout}>Logout</button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 420px) minmax(320px, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Create Raffle</h2>

          <form onSubmit={handleCreateRaffle} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Title</span>
              <input
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Summer Car Raffle"
                required
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Slug</span>
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="summer-car-raffle"
                required
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell buyers what this raffle is for..."
                rows={5}
                required
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Ticket Price</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={ticketPrice}
                onChange={(e) => setTicketPrice(e.target.value)}
                required
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Max Tickets</span>
              <input
                type="number"
                min="1"
                step="1"
                value={maxTickets}
                onChange={(e) => setMaxTickets(e.target.value)}
                required
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
              Publish immediately
            </label>

            {publicUrl ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#f7f7f7",
                  fontSize: 14,
                  wordBreak: "break-all",
                }}
              >
                Public URL: {publicUrl}
              </div>
            ) : null}

            {error ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#fff1f1",
                  color: "#9f1d1d",
                }}
              >
                {error}
              </div>
            ) : null}

            {success ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#effaf1",
                  color: "#166534",
                }}
              >
                {success}
              </div>
            ) : null}

            <button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Raffle"}
            </button>
          </form>
        </section>

        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 20,
            background: "#fff",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Your Raffles</h2>

          {rafflesLoading ? (
            <div>Loading raffles...</div>
          ) : raffles.length === 0 ? (
            <div>No raffles yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {raffles.map((raffle) => (
                <div
                  key={raffle.id}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 8px 0" }}>{raffle.title}</h3>
                      <div style={{ fontSize: 14, color: "#555" }}>
                        Slug: {raffle.slug}
                      </div>
                      <div style={{ fontSize: 14, color: "#555" }}>
                        Tenant: {raffle.tenantId}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: raffle.isPublished ? "#effaf1" : "#f3f4f6",
                        color: raffle.isPublished ? "#166534" : "#374151",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {raffle.isPublished ? "Published" : "Draft"}
                    </div>
                  </div>

                  <p style={{ marginTop: 12 }}>{raffle.description}</p>

                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      flexWrap: "wrap",
                      fontSize: 14,
                      color: "#444",
                      marginTop: 12,
                    }}
                  >
                    <span>Ticket Price: £{Number(raffle.ticketPrice).toFixed(2)}</span>
                    <span>Max Tickets: {raffle.maxTickets}</span>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <a href={`/r/${raffle.slug}`} target="_blank" rel="noreferrer">
                      Open Public Page
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
