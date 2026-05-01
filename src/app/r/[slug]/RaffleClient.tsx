"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Colour = {
  id: string;
  name: string;
  sortOrder?: number;
};

type Ticket = {
  colour: string;
  number: number;
};

type Props = {
  raffle: any;
};

function formatCurrencyFromCents(cents: number, currency: string) {
  const major = Number(cents || 0) / 100;

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(major) ? major : 0);
  } catch {
    return `${currency || "GBP"} ${(Number.isFinite(major) ? major : 0).toFixed(
      2,
    )}`;
  }
}

function normalise(value: string) {
  return String(value || "").trim().toLowerCase();
}

function ticketKey(colour: string, number: number) {
  return `${normalise(colour)}:${Number(number)}`;
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

function getTicketNumber(ticket: any) {
  return Number(ticket?.number ?? ticket?.ticket_number);
}

export default function RaffleClient({ raffle }: Props) {
  const config = raffle.config_json || {};
  const currency = String(config.currency || "GBP");
  const ticketPriceCents = getTicketPrice(config);
  const entryQuestion = getEntryQuestion(config);
  const correctAnswer = getCorrectAnswer(config);

  const colours: Colour[] = useMemo(() => {
    const list =
      Array.isArray(raffle.colours) && raffle.colours.length
        ? raffle.colours
        : [{ id: "default", name: "Default", sortOrder: 0 }];

    return [...list].sort((a, b) => {
      const aOrder = Number.isFinite(Number(a.sortOrder))
        ? Number(a.sortOrder)
        : 999;
      const bOrder = Number.isFinite(Number(b.sortOrder))
        ? Number(b.sortOrder)
        : 999;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [raffle.colours]);

  const numbers = useMemo(() => {
    const start = Number(raffle.startNumber || 1);
    const end = Number(raffle.endNumber || 100);
    const list: number[] = [];

    for (let number = start; number <= end; number += 1) {
      list.push(number);
    }

    return list;
  }, [raffle.startNumber, raffle.endNumber]);

  const unavailableTickets = useMemo(() => {
    const set = new Set<string>();

    for (const ticket of raffle.soldTickets || []) {
      set.add(ticketKey(ticket.colour, getTicketNumber(ticket)));
    }

    for (const ticket of raffle.reservedTickets || []) {
      set.add(ticketKey(ticket.colour, getTicketNumber(ticket)));
    }

    return set;
  }, [raffle.soldTickets, raffle.reservedTickets]);

  const [selectedTickets, setSelectedTickets] = useState<Ticket[]>([]);
  const [autoQuantity, setAutoQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [entryAnswer, setEntryAnswer] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reservationMessage, setReservationMessage] = useState("");

  const selectedSet = useMemo(() => {
    return new Set(
      selectedTickets.map((ticket) => ticketKey(ticket.colour, ticket.number)),
    );
  }, [selectedTickets]);

  const availableTickets = useMemo(() => {
    const list: Ticket[] = [];

    for (const colour of colours) {
      for (const number of numbers) {
        const key = ticketKey(colour.name, number);

        if (!unavailableTickets.has(key)) {
          list.push({ colour: colour.name, number });
        }
      }
    }

    return list;
  }, [colours, numbers, unavailableTickets]);

  const subtotalCents = selectedTickets.length * ticketPriceCents;
  const feeCents = coverFees ? Math.round(subtotalCents * 0.1) : 0;
  const totalCents = subtotalCents + feeCents;

  function toggleTicket(colour: string, number: number) {
    const key = ticketKey(colour, number);

    if (unavailableTickets.has(key)) return;

    setSelectedTickets((current) => {
      const exists = current.some(
        (ticket) => ticketKey(ticket.colour, ticket.number) === key,
      );

      if (exists) {
        return current.filter(
          (ticket) => ticketKey(ticket.colour, ticket.number) !== key,
        );
      }

      return [...current, { colour, number }].sort((a, b) => {
        const colourCompare = a.colour.localeCompare(b.colour);
        if (colourCompare !== 0) return colourCompare;
        return a.number - b.number;
      });
    });

    setError("");
    setReservationMessage("");
  }

  function clearBasket() {
    setSelectedTickets([]);
    setError("");
    setReservationMessage("");
  }

  function autoSelectTickets(quantity: number) {
    const requested = Math.max(1, Math.floor(Number(quantity) || 0));

    const alreadySelected = new Set(
      selectedTickets.map((ticket) => ticketKey(ticket.colour, ticket.number)),
    );

    const remaining = availableTickets.filter(
      (ticket) => !alreadySelected.has(ticketKey(ticket.colour, ticket.number)),
    );

    if (remaining.length < requested) {
      setError("There are not enough available tickets left.");
      return;
    }

    const shuffled = [...remaining].sort(() => Math.random() - 0.5);
    setSelectedTickets((current) => [...current, ...shuffled.slice(0, requested)]);
    setAutoQuantity(requested);
    setError("");
    setReservationMessage("");
  }

  function validate() {
    if (!customerName.trim()) return "Please enter your name.";
    if (!customerEmail.trim()) return "Please enter your email.";
    if (selectedTickets.length === 0) {
      return "Please select at least one ticket.";
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

  async function reserveTickets() {
    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      const validationError = validate();

      if (validationError) {
        throw new Error(validationError);
      }

      const selectedTicketsForApi = selectedTickets.map((ticket) => ({
        colour: ticket.colour,
        number: ticket.number,
        ticket_number: ticket.number,
      }));

      const reserveResponse = await fetch(`/api/raffles/${raffle.slug}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId: raffle.id,
          raffleSlug: raffle.slug,
          slug: raffle.slug,
          selectedTickets: selectedTicketsForApi,
          tickets: selectedTicketsForApi,
          buyerName: customerName.trim(),
          buyerEmail: customerEmail.trim(),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          entryAnswer: entryAnswer.trim(),
          legalAnswer: entryAnswer.trim(),
          termsAccepted,
          coverFees,
        }),
      });

      const reserveText = await reserveResponse.text();

      let reserveParsed: any = null;

      try {
        reserveParsed = JSON.parse(reserveText);
      } catch {
        throw new Error(
          `Reserve API did not return JSON: ${reserveText.slice(0, 120)}`,
        );
      }

      if (!reserveResponse.ok || reserveParsed?.ok === false) {
        throw new Error(reserveParsed?.error || "Reserve failed");
      }

      const reservationToken = String(
        reserveParsed?.reservationToken ??
          reserveParsed?.reservation_token ??
          reserveParsed?.token ??
          reserveParsed?.reservation?.token ??
          "",
      ).trim();

      if (!reservationToken) {
        throw new Error(
          "Reservation succeeded but no reservation token was returned.",
        );
      }

      setReservationMessage("Tickets reserved. Redirecting to checkout...");

      const checkoutResponse = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "raffle",
          productType: "raffle",
          raffleId: raffle.id,
          raffleSlug: raffle.slug,
          slug: raffle.slug,
          reservationToken,
          reservation_token: reservationToken,
          selectedTickets: selectedTicketsForApi,
          tickets: selectedTicketsForApi,
          buyerName: customerName.trim(),
          buyerEmail: customerEmail.trim(),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          entryAnswer: entryAnswer.trim(),
          legalAnswer: entryAnswer.trim(),
          termsAccepted,
          coverFees,
        }),
      });

      const checkoutText = await checkoutResponse.text();

      let checkoutParsed: any = null;

      try {
        checkoutParsed = JSON.parse(checkoutText);
      } catch {
        throw new Error(
          `Checkout API did not return JSON: ${checkoutText.slice(0, 120)}`,
        );
      }

      if (!checkoutResponse.ok || checkoutParsed?.ok === false) {
        throw new Error(checkoutParsed?.error || "Checkout failed");
      }

      const checkoutUrl = String(
        checkoutParsed?.url ??
          checkoutParsed?.checkoutUrl ??
          checkoutParsed?.sessionUrl ??
          "",
      ).trim();

      if (!checkoutUrl) {
        throw new Error(
          "Checkout session created but no checkout URL was returned.",
        );
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={styles.quickSelect}>
        <div>
          <h2 style={{ margin: 0 }}>Quick buy</h2>
          <p style={{ margin: "6px 0 0", color: "#64748b" }}>
            Choose how many tickets you would like and we’ll randomly
            auto-select available numbers.
          </p>
        </div>

        <div style={styles.quickControls}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={styles.smallLabel}>Number of tickets</span>
            <input
              type="number"
              min={1}
              max={availableTickets.length || 1}
              value={autoQuantity === 0 ? "" : autoQuantity}
              onChange={(event) => {
                const raw = event.target.value;

                if (raw === "") {
                  setAutoQuantity(0);
                  return;
                }

                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) return;

                setAutoQuantity(parsed);
              }}
              style={styles.quantityInput}
            />
          </label>

          <button
            type="button"
            onClick={() => autoSelectTickets(autoQuantity)}
            style={styles.autoButton}
            disabled={saving}
          >
            Auto select
          </button>

          <button
            type="button"
            onClick={clearBasket}
            style={styles.clearButton}
            disabled={saving}
          >
            Clear basket
          </button>
        </div>
      </section>

      <h2 style={styles.heading}>Choose tickets</h2>

      <div style={{ display: "grid", gap: 22 }}>
        {colours.map((colour) => (
          <section key={colour.id || colour.name}>
            <h3 style={styles.colourHeading}>{colour.name}</h3>

            <div style={styles.numberGrid}>
              {numbers.map((number) => {
                const key = ticketKey(colour.name, number);
                const isUnavailable = unavailableTickets.has(key);
                const isSelected = selectedSet.has(key);

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleTicket(colour.name, number)}
                    disabled={isUnavailable || saving}
                    style={{
                      ...styles.numberButton,
                      background: isSelected
                        ? "#2563eb"
                        : isUnavailable
                          ? "#111827"
                          : "#ffffff",
                      color: isSelected || isUnavailable ? "#ffffff" : "#111827",
                      cursor:
                        isUnavailable || saving ? "not-allowed" : "pointer",
                    }}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <h2 style={styles.heading}>Basket</h2>

      {selectedTickets.length === 0 ? (
        <div style={styles.notice}>No tickets selected yet.</div>
      ) : (
        <div style={styles.basket}>
          {selectedTickets.map((ticket) => (
            <div key={ticketKey(ticket.colour, ticket.number)} style={styles.basketRow}>
              <span>
                {ticket.colour} ticket #{ticket.number}
              </span>

              <button
                type="button"
                onClick={() => toggleTicket(ticket.colour, ticket.number)}
                style={styles.removeButton}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.totalBox}>
        <div>Tickets: {selectedTickets.length}</div>

        <div>
          Ticket total: {formatCurrencyFromCents(subtotalCents, currency)}
        </div>

        <label style={styles.coverFeesBox}>
          <input
            type="checkbox"
            checked={coverFees}
            onChange={(event) => setCoverFees(event.target.checked)}
            disabled={selectedTickets.length === 0}
          />

          <span>
            <strong>I’d like to cover platform fees</strong>
            <br />
            <span style={{ color: "#64748b", fontSize: 13 }}>
              Adds approximately {formatCurrencyFromCents(feeCents, currency)} so
              the organiser receives the full ticket value.
            </span>
          </span>
        </label>

        <div>Total today: {formatCurrencyFromCents(totalCents, currency)}</div>
      </div>

      <h2 style={styles.heading}>Your details</h2>

      <div style={styles.form}>
        <input
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Your name"
          style={styles.input}
          disabled={saving}
        />

        <input
          value={customerEmail}
          onChange={(event) => setCustomerEmail(event.target.value)}
          placeholder="Your email"
          type="email"
          style={styles.input}
          disabled={saving}
        />

        {entryQuestion ? (
          <div style={styles.questionBox}>
            <div style={styles.questionTitle}>Entry question</div>
            <div style={styles.questionText}>{entryQuestion}</div>

            <input
              value={entryAnswer}
              onChange={(event) => setEntryAnswer(event.target.value)}
              placeholder="Your answer"
              style={styles.input}
              disabled={saving}
            />
          </div>
        ) : null}

        <label style={styles.termsBox}>
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            disabled={saving}
          />

          <span>
            I confirm I have read and accept the{" "}
            <Link href="/terms" style={styles.inlineLink}>
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" style={styles.inlineLink}>
              privacy policy
            </Link>
            .
          </span>
        </label>

        <button
          type="button"
          onClick={reserveTickets}
          disabled={saving || selectedTickets.length === 0}
          style={{
            ...styles.primaryButton,
            opacity: saving || selectedTickets.length === 0 ? 0.6 : 1,
            cursor:
              saving || selectedTickets.length === 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          {saving ? "Redirecting to checkout..." : "Reserve and pay"}
        </button>
      </div>

      {reservationMessage ? (
        <div style={styles.success}>{reservationMessage}</div>
      ) : null}

      {error ? <div style={styles.error}>{error}</div> : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: {
    marginTop: 0,
    marginBottom: 12,
    fontSize: "clamp(20px, 5vw, 28px)",
    lineHeight: 1.2,
  },
  quickSelect: {
    padding: 16,
    borderRadius: 14,
    background: "#f0f9ff",
    border: "1px solid #bae6fd",
    display: "grid",
    gap: 14,
  },
  quickControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "end",
  },
  smallLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#475569",
  },
  quantityInput: {
    width: 130,
    height: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #93c5fd",
    fontSize: 16,
    fontWeight: 700,
  },
  autoButton: {
    height: 44,
    padding: "0 16px",
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },
  clearButton: {
    height: 44,
    padding: "0 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 700,
    cursor: "pointer",
  },
  colourHeading: {
    margin: "0 0 10px",
    fontSize: 18,
    color: "#0f172a",
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
    gap: 8,
  },
  numberButton: {
    height: 48,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontWeight: 700,
  },
  basket: {
    display: "grid",
    gap: 8,
  },
  basketRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: 12,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    flexWrap: "wrap",
  },
  removeButton: {
    border: "none",
    background: "transparent",
    color: "#dc2626",
    fontWeight: 700,
    cursor: "pointer",
  },
  totalBox: {
    marginTop: 0,
    padding: 14,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "grid",
    gap: 8,
    fontWeight: 700,
    lineHeight: 1.4,
    wordBreak: "break-word",
  },
  coverFeesBox: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    cursor: "pointer",
  },
  form: {
    display: "grid",
    gap: 12,
  },
  input: {
    height: 44,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    minWidth: 0,
  },
  questionBox: {
    padding: 14,
    borderRadius: 10,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    display: "grid",
    gap: 10,
  },
  questionTitle: {
    fontWeight: 900,
    color: "#1e3a8a",
  },
  questionText: {
    color: "#1e40af",
    fontWeight: 700,
  },
  termsBox: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    cursor: "pointer",
    color: "#334155",
    lineHeight: 1.45,
  },
  inlineLink: {
    color: "#2563eb",
    fontWeight: 800,
  },
  primaryButton: {
    height: 48,
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
  },
  notice: {
    padding: 12,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
  },
  success: {
    padding: 12,
    borderRadius: 10,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
  },
  error: {
    padding: 12,
    borderRadius: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
  },
};
