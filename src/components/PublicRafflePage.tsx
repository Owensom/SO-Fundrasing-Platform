"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  slug: string;
};

type TicketSelection = {
  colour: string;
  number: number;
};

type RaffleColour = {
  id: string;
  name: string;
  hex?: string | null;
  sortOrder?: number;
};

type RaffleOffer = {
  id: string;
  label: string;
  quantity: number;
  price: number;
  isActive: boolean;
  sortOrder?: number;
};

type RafflePrize = {
  position: number;
  title: string;
  description: string;
  isPublic: boolean;
};

type RaffleWinner = {
  prizePosition: number;
  ticketNumber: number;
  colour: string | null;
  buyerName: string | null;
  drawnAt: string | null;
};

type SafeRaffleStatus = "draft" | "published" | "closed" | "drawn";

type SafeRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  tenantSlug: string;
  startNumber: number;
  endNumber: number;
  currency: string;
  ticketPrice: number;
  status: SafeRaffleStatus;
  colours: RaffleColour[];
  offers: RaffleOffer[];
  prizes: RafflePrize[];
  reservedTickets: Array<{ colour: string; number: number }>;
  soldTickets: Array<{ colour: string; number: number }>;
  winnerTicketNumber: number | null;
  winnerColour: string | null;
  drawnAt: string | null;
  winners: RaffleWinner[];
};

function makeTicketKey(colour: string, number: number) {
  return `${colour}::${number}`;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency || "GBP"} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function ordinal(position: number) {
  const suffix =
    position % 10 === 1 && position % 100 !== 11
      ? "st"
      : position % 10 === 2 && position % 100 !== 12
        ? "nd"
        : position % 10 === 3 && position % 100 !== 13
          ? "rd"
          : "th";

  return `${position}${suffix}`;
}

function normaliseFrontendStatus(rawStatus: unknown): SafeRaffleStatus {
  const status = String(rawStatus ?? "").trim().toLowerCase();
  if (status === "published") return "published";
  if (status === "drawn") return "drawn";
  if (status === "closed") return "closed";
  return "draft";
}

