import { useRouter } from "next/router";
import { useEffect, useState } from "react";

type SessionResponse = {
  ok?: boolean;
  amount?: number;
  currency?: string;
  status?: string;
  email?: string;
  name?: string;
  reservation_token?: string;
};

type Ticket = {
  ticket_number: number;
  colour: string;
};

type TicketsResponse = {
  ok?: boolean;
  tickets?: Ticket[];
};

function formatMoney(amount?: number, currency?: string) {
  if (typeof amount !== "number") return "—";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: (currency || "GBP").toUpperCase(),
  }).format(amount);
}

export default function SuccessPage() {
  const router = useRouter();
  const { session_id } = router.query;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SessionResponse | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);

  useEffect(() => {
    if (!session_id || typeof session_id !== "string") return;

    setLoading(true);

    fetch(`/api/stripe/session?session_id=${session_id}`)
      .then((res) => res.json())
      .then((res: SessionResponse) => {
        setData(res);
      })
      .catch((err) => {
        console.error("session lookup failed", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [session_id]);

  useEffect(() => {
    if (!data?.ok || !data.reservation_token) return;

    const reservationToken = data.reservation_token;
    setTicketLoading(true);

    fetch(`/api/raffles/by-reservation?token=${reservationToken}`)
      .then((res) => res.json())
      .then((res: TicketsResponse) => {
        if (res.ok && Array.isArray(res.tickets)) {
          setTickets(res.tickets);
        }
      })
      .catch((err) => {
        console.error("ticket lookup failed", err);
      })
      .finally(() => {
        setTicketLoading(false);
      });
  }, [data]);

  if (!session_id) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>Missing session ID</h1>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
        <h1>Payment successful</h1>
        <p>Loading confirmation...</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          background: "#fff",
        }}
      >
        <h1 style={{ marginTop: 0 }}>Payment successful</h1>

        <p>Thank you. Your payment has been received.</p>

        <hr style={{ margin: "20px 0" }} />

        <p>
          <strong>Amount:</strong> {formatMoney(data?.amount, data?.currency)}
        </p>

        <p>
          <strong>Status:</strong> {data?.status || "—"}
        </p>

        <p>
          <strong>Email:</strong> {data?.email || "—"}
        </p>

        <p>
          <strong>Name:</strong> {data?.name || "—"}
        </p>

        <p>
          <strong>Reservation:</strong> {data?.reservation_token || "—"}
        </p>

        <hr style={{ margin: "20px 0" }} />

        <h3>Your tickets</h3>

        {ticketLoading ? (
          <p>Loading ticket numbers...</p>
        ) : tickets.length > 0 ? (
          <ul>
            {tickets.map((t) => (
              <li key={`${t.colour}-${t.ticket_number}`}>
                #{t.ticket_number} ({t.colour})
              </li>
            ))}
          </ul>
        ) : (
          <p>No ticket numbers found for this reservation.</p>
        )}
      </div>
    </main>
  );
}
