"use client";

import { useMemo, useState } from "react";

type Colour = {
  id: string;
  name: string;
  sortOrder?: number;
};

type TicketRef = {
  colour: string;
  number: number;
};

type Props = {
  raffle: any;
};

function key(colour: string, number: number) {
  return `${colour.toLowerCase()}:${number}`;
}

export default function RaffleClient({ raffle }: Props) {
  const config = raffle.config_json || {};

  const colours: Colour[] =
    raffle.colours?.length > 0
      ? raffle.colours
      : [{ id: "default", name: "Default" }];

  const numbers = useMemo(() => {
    const list: number[] = [];
    for (let i = raffle.startNumber; i <= raffle.endNumber; i++) {
      list.push(i);
    }
    return list;
  }, [raffle.startNumber, raffle.endNumber]);

  const sold = new Set(
    (raffle.soldTickets || []).map((t: TicketRef) =>
      key(t.colour, t.number),
    ),
  );

  const reserved = new Set(
    (raffle.reservedTickets || []).map((t: TicketRef) =>
      key(t.colour, t.number),
    ),
  );

  const [selected, setSelected] = useState<TicketRef[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answer, setAnswer] = useState("");
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(colour: string, number: number) {
    const k = key(colour, number);

    if (sold.has(k) || reserved.has(k)) return;

    setSelected((prev) => {
      const exists = prev.find(
        (t) => key(t.colour, t.number) === k,
      );

      if (exists) {
        return prev.filter((t) => key(t.colour, t.number) !== k);
      }

      return [...prev, { colour, number }];
    });
  }

  async function checkout() {
    setError("");

    if (!selected.length) return setError("Select tickets");
    if (!name) return setError("Enter name");
    if (!email) return setError("Enter email");
    if (!terms) return setError("Accept terms");

    setBusy(true);

    try {
      const reserve = await fetch(
        `/api/raffles/${raffle.slug}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            raffleId: raffle.id,
            tickets: selected,
            customerName: name,
            customerEmail: email,
            entryAnswer: answer,
            termsAccepted: terms,
          }),
        },
      );

      const reserveData = await reserve.json();

      const token =
        reserveData?.reservationToken ||
        reserveData?.token;

      const checkout = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId: raffle.id,
          reservationToken: token,
          tickets: selected,
          customerName: name,
          customerEmail: email,
          entryAnswer: answer,
        }),
      });

      const data = await checkout.json();

      window.location.href = data.url;
    } catch (e: any) {
      setError("Checkout failed");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* GRID */}
      {colours.map((colour) => (
        <div key={colour.id}>
          <h3 style={{ marginBottom: 10 }}>
            {colour.name} tickets
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill,minmax(48px,1fr))",
              gap: 8,
            }}
          >
            {numbers.map((num) => {
              const k = key(colour.name, num);
              const isSold = sold.has(k);
              const isReserved = reserved.has(k);
              const isSelected = selected.find(
                (t) => key(t.colour, t.number) === k,
              );

              return (
                <button
                  key={k}
                  onClick={() => toggle(colour.name, num)}
                  disabled={isSold || isReserved}
                  style={{
                    height: 44,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: isSelected
                      ? "#2563eb"
                      : isSold || isReserved
                      ? "#cbd5e1"
                      : "#fff",
                    color: isSelected ? "#fff" : "#000",
                    cursor:
                      isSold || isReserved
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 700,
                  }}
                >
                  {num}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* BASKET */}
      <div>
        <h3>Basket</h3>
        {selected.length === 0 && <p>No tickets selected</p>}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {selected.map((t) => (
            <div
              key={key(t.colour, t.number)}
              style={{
                padding: "6px 10px",
                background: "#2563eb",
                color: "#fff",
                borderRadius: 20,
                fontSize: 12,
              }}
            >
              {t.colour} {t.number}
            </div>
          ))}
        </div>
      </div>

      {/* DETAILS */}
      <div>
        <h3>Your details</h3>

        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {config?.question?.text && (
          <>
            <p>{config.question.text}</p>
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </>
        )}

        <label>
          <input
            type="checkbox"
            checked={terms}
            onChange={(e) => setTerms(e.target.checked)}
          />
          Accept terms
        </label>
      </div>

      {error && <div>{error}</div>}

      <button onClick={checkout} disabled={busy}>
        {busy ? "Loading..." : "Reserve and pay"}
      </button>
    </div>
  );
}