function toSafeRaffle(input: any): SafeRaffle {
  const raw = input ?? {};
  const colours = Array.isArray(raw.colours) ? raw.colours : [];
  const offers = Array.isArray(raw.offers) ? raw.offers : [];
  const prizes = Array.isArray(raw.prizes) ? raw.prizes : [];
  const reservedTickets = Array.isArray(raw.reservedTickets) ? raw.reservedTickets : [];
  const soldTickets = Array.isArray(raw.soldTickets) ? raw.soldTickets : [];
  const winners = Array.isArray(raw.winners) ? raw.winners : [];

  const startNumber = Number(raw.startNumber);
  const endNumber = Number(raw.endNumber);
  const rawWinnerTicketNumber = raw.winnerTicketNumber ?? raw.winner_ticket_number;
  const winnerTicketNumber = Number(rawWinnerTicketNumber);

  return {
    id: String(raw.id ?? ""),
    slug: String(raw.slug ?? ""),
    title: String(raw.title ?? "Raffle"),
    description: String(raw.description ?? ""),
    imageUrl: String(raw.imageUrl ?? raw.image_url ?? ""),
    tenantSlug: String(raw.tenantSlug ?? raw.tenant_slug ?? ""),
    startNumber: Number.isFinite(startNumber) ? startNumber : 1,
    endNumber: Number.isFinite(endNumber) ? endNumber : 1,
    currency: String(raw.currency ?? "GBP"),
    ticketPrice: Number.isFinite(Number(raw.ticketPrice)) ? Number(raw.ticketPrice) : 0,
    status: normaliseFrontendStatus(raw.status),
    colours: colours.map((c: any, index: number) => ({
      id: String(c?.id ?? `colour-${index}`),
      name: String(c?.name ?? c ?? `Colour ${index + 1}`),
      hex: c?.hex ? String(c.hex) : null,
      sortOrder: Number.isFinite(Number(c?.sortOrder)) ? Number(c.sortOrder) : index,
    })),
        offers: offers.map((o: any, index: number) => ({
      id: String(o?.id ?? `offer-${index}`),
      label: String(o?.label ?? `Offer ${index + 1}`),
      quantity: Number.isFinite(Number(o?.quantity)) ? Number(o.quantity) : 0,
      price: Number.isFinite(Number(o?.price)) ? Number(o.price) : 0,
      isActive: Boolean(o?.isActive ?? o?.is_active ?? true),
      sortOrder: Number.isFinite(Number(o?.sortOrder ?? o?.sort_order))
        ? Number(o?.sortOrder ?? o?.sort_order)
        : index,
    })),
    prizes: prizes
      .map((p: any, index: number) => ({
        position: Number.isFinite(Number(p?.position)) ? Number(p.position) : index + 1,
        title: String(p?.title ?? ""),
        description: String(p?.description ?? ""),
        isPublic: p?.isPublic !== false,
      }))
      .filter((p: RafflePrize) => p.title.trim().length > 0 && p.isPublic)
      .sort((a: RafflePrize, b: RafflePrize) => a.position - b.position),
    reservedTickets: reservedTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),
    soldTickets: soldTickets.map((t: any) => ({
      colour: String(t?.colour ?? ""),
      number: Number.isFinite(Number(t?.number)) ? Number(t.number) : 0,
    })),
    winnerTicketNumber: Number.isFinite(winnerTicketNumber) ? winnerTicketNumber : null,
    winnerColour:
      raw.winnerColour ?? raw.winner_colour
        ? String(raw.winnerColour ?? raw.winner_colour)
        : null,
    drawnAt:
      raw.drawnAt ?? raw.drawn_at
        ? String(raw.drawnAt ?? raw.drawn_at)
        : null,
    winners: winners.map((winner: any) => ({
      prizePosition: Number(winner.prizePosition ?? winner.prize_position ?? 1),
      ticketNumber: Number(winner.ticketNumber ?? winner.ticket_number ?? 0),
      colour:
        winner.colour != null && String(winner.colour).trim()
          ? String(winner.colour)
          : null,
      buyerName:
        winner.buyerName ?? winner.buyer_name
          ? String(winner.buyerName ?? winner.buyer_name)
          : null,
      drawnAt:
        winner.drawnAt ?? winner.drawn_at
          ? String(winner.drawnAt ?? winner.drawn_at)
          : null,
    })),
  };
}

function calculateBestPrice(quantity: number, ticketPrice: number, offers: RaffleOffer[]) {
  const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0));

  const activeOffers = offers
    .filter((o) => o.isActive && o.quantity > 0 && o.price > 0)
    .sort((a, b) => {
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0)) {
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }

      return a.quantity - b.quantity;
    });

  const dp: Array<{
    total: number;
    appliedOffers: Array<{ label: string; quantity: number; price: number; times: number }>;
  }> = Array.from({ length: safeQuantity + 1 }, () => ({
    total: Number.POSITIVE_INFINITY,
    appliedOffers: [],
  }));

  dp[0] = { total: 0, appliedOffers: [] };

  for (let i = 1; i <= safeQuantity; i += 1) {
    dp[i] = {
      total: dp[i - 1].total + ticketPrice,
      appliedOffers: [...dp[i - 1].appliedOffers],
    };

    for (const offer of activeOffers) {
      if (i < offer.quantity) continue;

      const previous = dp[i - offer.quantity];
      const candidateTotal = previous.total + offer.price;

      if (candidateTotal < dp[i].total) {
        const existing = previous.appliedOffers.find((item) => item.label === offer.label);

        dp[i] = {
          total: candidateTotal,
          appliedOffers: existing
            ? previous.appliedOffers.map((item) =>
                item.label === offer.label ? { ...item, times: item.times + 1 } : item
              )
            : [
                ...previous.appliedOffers,
                {
                  label: offer.label,
                  quantity: offer.quantity,
                  price: offer.price,
                  times: 1,
                },
              ],
        };
      }
    }
  }

  const total = Number.isFinite(dp[safeQuantity]?.total) ? dp[safeQuantity].total : 0;
  const standardTotal = safeQuantity * ticketPrice;
  const savings = Math.max(standardTotal - total, 0);

  return {
    quantity: safeQuantity,
    total,
    standardTotal,
    savings,
    appliedOffers: dp[safeQuantity]?.appliedOffers ?? [],
  };
}

