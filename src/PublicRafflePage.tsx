import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

type PublicRaffle = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  isPublished: boolean;
  status: "draft" | "published" | "closed";
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
  soldTickets: number;
  remainingTickets: number;
};

type PurchaseResponse = {
  purchase?: {
    id: string;
    buyerName: string;
    buyerEmail: string;
    quantity: number;
    totalAmount: number;
    createdAt: string;
  };
  soldTickets?: number;
  remainingTickets?: number;
  raffleStatus?: "draft" | "published" | "closed";
  message?: string;
};

function formatDate(value: string | null) {
  if (!value) return "No end date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No end date";
  }

  return date.toLocaleString();
}

export default function PublicRafflePage() {
  const { slug } = useParams();

  const [raffle, setRaffle] = useState<PublicRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [quantity, setQuantity] = useState("1");

  const total = useMemo(() => {
    if (!raffle) return "0.00";
    const qty = Number(quantity) || 0;
    return (qty * raffle.ticketPrice).toFixed(2);
  }, [quantity, raffle]);

  useEffect(() => {
    let cancelled = false;

    async function loadRaffle() {
      if (!slug) {
        setError("Missing raffle slug");
        setLoading(false);
        return;
      }

      try {
        setError("");

        const res = await fetch(`/api/public/raffles/${encodeURIComponent(slug)}`, {
          method: "GET",
        });

        const text = await res.text();

        let data: any = null;

        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          throw new Error(`API did not return JSON. ${text.slice(0, 200)}`);
        }

        if (!res.ok) {
          throw new Error(data?.message || "Failed to load raffle");
        }

        if (!cancelled) {
          setRaffle(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load raffle");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadRaffle();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function handlePurchase(e: FormEvent) {
    e.preventDefault();

    if (!raffle || !slug) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        `/api/public/raffles/${encodeURIComponent(slug)}/purchase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            buyerName,
            buyerEmail,
            quantity: Number(quantity),
          }),
        }
      );

      const text = await res.text();

      let data: PurchaseResponse | null = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Purchase API did not return JSON. ${text.slice(0, 200)}`);
      }

      if (!res.ok || !data?.purchase) {
        throw new Error(data?.message || "Failed to purchase tickets");
      }

      setSuccess(
        `Purchase complete. ${data.purchase.quantity} ticket(s) reserved for ${data.purchase.buyerEmail}. Total £${Number(data.purchase.totalAmount).toFixed(2)}`
      );

      setBuyerName("");
      setBuyerEmail("");
      setQuantity("1");

      setRaffle((prev) =>
        prev
          ? {
              ...prev,
              soldTickets: data?.soldTickets ?? prev.soldTickets,
              remainingTickets: data?.remainingTickets ?? prev.remainingTickets,
              status: data?.raffleStatus ?? prev.status,
              isPublished: (data?.raffleStatus ?? prev.status) === "published",
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to purchase tickets");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 24 }}>Loading raffle...</div>;
  }

  if (error && !raffle) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1>Raffle not available</h1>
        <p>{error}</p>
      </div>
    );
  }

  if (!raffle) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
        <h1>Raffle not found</h1>
      </div>
    );
  }

  const isClosed = raffle.status !== "published" || raffle.remainingTickets <= 0;
  const maxQuantity = Math.max(raffle.remainingTickets, 1);

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Raffle Details</h2>
        <p>Ticket Price: £{Number(raffle.ticketPrice).toFixed(2)}</p>
        <p>Sold Tickets: {raffle.soldTickets}</p>
        <p>Remaining Tickets: {raffle.remainingTickets}</p>
        <p>Ends: {formatDate(raffle.endAt)}</p>
        <p>Status: {raffle.status}</p>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 20,
          border: "1px solid #ddd",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Buy Tickets</h2>

        {error ? (
          <div
            style={{
              marginBottom: 12,
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
              marginBottom: 12,
              padding: 12,
              borderRadius: 8,
              background: "#effaf1",
              color: "#166534",
            }}
          >
            {success}
          </div>
        ) : null}

        {isClosed ? (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: "#f3f4f6",
              color: "#374151",
            }}
          >
            This raffle is closed or sold out.
          </div>
        ) : (
          <form onSubmit={handlePurchase} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Name</span>
              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                required
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Email</span>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                required
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span>Quantity</span>
              <input
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </label>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#f7f7f7",
              }}
            >
              Total: £{total}
            </div>

            <button type="submit" disabled={saving}>
              {saving ? "Processing..." : "Buy Tickets"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
