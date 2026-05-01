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

type Raffle = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  startNumber: number;
  endNumber: number;
  colours: Colour[];
  soldTickets?: TicketRef[];
  reservedTickets?: TicketRef[];
  config_json?: any;
};

type Props = {
  raffle: Raffle;
};

type CheckoutResponse = {
  ok?: boolean;
  url?: string;
  checkoutUrl?: string;
  sessionUrl?: string;
  error?: string;
};

function normalise(value: string) {
  return String(value || "").trim().toLowerCase();
}

function moneyFromCents(cents: any, currency = "GBP") {
  const amount = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function getTicketPrice(config: any) {
  return Number(
    config?.ticketPriceCents ??
      config?.ticket_price_cents ??
      config?.priceCents ??
      config?.price_cents ??
      0,
  );
}

function getEntryQuestion(config: any) {
  return config?.question?.text ? String(config.question.text).trim() : "";
}

function getEntryAnswer(config: any) {
  return config?.question?.answer
    ? String(config.question.answer).trim()
    : config?.question?.correctAnswer
      ? String(config.question.correctAnswer).trim()
      : "";
}

function ticketKey(colour: string, number: number) {
  return `${normalise(colour)}:${number}`;
}

function sortColours(colours: Colour[]) {
  return [...colours].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 999;
    const bOrder = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 999;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name);
  });
}

