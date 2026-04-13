import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function AdminEditRafflePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState(0);
  const [totalTickets, setTotalTickets] = useState(0);
  const [status, setStatus] = useState("draft");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;

    async function load() {
      try {
        const res = await fetch(
          `/api/public/raffles?slug=${encodeURIComponent(
            slug
          )}&tenantSlug=demo-a`
        );
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load raffle");
        }

        setTitle(json.raffle.title);
        setDescription(json.raffle.description);
        setTicketPrice(json.raffle.ticketPrice);
        setTotalTickets(json.raffle.totalTickets);
        setStatus(json.raffle.status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [slug]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`/api/admin/raffles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          action: "update",
          slug,
          title,
          description,
          ticketPrice,
          totalTickets,
          status,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to save");
      }

      navigate(`/admin/raffles/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Edit raffle</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSave}>
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div>
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label>Ticket price (£)</label>
          <input
            type="number"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(Number(e.target.value))}
          />
        </div>

        <div>
          <label>Total tickets</label>
          <input
            type="number"
            value={totalTickets}
            onChange={(e) => setTotalTickets(Number(e.target.value))}
          />
        </div>

        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <button disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