function renderColourLabel(colour: RaffleColour) {
  if (colour.hex) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: colour.hex,
            border: "1px solid #cbd5e1",
            display: "inline-block",
          }}
        />
        {colour.name}
      </span>
    );
  }

  return colour.name;
}

function colourSwatch(colourName: string | null, colours: RaffleColour[]) {
  if (!colourName) return null;

  const match = colours.find((colour) => colour.name === colourName || colour.id === colourName);
  const background = match?.hex || colourName;

  return (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 999,
        background,
        border: "1px solid #cbd5e1",
        display: "inline-block",
      }}
    />
  );
}

export default function PublicRafflePage({ slug }: Props) {
  const [raffle, setRaffle] = useState<SafeRaffle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [basket, setBasket] = useState<TicketSelection[]>([]);
  const [autoQuantity, setAutoQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [reservationMessage, setReservationMessage] = useState("");

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setReservationMessage("");

        const response = await fetch(`/api/raffles/${encodeURIComponent(slug)}`);
        const text = await response.text();

        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`API did not return JSON: ${text.slice(0, 120)}`);
        }

        if (!response.ok) {
          throw new Error(parsed?.error || "Failed to load raffle");
        }

        const safe = toSafeRaffle(parsed?.raffle);

        if (!cancelled) {
          setRaffle(safe);
          setSelectedColour(safe.colours[0]?.name ?? "");
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

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);
  const availability = useMemo(() => {
    const sold = new Set<string>();
    const reserved = new Set<string>();

    if (!raffle) return { sold, reserved };

    for (const t of raffle.soldTickets) {
      sold.add(makeTicketKey(t.colour, t.number));
    }

    for (const t of raffle.reservedTickets) {
      reserved.add(makeTicketKey(t.colour, t.number));
    }

    return { sold, reserved };
  }, [raffle]);

  const basketKeys = useMemo(
    () => new Set(basket.map((t) => makeTicketKey(t.colour, t.number))),
    [basket]
  );

  const visibleNumbers = useMemo(() => {
    if (!raffle) return [];
    if (!Number.isFinite(raffle.startNumber) || !Number.isFinite(raffle.endNumber)) return [];
    if (raffle.endNumber < raffle.startNumber) return [];

    const out: number[] = [];
    for (let n = raffle.startNumber; n <= raffle.endNumber; n += 1) {
      out.push(n);
    }
    return out;
  }, [raffle]);

  const isPublished = raffle?.status === "published";
  const isClosed = raffle?.status === "closed";
  const isDrawn = raffle?.status === "drawn";
  const isDraft = raffle?.status === "draft";
  const canReserve = Boolean(raffle && isPublished);

  const pricing = useMemo(() => {
    if (!raffle) {
      return {
        quantity: 0,
        total: 0,
        standardTotal: 0,
        savings: 0,
        appliedOffers: [] as Array<{ label: string; quantity: number; price: number; times: number }>,
      };
    }

    return calculateBestPrice(basket.length, raffle.ticketPrice, isPublished ? raffle.offers : []);
  }, [basket.length, raffle, isPublished]);

  const estimatedFee = pricing.total > 0 ? Math.round(pricing.total * 0.1 * 100) / 100 : 0;
  const displayTotal = coverFees ? pricing.total + estimatedFee : pricing.total;

  const availableCount = useMemo(() => {
    if (!raffle) return 0;

    let count = 0;

    for (const colour of raffle.colours) {
      for (const number of visibleNumbers) {
        const key = makeTicketKey(colour.name, number);

        if (!availability.sold.has(key) && !availability.reserved.has(key)) {
          count += 1;
        }
      }
    }

    return count;
  }, [raffle, visibleNumbers, availability]);

  function toggleTicket(number: number) {
    if (!raffle || !selectedColour || !canReserve) return;

    const key = makeTicketKey(selectedColour, number);
    if (availability.sold.has(key) || availability.reserved.has(key)) return;

    setBasket((current) => {
      const exists = current.some(
        (ticket) => ticket.colour === selectedColour && ticket.number === number
      );

      if (exists) {
        return current.filter(
          (ticket) => !(ticket.colour === selectedColour && ticket.number === number)
        );
      }

      return [...current, { colour: selectedColour, number }].sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        return a.number - b.number;
      });
    });
  }

  function removeFromBasket(ticket: TicketSelection) {
    setBasket((current) =>
      current.filter(
        (item) => !(item.colour === ticket.colour && item.number === ticket.number)
      )
    );
  }

  function clearBasket() {
    setBasket([]);
    setError("");
    setReservationMessage("");
  }

  function autoSelectTicketQuantity(quantity: number) {
    if (!raffle || !canReserve) return;

    const requested = Math.max(1, Math.floor(Number(quantity) || 0));

    const selected: TicketSelection[] = [];
    const selectedKeys = new Set<string>();

    const sortedColours = raffle.colours
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const colour of sortedColours) {
      for (const number of visibleNumbers) {
        if (selected.length >= requested) break;

        const key = makeTicketKey(colour.name, number);

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

    if (selected.length < requested) {
      setBasket(selected);
      setError(
        `Only ${selected.length} ticket${selected.length === 1 ? "" : "s"} could be selected. Not enough tickets are available.`
      );
      return;
    }

    setBasket(
      selected.sort((a, b) => {
        if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
        return a.number - b.number;
      })
    );

    setAutoQuantity(requested);
    setError("");
    setReservationMessage("");
  }

  function autoSelectTickets() {
    if (!autoQuantity || autoQuantity <= 0) {
      setError("Enter how many tickets you would like.");
      return;
    }

    autoSelectTicketQuantity(autoQuantity);
  }

  async function reserveTickets() {
    if (!raffle || !canReserve) return;

    try {
      setSaving(true);
      setError("");
      setReservationMessage("");

      if (!buyerName.trim()) throw new Error("Please enter your name.");
      if (!buyerEmail.trim()) throw new Error("Please enter your email.");
      if (basket.length === 0) throw new Error("Please select at least one ticket.");

      const selectedTickets = basket.map((ticket) => ({
        ticket_number: ticket.number,
        colour: ticket.colour,
      }));

      const reserveResponse = await fetch(
        `/api/raffles/${encodeURIComponent(raffle.slug)}/reserve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantSlug: raffle.tenantSlug,
            buyerName: buyerName.trim(),
            buyerEmail: buyerEmail.trim(),
            quantity: basket.length,
            selectedTickets,
          }),
        }
      );

      const reserveText = await reserveResponse.text();

      let reserveParsed: any = null;
      try {
        reserveParsed = JSON.parse(reserveText);
      } catch {
        throw new Error(`Reserve API did not return JSON: ${reserveText.slice(0, 120)}`);
      }

      if (!reserveResponse.ok) {
        throw new Error(reserveParsed?.error || "Reserve failed");
      }

      const reservationToken = String(reserveParsed?.reservationToken ?? "").trim();

      if (!reservationToken) {
        throw new Error("Reservation succeeded but no reservation token was returned.");
      }

      setReservationMessage(`Reserved until ${String(reserveParsed?.expiresAt ?? "")}`);

      const checkoutResponse = await fetch(`/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId: raffle.id,
          reservationToken,
          coverFees,
        }),
      });

      const checkoutText = await checkoutResponse.text();

      let checkoutParsed: any = null;
      try {
        checkoutParsed = JSON.parse(checkoutText);
      } catch {
        throw new Error(`Checkout API did not return JSON: ${checkoutText.slice(0, 120)}`);
      }

      if (!checkoutResponse.ok) {
        throw new Error(checkoutParsed?.error || "Checkout failed");
      }

      const checkoutUrl = String(
        checkoutParsed?.url ??
          checkoutParsed?.checkoutUrl ??
          checkoutParsed?.sessionUrl ??
          ""
      ).trim();

      if (!checkoutUrl) {
        throw new Error("Checkout session created but no checkout URL was returned.");
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reserve failed");
    } finally {
      setSaving(false);
    }
  }
