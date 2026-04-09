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

type RaffleStatus = "draft" | "published" | "closed";

type Raffle = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  isPublished: boolean;
  status: RaffleStatus;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RafflesResponse = {
  raffles: Raffle[];
};

type CreateRaffleResponse = {
  raffle?: Raffle;
  message?: string;
};

type UpdateRaffleResponse = {
  raffle?: Raffle;
  message?: string;
};

type DeleteRaffleResponse = {
  raffle?: Raffle;
  success?: boolean;
  message?: string;
};

type EditFormState = {
  title: string;
  slug: string;
  description: string;
  ticketPrice: string;
  maxTickets: string;
  endAt: string;
  status: RaffleStatus;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return "No end date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No end date";
  return date.toLocaleString();
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rafflesLoading, setRafflesLoading] = useState(true);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState("5");
  const [maxTickets, setMaxTickets] = useState("100");
  const [endAt, setEndAt] = useState("");
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
          headers: {
            "x-tenant-id": user.tenantId,
          },
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
          "x-tenant-id": user?.tenantId || "demo-a",
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          slug,
          description,
          ticketPrice: Number(ticketPrice),
          maxTickets: Number(maxTickets),
          endAt: endAt ? new Date(endAt).toISOString() : null,
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
      setEndAt("");
      setIsPublished(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create raffle");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(raffle: Raffle) {
    setEditingId(raffle.id);
    setEditForm({
      title: raffle.title,
      slug: raffle.slug,
      description: raffle.description,
      ticketPrice: String(raffle.ticketPrice),
      maxTickets: String(raffle.maxTickets),
      endAt: toDateTimeLocalValue(raffle.endAt),
      status: raffle.status,
    });
    setError("");
    setSuccess("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit(id: string) {
    if (!editForm || !user) return;

    setBusyId(id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/raffles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": user.tenantId,
        },
        credentials: "include",
        body: JSON.stringify({
          id,
          title: editForm.title,
          slug: editForm.slug,
          description: editForm.description,
          ticketPrice: Number(editForm.ticketPrice),
          maxTickets: Number(editForm.maxTickets),
          endAt: editForm.endAt ? new Date(editForm.endAt).toISOString() : null,
          status: editForm.status,
        }),
      });

      const data: UpdateRaffleResponse = await res.json();

      if (!res.ok || !data.raffle) {
        throw new Error(data.message || "Failed to update raffle");
      }

      setRaffles((prev) =>
        prev.map((item) => (item.id === id ? data.raffle as Raffle : item))
      );
      setSuccess("Raffle updated.");
      cancelEditing();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update raffle");
    } finally {
      setBusyId(null);
    }
  }

  async function quickStatusChange(id: string, status: RaffleStatus) {
    if (!user) return;

    setBusyId(id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/raffles", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": user.tenantId,
        },
        credentials: "include",
        body: JSON.stringify({
          id,
          status,
        }),
      });

      const data: UpdateRaffleResponse = await res.json();

      if (!res.ok || !data.raffle) {
        throw new Error(data.message || "Failed to update raffle status");
      }

      setRaffles((prev) =>
        prev.map((item) => (item.id === id ? data.raffle as Raffle : item))
      );
      setSuccess(`Raffle set to ${status}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update raffle status"
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;

    const confirmed = window.confirm("Delete this raffle?");
    if (!confirmed) return;

    setBusyId(id);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/raffles", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-id": user.tenantId,
        },
        credentials: "include",
        body: JSON.stringify({
          id,
        }),
      });

      const data: DeleteRaffleResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete raffle");
      }

      setRaffles((prev) => prev.filter((item) => item.id !== id));
      setSuccess("Raffle deleted.");
      if (editingId === id) {
        cancelEditing();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete raffle");
    } finally {
      setBusyId(null);
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

            <label style={{ display: "grid", gap: 6 }}>
              <span>End Date</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
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
              {raffles.map((raffle) => {
                const isEditing = editingId === raffle.id;
                const isBusy = busyId === raffle.id;

                return (
                  <div
                    key={raffle.id}
                    style={{
                      border: "1px solid #e5e5e5",
                      borderRadius: 10,
                      padding: 16,
                    }}
                  >
                    {isEditing && editForm ? (
                      <div style={{ display: "grid", gap: 10 }}>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Title</span>
                          <input
                            value={editForm.title}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                title: e.target.value,
                              })
                            }
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Slug</span>
                          <input
                            value={editForm.slug}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                slug: slugify(e.target.value),
                              })
                            }
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Description</span>
                          <textarea
                            rows={4}
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                description: e.target.value,
                              })
                            }
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Ticket Price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.ticketPrice}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                ticketPrice: e.target.value,
                              })
                            }
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Max Tickets</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={editForm.maxTickets}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                maxTickets: e.target.value,
                              })
                            }
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>End Date</span>
                          <input
                            type="datetime-local"
                            value={editForm.endAt}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                endAt: e.target.value,
                              })
                            }
                          />
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span>Status</span>
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                status: e.target.value as RaffleStatus,
                              })
                            }
                          >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="closed">Closed</option>
                          </select>
                        </label>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => saveEdit(raffle.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? "Saving..." : "Save"}
                          </button>
                          <button type="button" onClick={cancelEditing} disabled={isBusy}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                              background:
                                raffle.status === "published"
                                  ? "#effaf1"
                                  : raffle.status === "closed"
                                  ? "#f3f4f6"
                                  : "#fff7ed",
                              color:
                                raffle.status === "published"
                                  ? "#166534"
                                  : raffle.status === "closed"
                                  ? "#374151"
                                  : "#9a3412",
                              fontSize: 12,
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            {raffle.status}
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
                          <span>
                            Ticket Price: £{Number(raffle.ticketPrice).toFixed(2)}
                          </span>
                          <span>Max Tickets: {raffle.maxTickets}</span>
                          <span>Ends: {formatDate(raffle.endAt)}</span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 14,
                          }}
                        >
                          <a href={`/r/${raffle.slug}`} target="_blank" rel="noreferrer">
                            <button type="button">Open Public Page</button>
                          </a>

                          <button
                            type="button"
                            onClick={() => startEditing(raffle)}
                            disabled={isBusy}
                          >
                            Edit
                          </button>

                          {raffle.status !== "published" ? (
                            <button
                              type="button"
                              onClick={() => quickStatusChange(raffle.id, "published")}
                              disabled={isBusy}
                            >
                              {isBusy ? "Working..." : "Publish"}
                            </button>
                          ) : null}

                          {raffle.status !== "draft" ? (
                            <button
                              type="button"
                              onClick={() => quickStatusChange(raffle.id, "draft")}
                              disabled={isBusy}
                            >
                              {isBusy ? "Working..." : "Unpublish"}
                            </button>
                          ) : null}

                          {raffle.status !== "closed" ? (
                            <button
                              type="button"
                              onClick={() => quickStatusChange(raffle.id, "closed")}
                              disabled={isBusy}
                            >
                              {isBusy ? "Working..." : "Close"}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => handleDelete(raffle.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? "Working..." : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