export default function RaffleClient({ raffle }: Props) {
  const config = raffle.config_json || {};
  const currency = String(config.currency || "GBP");
  const ticketPriceCents = getTicketPrice(config);
  const ticketPriceLabel =
    ticketPriceCents > 0 ? moneyFromCents(ticketPriceCents, currency) : "Checkout";

  const entryQuestion = getEntryQuestion(config);
  const correctEntryAnswer = getEntryAnswer(config);

  const colours = useMemo(() => {
    const safeColours = Array.isArray(raffle.colours) && raffle.colours.length
      ? raffle.colours
      : [{ id: "default", name: "Default", sortOrder: 0 }];

    return sortColours(safeColours);
  }, [raffle.colours]);

  const [selectedColour, setSelectedColour] = useState(colours[0]?.name || "Default");
  const [selectedTickets, setSelectedTickets] = useState<TicketRef[]>([]);
  const [supporterName, setSupporterName] = useState("");
  const [supporterEmail, setSupporterEmail] = useState("");
  const [entryAnswer, setEntryAnswer] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const soldSet = useMemo(() => {
    return new Set(
      (raffle.soldTickets || []).map((ticket) =>
        ticketKey(ticket.colour, ticket.number),
      ),
    );
  }, [raffle.soldTickets]);

  const reservedSet = useMemo(() => {
    return new Set(
      (raffle.reservedTickets || []).map((ticket) =>
        ticketKey(ticket.colour, ticket.number),
      ),
    );
  }, [raffle.reservedTickets]);

  const selectedSet = useMemo(() => {
    return new Set(
      selectedTickets.map((ticket) => ticketKey(ticket.colour, ticket.number)),
    );
  }, [selectedTickets]);

  const numbers = useMemo(() => {
    const start = Number(raffle.startNumber || 1);
    const end = Number(raffle.endNumber || 100);

    const list: number[] = [];

    for (let current = start; current <= end; current += 1) {
      list.push(current);
    }

    return list;
  }, [raffle.startNumber, raffle.endNumber]);

  const availableCount = useMemo(() => {
    let count = 0;

    for (const colour of colours) {
      for (const number of numbers) {
        const key = ticketKey(colour.name, number);

        if (!soldSet.has(key) && !reservedSet.has(key)) {
          count += 1;
        }
      }
    }

    return count;
  }, [colours, numbers, soldSet, reservedSet]);

  const totalCents = selectedTickets.length * ticketPriceCents;
  const totalLabel =
    ticketPriceCents > 0 ? moneyFromCents(totalCents, currency) : "Calculated at checkout";

  function toggleTicket(number: number) {
    setError("");

    const key = ticketKey(selectedColour, number);

    if (soldSet.has(key) || reservedSet.has(key)) return;

    setSelectedTickets((current) => {
      const exists = current.some(
        (ticket) => ticketKey(ticket.colour, ticket.number) === key,
      );

      if (exists) {
        return current.filter(
          (ticket) => ticketKey(ticket.colour, ticket.number) !== key,
        );
      }

      return [...current, { colour: selectedColour, number }];
    });
  }

  function removeSelected(ticketToRemove: TicketRef) {
    setSelectedTickets((current) =>
      current.filter(
        (ticket) =>
          ticketKey(ticket.colour, ticket.number) !==
          ticketKey(ticketToRemove.colour, ticketToRemove.number),
      ),
    );
  }

  function validateBeforeCheckout() {
    if (!selectedTickets.length) {
      return "Please choose at least one ticket.";
    }

    if (!supporterName.trim()) {
      return "Please enter your name.";
    }

    if (!supporterEmail.trim() || !supporterEmail.includes("@")) {
      return "Please enter a valid email address.";
    }

    if (entryQuestion) {
      if (!entryAnswer.trim()) {
        return "Please answer the entry question.";
      }

      if (
        correctEntryAnswer &&
        normalise(entryAnswer) !== normalise(correctEntryAnswer)
      ) {
        return "The entry question answer is not correct.";
      }
    }

    if (!termsAccepted) {
      return "Please accept the terms and privacy policy before checkout.";
    }

    return "";
  }

  async function handleCheckout() {
    setError("");

    const validationError = validateBeforeCheckout();

    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);

    try {
      const reserveResponse = await fetch(`/api/raffles/${raffle.slug}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raffleId: raffle.id,
          raffleSlug: raffle.slug,
          tickets: selectedTickets,
          selectedTickets,
          customerName: supporterName.trim(),
          customerEmail: supporterEmail.trim(),
          supporterName: supporterName.trim(),
          supporterEmail: supporterEmail.trim(),
          entryAnswer: entryAnswer.trim(),
          legalAnswer: entryAnswer.trim(),
          termsAccepted,
        }),
      });

      const reserveData = await reserveResponse.json().catch(() => null);

      if (!reserveResponse.ok || reserveData?.ok === false) {
        throw new Error(
          reserveData?.error ||
            reserveData?.message ||
            "These tickets could not be reserved. Please choose again.",
        );
      }

      const reservationToken =
        reserveData?.reservationToken ||
        reserveData?.reservation_token ||
        reserveData?.token ||
        reserveData?.reservation?.token ||
        "";

      const checkoutResponse = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "raffle",
          productType: "raffle",
          raffleId: raffle.id,
          raffleSlug: raffle.slug,
          slug: raffle.slug,
          reservationToken,
          reservation_token: reservationToken,
          tickets: selectedTickets,
          selectedTickets,
          customerName: supporterName.trim(),
          customerEmail: supporterEmail.trim(),
          supporterName: supporterName.trim(),
          supporterEmail: supporterEmail.trim(),
          entryAnswer: entryAnswer.trim(),
          legalAnswer: entryAnswer.trim(),
          termsAccepted,
        }),
      });

      const checkoutData: CheckoutResponse = await checkoutResponse
        .json()
        .catch(() => ({}));

      if (!checkoutResponse.ok || checkoutData?.ok === false) {
        throw new Error(
          checkoutData?.error ||
            "Checkout could not be started. Please try again.",
        );
      }

      const redirectUrl =
        checkoutData.url || checkoutData.checkoutUrl || checkoutData.sessionUrl;

      if (!redirectUrl) {
        throw new Error("Checkout was created but no Stripe URL was returned.");
      }

      window.location.href = redirectUrl;
    } catch (checkoutError: any) {
      setError(
        checkoutError?.message ||
          "Something went wrong while starting checkout. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p
          style={{
            margin: 0,
            color: "#2563eb",
            fontSize: 12,
            fontWeight: 950,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Choose your tickets
        </p>

        <h2
          style={{
            margin: "5px 0 0",
            color: "#020617",
            fontSize: 26,
            lineHeight: 1,
            letterSpacing: "-0.045em",
            fontWeight: 950,
          }}
        >
          Enter the draw
        </h2>

        <p
          style={{
            margin: "9px 0 0",
            color: "#64748b",
            fontSize: 14,
            lineHeight: 1.55,
          }}
        >
          Select your ticket number, answer the entry question if required, then
          continue to secure checkout.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            borderRadius: 18,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: 12,
          }}
        >
          <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 900 }}>
            Price
          </p>
          <p style={{ margin: "4px 0 0", fontWeight: 950, color: "#020617" }}>
            {ticketPriceLabel}
          </p>
        </div>

        <div
          style={{
            borderRadius: 18,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: 12,
          }}
        >
          <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 900 }}>
            Selected
          </p>
          <p style={{ margin: "4px 0 0", fontWeight: 950, color: "#020617" }}>
            {selectedTickets.length}
          </p>
        </div>

        <div
          style={{
            borderRadius: 18,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            padding: 12,
          }}
        >
          <p style={{ margin: 0, color: "#64748b", fontSize: 11, fontWeight: 900 }}>
            Available
          </p>
          <p style={{ margin: "4px 0 0", fontWeight: 950, color: "#020617" }}>
            {availableCount}
          </p>
        </div>
      </div>

      {colours.length > 1 ? (
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              display: "block",
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            Ticket colour
          </label>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {colours.map((colour) => {
              const active = colour.name === selectedColour;

              return (
                <button
                  key={colour.id || colour.name}
                  type="button"
                  onClick={() => setSelectedColour(colour.name)}
                  style={{
                    border: active ? "1px solid #2563eb" : "1px solid #e2e8f0",
                    background: active ? "#eff6ff" : "#ffffff",
                    color: active ? "#1d4ed8" : "#334155",
                    borderRadius: 999,
                    padding: "9px 12px",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 13,
                    boxShadow: active
                      ? "0 10px 26px rgba(37,99,235,0.16)"
                      : "none",
                  }}
                >
                  {colour.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        style={{
          maxHeight: 310,
          overflow: "auto",
          borderRadius: 22,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          padding: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))",
            gap: 8,
          }}
        >
          {numbers.map((number) => {
            const key = ticketKey(selectedColour, number);
            const sold = soldSet.has(key);
            const reserved = reservedSet.has(key);
            const selected = selectedSet.has(key);
            const unavailable = sold || reserved;

            return (
              <button
                key={`${selectedColour}-${number}`}
                type="button"
                disabled={unavailable || busy}
                onClick={() => toggleTicket(number)}
                title={
                  sold
                    ? "Sold"
                    : reserved
                      ? "Reserved"
                      : selected
                        ? "Selected"
                        : "Available"
                }
                style={{
                  minHeight: 48,
                  borderRadius: 15,
                  border: selected
                    ? "2px solid #2563eb"
                    : unavailable
                      ? "1px solid #cbd5e1"
                      : "1px solid #e2e8f0",
                  background: selected
                    ? "#2563eb"
                    : unavailable
                      ? "#e2e8f0"
                      : "#ffffff",
                  color: selected
                    ? "#ffffff"
                    : unavailable
                      ? "#94a3b8"
                      : "#0f172a",
                  cursor: unavailable || busy ? "not-allowed" : "pointer",
                  fontWeight: 950,
                  opacity: unavailable ? 0.72 : 1,
                }}
              >
                {number}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 10,
          color: "#64748b",
          fontSize: 12,
          fontWeight: 800,
        }}
      >
        <span>White = available</span>
        <span>Blue = selected</span>
        <span>Grey = unavailable</span>
      </div>

      {selectedTickets.length ? (
        <div
          style={{
            marginTop: 16,
            borderRadius: 22,
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            padding: 14,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#1e3a8a",
              fontWeight: 950,
              fontSize: 13,
            }}
          >
            Your selected tickets
          </p>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 10,
            }}
          >
            {selectedTickets.map((ticket) => (
              <button
                key={ticketKey(ticket.colour, ticket.number)}
                type="button"
                onClick={() => removeSelected(ticket)}
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#ffffff",
                  color: "#1d4ed8",
                  borderRadius: 999,
                  padding: "8px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {ticket.colour} {ticket.number} ×
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div>
          <label
            htmlFor="supporterName"
            style={{
              display: "block",
              marginBottom: 7,
              fontSize: 13,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            Your name
          </label>
          <input
            id="supporterName"
            value={supporterName}
            onChange={(event) => setSupporterName(event.target.value)}
            placeholder="Full name"
            autoComplete="name"
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: 16,
              border: "1px solid #cbd5e1",
              padding: "12px 13px",
              fontSize: 15,
              outline: "none",
              background: "#ffffff",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="supporterEmail"
            style={{
              display: "block",
              marginBottom: 7,
              fontSize: 13,
              fontWeight: 900,
              color: "#0f172a",
            }}
          >
            Email address
          </label>
          <input
            id="supporterEmail"
            value={supporterEmail}
            onChange={(event) => setSupporterEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            type="email"
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: 16,
              border: "1px solid #cbd5e1",
              padding: "12px 13px",
              fontSize: 15,
              outline: "none",
              background: "#ffffff",
            }}
          />
        </div>

        {entryQuestion ? (
          <div
            style={{
              borderRadius: 20,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              padding: 14,
            }}
          >
            <label
              htmlFor="entryAnswer"
              style={{
                display: "block",
                marginBottom: 8,
                fontSize: 13,
                fontWeight: 950,
                color: "#1e3a8a",
              }}
            >
              Entry question
            </label>

            <p
              style={{
                margin: "0 0 10px",
                color: "#1e40af",
                lineHeight: 1.45,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {entryQuestion}
            </p>

            <input
              id="entryAnswer"
              value={entryAnswer}
              onChange={(event) => setEntryAnswer(event.target.value)}
              placeholder="Type your answer"
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 16,
                border: "1px solid #93c5fd",
                padding: "12px 13px",
                fontSize: 15,
                outline: "none",
                background: "#ffffff",
              }}
            />
          </div>
        ) : null}

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            borderRadius: 18,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            padding: 13,
            color: "#334155",
            fontSize: 13,
            lineHeight: 1.45,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            style={{
              marginTop: 3,
              width: 16,
              height: 16,
              accentColor: "#2563eb",
            }}
          />

          <span>
            I confirm I have read and accept the terms and privacy policy, and I
            understand the organiser is responsible for the operation of this
            draw.
          </span>
        </label>
      </div>

      {error ? (
        <div
          style={{
            marginTop: 14,
            borderRadius: 18,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: 13,
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.45,
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          marginTop: 18,
          borderRadius: 22,
          background: "#020617",
          color: "#ffffff",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              Total
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 950,
              }}
            >
              {totalLabel}
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              Tickets
            </p>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 24,
                lineHeight: 1,
                fontWeight: 950,
              }}
            >
              {selectedTickets.length}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCheckout}
          disabled={busy || !selectedTickets.length}
          style={{
            width: "100%",
            border: "0",
            borderRadius: 18,
            background:
              busy || !selectedTickets.length
                ? "#475569"
                : "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
            color: "#ffffff",
            padding: "15px 18px",
            cursor: busy || !selectedTickets.length ? "not-allowed" : "pointer",
            fontSize: 15,
            fontWeight: 950,
            boxShadow:
              busy || !selectedTickets.length
                ? "none"
                : "0 18px 42px rgba(37,99,235,0.35)",
          }}
        >
          {busy ? "Preparing secure checkout..." : "Reserve and checkout"}
        </button>

        <p
          style={{
            margin: "10px 0 0",
            color: "#cbd5e1",
            fontSize: 12,
            lineHeight: 1.45,
            textAlign: "center",
          }}
        >
          Your tickets are reserved before you are sent to Stripe.
        </p>
      </div>
    </div>
  );
}
