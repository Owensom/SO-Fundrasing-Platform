import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AdminCreateRafflePage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ticketPrice, setTicketPrice] = useState(5);
  const [totalTickets, setTotalTickets] = useState(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/raffles/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-slug": "demo-a",
        },
        body: JSON.stringify({
          title,
          description,
          ticketPrice,
          totalTickets,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to create raffle");
      }

      navigate(`/admin/raffles/${json.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Create raffle</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
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

        <button disabled={loading}>
          {loading ? "Creating..." : "Create raffle"}
        </button>
      </form>
    </div>
  );
}
