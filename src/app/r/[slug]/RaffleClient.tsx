"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Colour = {
  id: string;
  name: string;
  sortOrder?: number;
};

type TicketRef = {
  colour: string;
  number?: number;
  ticket_number?: number;
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

function normalise(value: string) {
  return String(value || "").trim().toLowerCase();
}

function ticketNumber(ticket: TicketRef) {
  return Number(ticket.number ?? ticket.ticket_number);
}

function ticketKey(colour: string, number: number) {
  return `${normalise(colour)}:${number}`;
}

function moneyFromCents(cents: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `£${(cents / 100).toFixed(2)}`;
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

function getCorrectAnswer(config: any) {
  return String(
    config?.question?.answer ??
      config?.question?.correctAnswer ??
      config?.question?.correct_answer ??
      "",
  ).trim();
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
  const entryQuestion = getEntryQuestion(config);
  const correctAnswer = getCorrectAnswer(config);

  const colours = useMemo(() => {
    const safe =
      Array.isArray(raffle.colours) && raffle.colours.length
        ? raffle.colours
        : [{ id: "default", name: "Default", sortOrder: 0 }];

    return sortColours(safe);
  }, [raffle.colours]);

  const numbers = useMemo(() => {
    const start = Number(raffle.startNumber || 1);
    const end = Number(raffle.endNumber || 100);
    const list: number[] = [];

    for (let i = start; i <= end; i += 1) {
      list.push(i);
    }

    return list;
  }, [raffle.startNumber, raffle.endNumber]);

  const soldSet = useMemo(() => {
    return new Set(
      (raffle.soldTickets || [])
        .map((ticket) => ticketKey(ticket.colour, ticketNumber(ticket)))
        .filter(Boolean),
    );
  }, [raffle.soldTickets]);

  const reservedSet = useMemo(() => {
    return new Set(
      (raffle.reservedTickets || [])
        .map((ticket) => ticketKey(ticket.colour, ticketNumber(ticket)))
        .filter(Boolean),
    );
  }, [raffle.reservedTickets]);

  const [selectedTickets, setSelectedTickets] = useState<
    { colour: string; number: number }[]
  >([]);
  const [quickBuyCount, setQuickBuyCount] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [entryAnswer, setEntryAnswer] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => {
    return new Set(
      selectedTickets.map((ticket) => ticketKey(ticket.colour, ticket.number)),
    );
  }, [selectedTickets]);

  const availableTickets = useMemo(() => {
    const list: { colour: string; number: number }[] = [];

    for (const colour of colours) {
      for (const number of numbers) {
        const key = ticketKey(colour.name, number);

        if (!soldSet.has(key) && !reservedSet.has(key)) {
          list.push({ colour: colour.name, number });
        }
      }
    }

    return list;
  }, [colours, numbers, soldSet, reservedSet]);

  const ticketTotalCents = selectedTickets.length * ticketPriceCents;
  const platformFeeCents = coverFees ? Math.ceil(ticketTotalCents * 0.03) : 0;
  const totalTodayCents = ticketTotalCents + platformFeeCents;

  function toggleTicket(colour: string, number: number) {
    const key = ticketKey(colour, number);

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

      return [...current, { colour, number }];
    });
  }

  function clearBasket() {
    setSelectedTickets([]);
    setError("");
  }

  function autoSelectTickets() {
    setError("");

    const count = Math.max(1, Number(quickBuyCount || 1));
    const alreadySelected = new Set(
      selectedTickets.map((ticket) => ticketKey(ticket.colour, ticket.number)),
    );

    const remaining = availableTickets.filter(
      (ticket) => !alreadySelected.has(ticketKey(ticket.colour, ticket.number)),
    );

    if (remaining.length < count) {
      setError("There are not enough available tickets left.");
      return;
    }

    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    setSelectedTickets((current) => [...current, ...shuffled.slice(0, count)]);
  }

  function validate() {
    if (!selectedTickets.length) return "Please select at least one ticket.";
    if (!buyerName.trim()) return "Please enter your name.";
    if (!buyerEmail.trim() || !buyerEmail.includes("@")) {
      return "Please enter a valid email address.";
    }

    if (entryQuestion) {
      if (!entryAnswer.trim()) return "Please answer the entry question.";

      if (correctAnswer && normalise(entryAnswer) !== normalise(correctAnswer)) {
        return "The entry question answer is not correct.";
      }
    }

    if (!termsAccepted) {
      return "Please accept the terms and privacy policy before checkout.";
    }

    return "";
  }

  async function reserveAndPay() {
    setError("");

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);

    try {
      const selectedTicketsForApi = selectedTickets.map((ticket) => ({
        colour: ticket.colour,
        number: ticket.number,
        ticket_number: ticket.number,
      }));

      const reserveResponse = await fetch(`/api/raffles/${raffle.slug}/reserve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raffleId: raffle.id,
          raffleSlug: raffle.slug,
          slug: raffle.slug,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          customerName: buyerName.trim(),
          customerEmail: buyerEmail.trim(),
          selectedTickets: selectedTicketsForApi,
          tickets: selectedTicketsForApi,
          entryAnswer: entryAnswer.trim(),
          legalAnswer: entryAnswer.trim(),
          termsAccepted,
          coverFees,
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
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          customerName: buyerName.trim(),
          customerEmail: buyerEmail.trim(),
          selectedTickets: selectedTicketsForApi,
          tickets: selectedTicketsForApi,
          entryAnswer: entryAnswer.trim(),
          legalAnswer: entryAnswer.trim(),
          termsAccepted,
          coverFees,
        }),
      });

      const checkoutData = await checkoutResponse.json().catch(() => null);

      if (!checkoutResponse.ok || checkoutData?.ok === false) {
        throw new Error(
          checkoutData?.error ||
            checkoutData?.message ||
            "Checkout could not be started.",
        );
      }

      const url =
        checkoutData?.url ||
        checkoutData?.checkoutUrl ||
        checkoutData?.sessionUrl;

      if (!url) {
        throw new Error("Checkout was created but no Stripe URL was returned.");
      }

      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || "Checkout failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section
        style={{
          border: "1px solid #bae6fd",
          background: "#eff6ff",
          borderRadius: 18,
          padding: 18,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 26,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            color: "#020617",
          }}
        >
          Quick buy
        </h2>

        <p
          style={{
            margin: "8px 0 16px",
            color: "#64748b",
            fontSize: 16,
            lineHeight: 1.5,
          }}
        >
          Choose how many tickets you would like and we’ll randomly auto-select
          available numbers.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#334155",
              }}
            >
              Number of tickets
            </span>

            <input
              type="number"
              min={1}
              value={quickBuyCount}
              onChange={(event) =>
                setQuickBuyCount(Math.max(1, Number(event.target.value || 1)))
              }
              style={{
                width: 150,
                border: "1px solid #93c5fd",
                borderRadius: 10,
                padding: "13px 14px",
                fontWeight: 800,
                fontSize: 16,
                background: "#ffffff",
              }}
            />
          </label>

          <button
            type="button"
            onClick={autoSelectTickets}
            disabled={busy}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "14px 18px",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Auto select
          </button>

          <button
            type="button"
            onClick={clearBasket}
            disabled={busy}
            style={{
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "14px 18px",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 900,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Clear basket
          </button>
        </div>
      </section>

      <section>
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: 30,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            color: "#020617",
          }}
        >
          Choose tickets
        </h2>

        <div style={{ display: "grid", gap: 24 }}>
          {colours.map((colour) => (
            <div key={colour.id || colour.name}>
              <h3
                style={{
                  margin: "0 0 10px",
                  fontSize: 18,
                  color: "#0f172a",
                }}
              >
                {colour.name} tickets
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))",
                  gap: 8,
                }}
              >
                {numbers.map((number) => {
                  const key = ticketKey(colour.name, number);
                  const isSold = soldSet.has(key);
                  const isReserved = reservedSet.has(key);
                  const isSelected = selectedSet.has(key);
                  const unavailable = isSold || isReserved;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={unavailable || busy}
                      onClick={() => toggleTicket(colour.name, number)}
                      style={{
                        minHeight: 50,
                        borderRadius: 10,
                        border: isSelected
                          ? "1px solid #0f172a"
                          : "1px solid #cbd5e1",
                        background: isSelected
                          ? "#0f172a"
                          : unavailable
                            ? "#e2e8f0"
                            : "#ffffff",
                        color: isSelected
                          ? "#ffffff"
                          : unavailable
                            ? "#94a3b8"
                            : "#1e293b",
                        fontWeight: 900,
                        cursor: unavailable || busy ? "not-allowed" : "pointer",
                        boxShadow: isSelected
                          ? "0 8px 18px rgba(15,23,42,0.22)"
                          : "0 1px 2px rgba(15,23,42,0.04)",
                      }}
                    >
                      {number}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2
          style={{
            margin: "0 0 12px",
            fontSize: 30,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            color: "#020617",
          }}
        >
          Basket
        </h2>

        <div
          style={{
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            borderRadius: 10,
            padding: 14,
            color: "#64748b",
            minHeight: 48,
          }}
        >
          {selectedTickets.length === 0 ? (
            <span>No tickets selected yet.</span>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedTickets.map((ticket) => (
                <button
                  key={ticketKey(ticket.colour, ticket.number)}
                  type="button"
                  onClick={() => toggleTicket(ticket.colour, ticket.number)}
                  style={{
                    border: "1px solid #bfdbfe",
                    background: "#ffffff",
                    color: "#1d4ed8",
                    borderRadius: 999,
                    padding: "8px 11px",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {ticket.colour} {ticket.number} ×
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            borderRadius: 10,
            padding: 16,
            color: "#020617",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 900 }}>
            Tickets: {selectedTickets.length}
          </p>

          <p style={{ margin: "0 0 12px", fontWeight: 900 }}>
            Ticket total: {moneyFromCents(ticketTotalCents, currency)}
          </p>

          <label
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              borderRadius: 10,
              padding: 14,
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={coverFees}
              onChange={(event) => setCoverFees(event.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2 }}
            />

            <span>
              I’d like to cover platform fees
              <br />
              <span
                style={{
                  color: "#64748b",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                Adds approximately {moneyFromCents(platformFeeCents, currency)} so
                the organiser receives the full ticket value.
              </span>
            </span>
          </label>

          <p style={{ margin: "14px 0 0", fontWeight: 950 }}>
            Total today: {moneyFromCents(totalTodayCents, currency)}
          </p>
        </div>
      </section>

      <section>
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: 30,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            color: "#020617",
          }}
        >
          Your details
        </h2>

        <div style={{ display: "grid", gap: 12 }}>
          <input
            value={buyerName}
            onChange={(event) => setBuyerName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "14px 15px",
              fontSize: 16,
            }}
          />

          <input
            value={buyerEmail}
            onChange={(event) => setBuyerEmail(event.target.value)}
            placeholder="Your email"
            autoComplete="email"
            type="email"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #cbd5e1",
              borderRadius: 10,
              padding: "14px 15px",
              fontSize: 16,
            }}
          />

          {entryQuestion ? (
            <div
              style={{
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <label
                style={{
                  display: "block",
                  color: "#1e3a8a",
                  fontWeight: 950,
                  marginBottom: 8,
                }}
              >
                Entry question
              </label>

              <p
                style={{
                  margin: "0 0 10px",
                  color: "#1e40af",
                  fontWeight: 800,
                }}
              >
                {entryQuestion}
              </p>

              <input
                value={entryAnswer}
                onChange={(event) => setEntryAnswer(event.target.value)}
                placeholder="Your answer"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #93c5fd",
                  borderRadius: 10,
                  padding: "14px 15px",
                  fontSize: 16,
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
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              borderRadius: 10,
              padding: 14,
              color: "#334155",
              fontSize: 14,
              lineHeight: 1.45,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              style={{ width: 18, height: 18, marginTop: 2 }}
            />

            <span>
              I confirm I have read and accept the{" "}
              <Link href="/terms" style={{ color: "#2563eb", fontWeight: 900 }}>
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" style={{ color: "#2563eb", fontWeight: 900 }}>
                privacy policy
              </Link>
              .
            </span>
          </label>

          {error ? (
            <div
              style={{
                border: "1px solid #fecaca",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 10,
                padding: 13,
                fontWeight: 800,
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={reserveAndPay}
            disabled={busy}
            style={{
              border: 0,
              borderRadius: 10,
              padding: "16px 18px",
              background: busy ? "#94a3b8" : "#22c55e",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 950,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Preparing checkout..." : "Reserve and pay"}
          </button>
        </div>
      </section>
    </div>
  );
}
