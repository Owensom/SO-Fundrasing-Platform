"use client";

import { useMemo, useState } from "react";
import type { SafeRaffle, TicketSelection } from "@/lib/types";

type Props = { raffle: SafeRaffle };

function clean(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default function RaffleClient({ raffle }: Props) {
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [selectedColour, setSelectedColour] = useState(
    raffle.colours[0]?.name ?? "",
  );
  const [autoQuantity, setAutoQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [answer, setAnswer] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const config = (raffle as any).config_json ?? {};
  const questionText = String(config.question?.text ?? "").trim();

  const availability = useMemo(() => {
    const sold = new Set(
      raffle.soldTickets.map((t) => `${t.colour}::${t.number}`),
    );
    const reserved = new Set(
      raffle.reservedTickets.map((t) => `${t.colour}::${t.number}`),
    );
    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(
    () => new Set(basket.map((t) => `${t.colour}::${t.number}`)),
    [basket],
  );

  const visibleNumbers = useMemo(() => {
    const out: number[] = [];
    for (let n = raffle.startNumber; n <= raffle.endNumber; n += 1) out.push(n);
    return out;
  }, [raffle.startNumber, raffle.endNumber]);

  function toggleTicket(number: number) {
    const key = `${selectedColour}::${number}`;
    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket((current) => {
      const exists = current.some(
        (t) => t.colour === selectedColour && t.number === number,
      );

      if (exists) {
        return current.filter(
          (t) => !(t.colour === selectedColour && t.number === number),
        );
      }

      return [...current, { colour: selectedColour, number }];
    });
  }

  function autoSelectTicketQuantity(quantity: number) {
    const requested = Math.max(1, Math.floor(quantity));
    const selected: TicketSelection[] = [];
    const selectedKeys = new Set<string>();

    const sortedColours = raffle.colours
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const colour of sortedColours) {
      for (const number of visibleNumbers) {
        if (selected.length >= requested) break;

        const key = `${colour.name}::${number}`;

        if (
          selectedKeys.has(key) ||
          availability.sold.has(key) ||
          availability.reserved.has(key)
        ) {
          continue;
        }

        selectedKeys.add(key);
        selected.push({ colour: colour.name, number });
      }

      if (selected.length >= requested) break;
    }

    setBasket(selected);

    if (selected.length < requested) {
      setError(`Only ${selected.length} tickets available.`);
    } else {
      setError("");
    }
  }

  async function startCheckout() {
    try {
      setError("");

      if (!basket.length) {
        setError("Please select at least one ticket.");
        return;
      }

      if (!buyerName.trim()) {
        setError("Please enter your name.");
        return;
      }

      if (!buyerEmail.trim()) {
        setError("Please enter your email address.");
        return;
      }

      if (questionText && !answer.trim()) {
        setError("Please answer the entry question.");
        return;
      }

      if (!acceptedTerms) {
        setError("Please accept the Terms and Privacy Policy.");
        return;
      }

      setLoading(true);

      const slug = (raffle as any).slug;

      const reserveResponse = await fetch(`/api/raffles/${slug}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerName,
          buyerEmail,
          answer,
          selectedTickets: basket.map((ticket) => ({
            colour: ticket.colour,
            number: ticket.number,
            ticket_number: ticket.number,
          })),
        }),
      });

      const reserveData = await reserveResponse.json().catch(() => null);

      if (!reserveResponse.ok || reserveData?.ok === false) {
        throw new Error(reserveData?.error || "Reservation failed");
      }

      const checkoutForm = new FormData();
      checkoutForm.append("raffle_id", String((raffle as any).id ?? ""));
      checkoutForm.append("quantity", String(basket.length));
      checkoutForm.append("name", buyerName);
      checkoutForm.append("email", buyerEmail);
      checkoutForm.append("answer", answer);
      checkoutForm.append("reservation_token", reserveData.reservationToken);

      const checkoutResponse = await fetch("/api/stripe/checkout", {
        method: "POST",
        body: checkoutForm,
      });

      const checkoutData = await checkoutResponse.json().catch(() => null);

      if (!checkoutResponse.ok || checkoutData?.ok === false) {
        throw new Error(checkoutData?.error || "Checkout failed");
      }

      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
        return;
      }

      throw new Error("Checkout link not returned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>{raffle.title}</h1>
      <p>{raffle.description}</p>

      <h2>Choose colour</h2>
      {raffle.colours.map((colour) => (
        <button
          key={colour.id}
          type="button"
          onClick={() => setSelectedColour(colour.name)}
          style={{
            background: selectedColour === colour.name ? "#2563eb" : "#e5e7eb",
            color: selectedColour === colour.name ? "#fff" : "#111",
            marginRight: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: "none",
          }}
        >
          {colour.name}
        </button>
      ))}

      <h2>Choose numbers</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
          gap: 6,
        }}
      >
        {visibleNumbers.map((number) => {
          const key = `${selectedColour}::${number}`;
          const isSold = availability.sold.has(key);
          const isReserved = availability.reserved.has(key);
          const isSelected = basketKeys.has(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleTicket(number)}
              disabled={isSold || isReserved}
              style={{
                background: isSelected
                  ? "#2563eb"
                  : isSold
                    ? "#111"
                    : isReserved
                      ? "#f59e0b"
                      : "#fff",
                color: isSelected || isSold || isReserved ? "#fff" : "#111",
                padding: 8,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            >
              {number}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <label>
          Number of tickets
          <input
            type="number"
            min={1}
            max={raffle.endNumber - raffle.startNumber + 1}
            value={autoQuantity}
            onChange={(event) => setAutoQuantity(Number(event.target.value))}
            style={{ marginLeft: 6, width: 60 }}
          />
        </label>

        <button
          type="button"
          onClick={() => autoSelectTicketQuantity(autoQuantity)}
          style={{ marginLeft: 10 }}
        >
          Auto select
        </button>

        <button
          type="button"
          onClick={() => setBasket([])}
          style={{ marginLeft: 10 }}
        >
          Clear basket
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Basket</h3>

        {basket.length === 0 ? (
          <p>No tickets selected yet.</p>
        ) : (
          basket.map((ticket) => (
            <div key={`${ticket.colour}::${ticket.number}`}>
              {ticket.colour} #{ticket.number}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <input
          value={buyerName}
          onChange={(event) => setBuyerName(event.target.value)}
          placeholder="Your name"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />

        <input
          value={buyerEmail}
          onChange={(event) => setBuyerEmail(event.target.value)}
          placeholder="Your email"
          type="email"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #cbd5e1" }}
        />

        {questionText ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
            }}
          >
            <strong>Entry question</strong>
            <p>{questionText}</p>

            <input
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Your answer"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
              }}
            />
          </div>
        ) : null}

        <label style={{ display: "flex", gap: 8 }}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
          />
          I agree to the Terms & Conditions and Privacy Policy.
        </label>

        {error ? <p style={{ color: "red", fontWeight: 700 }}>{error}</p> : null}

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          style={{
            padding: 14,
            borderRadius: 999,
            border: "none",
            background: loading ? "#94a3b8" : "#111827",
            color: "#fff",
            fontWeight: 900,
          }}
        >
          {loading ? "Starting checkout..." : "Continue to checkout"}
        </button>
      </div>
    </div>
  );
}
