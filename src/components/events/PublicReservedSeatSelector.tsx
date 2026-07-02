"use client";

import { useMemo, useState, type CSSProperties } from "react";
import BuyerDetailsFields from "@/components/events/BuyerDetailsFields";
import PublicEventCheckoutAddOnSelector, {
  type PublicEventCheckoutAddOn,
  type PublicEventCheckoutAddOnPlayer,
  type PublicEventCheckoutAddOnSelection,
} from "@/components/events/PublicEventCheckoutAddOnSelector";

type Seat = {
  id: string;
  ticket_type_id: string | null;
  section: string | null;
  row_label: string | null;
  seat_number: string | null;
  table_number: string | null;
  aisle_after: number | null;
  status: string;
};

type TicketType = {
  id: string;
  name: string;
  price: number;
};

type CartItem = {
  seatId: string;
  ticketTypeId: string;
};

type GuestData = {
  guestName: string;
  dietaryRequirements: string;
  menuChoice: string;
  tableName: string;
};

type RowEntry = {
  section: string;
  row: string;
  rowKey: string;
  seats: Seat[];
  available: number;
  unavailable: number;
  selected: number;
};

const TICKET_PLACEHOLDER_IMAGE = "/brand/so-ticket-placeholder.png";
const STRIPE_STANDARD_UK_PERCENT = 0.015;
const STRIPE_STANDARD_UK_FIXED_CENTS = 20;

const specialColours = [
  { background: "#facc15", text: "#422006" },
  { background: "#a78bfa", text: "#2e1065" },
  { background: "#fb7185", text: "#4c0519" },
  { background: "#60a5fa", text: "#082f49" },
  { background: "#fb923c", text: "#431407" },
];

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function safePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.min(100, number);
}

function cleanAccessCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanAnswer(value: unknown) {
  return String(value || "").trim();
}

function cleanPlayer(value: unknown) {
  return String(value || "").trim();
}

function livePlayerText(value: unknown) {
  return String(value || "");
}

function isValidEmail(value: unknown) {
  const email = cleanPlayer(value).toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalisePlayerRows(input: {
  quantity: number;
  players?: PublicEventCheckoutAddOnPlayer[];
  buyerName: string;
  buyerEmail: string;
}) {
  const quantity = Math.max(0, Math.floor(Number(input.quantity || 0)));
  const existingPlayers = Array.isArray(input.players) ? input.players : [];

  return Array.from({ length: quantity }).map((_, index) => {
    const existing = existingPlayers[index];

    if (existing) {
      return {
        name: livePlayerText(existing.name),
        email: livePlayerText(existing.email),
      };
    }

    if (index === 0) {
      return {
        name: livePlayerText(input.buyerName),
        email: livePlayerText(input.buyerEmail),
      };
    }

    return {
      name: "",
      email: "",
    };
  });
}

function calculatePlatformCommissionCents(
  subtotalCents: number,
  platformFeePercent: number,
) {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents || 0)));
  const percent = safePercent(platformFeePercent);

  if (!subtotal || !percent) return 0;

  return Math.max(0, Math.ceil(subtotal * (percent / 100)));
}

function calculatePlatformFeeCents(
  subtotalCents: number,
  platformFeePercent: number,
) {
  const subtotal = Math.max(0, Math.round(Number(subtotalCents || 0)));

  if (!subtotal || subtotal <= 0) return 0;

  const platformCommissionCents = calculatePlatformCommissionCents(
    subtotal,
    platformFeePercent,
  );

  const grossTotalCents = Math.ceil(
    (subtotal + platformCommissionCents + STRIPE_STANDARD_UK_FIXED_CENTS) /
      (1 - STRIPE_STANDARD_UK_PERCENT),
  );

  return Math.max(0, grossTotalCents - subtotal);
}

function normaliseAddOnQuantity(
  quantity: number,
  addOn?: PublicEventCheckoutAddOn | null,
) {
  const cleanQuantity = Math.max(0, Math.floor(Number(quantity || 0)));
  const max = Number(addOn?.maxEntriesPerBooking || 0);

  if (Number.isFinite(max) && max > 0) {
    return Math.min(cleanQuantity, Math.floor(max));
  }

  return cleanQuantity;
}

function normaliseAddOnQuantities(input: {
  checkoutAddOns: PublicEventCheckoutAddOn[];
  addOnQuantities: Record<string, number>;
  hasAccessCode: boolean;
  hasSeatSelection: boolean;
}) {
  if (input.hasAccessCode || !input.hasSeatSelection) {
    return {};
  }

  return Object.fromEntries(
    input.checkoutAddOns.map((addOn) => [
      addOn.type,
      normaliseAddOnQuantity(input.addOnQuantities[addOn.type] || 0, addOn),
    ]),
  );
}

function addOnNeedsBuyerAnswer(addOn: PublicEventCheckoutAddOn) {
  return Boolean(
    addOn.type === "higher_or_lower" &&
      addOn.legalQuestionEnabled &&
      cleanAnswer(addOn.legalQuestionText),
  );
}

function seatLabel(seat: Seat) {
  return `Row ${seat.row_label}, Seat ${seat.seat_number}`;
}

function numericSort(a: string | null, b: string | null) {
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a || "").localeCompare(String(b || ""));
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function rowKeyForSeat(seat: Seat) {
  return `${seat.section || ""}|${seat.row_label || ""}`;
}

function rowVisualUnits(rowSeats: Seat[]) {
  return rowSeats.length + rowSeats.filter((seat) => seat.aisle_after).length * 2;
}

function getDefaultGuestData(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
    tableName: "",
  };
}

function colourForTicketType(
  ticketType: TicketType | undefined,
  ticketTypes: TicketType[],
) {
  if (!ticketType) {
    return {
      background: "#dcfce7",
      text: "#14532d",
      label: "Normal public seat",
    };
  }

  const index = Math.max(
    0,
    ticketTypes.findIndex((item) => item.id === ticketType.id),
  );

  return {
    ...specialColours[index % specialColours.length],
    label: ticketType.name,
  };
}

function publicSeatStyle({
  selected,
  ticketType,
  ticketTypes,
  status,
}: {
  selected: boolean;
  ticketType: TicketType | undefined;
  ticketTypes: TicketType[];
  status: string;
}): CSSProperties {
  const colour = colourForTicketType(ticketType, ticketTypes);

  const base: CSSProperties = {
    minWidth: 36,
    width: 36,
    height: 36,
    borderRadius: 10,
    fontSize: 12,
    fontWeight: 900,
    padding: 0,
    boxSizing: "border-box",
  };

  if (status === "blocked") {
    return {
      ...base,
      border: selected ? "1px solid #0284c7" : "1px solid #64748b",
      background: selected ? "#bae6fd" : "#334155",
      color: selected ? "#082f49" : "#e2e8f0",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      cursor: "not-allowed",
      opacity: 0.9,
    };
  }

  if (status === "sold") {
    return {
      ...base,
      border: selected ? "1px solid #0284c7" : "1px solid #991b1b",
      background: selected ? "#bae6fd" : "#fecaca",
      color: selected ? "#082f49" : "#7f1d1d",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      cursor: "not-allowed",
      opacity: 0.9,
    };
  }

  if (status === "reserved") {
    return {
      ...base,
      border: selected ? "1px solid #0284c7" : "1px solid #f59e0b",
      background: selected ? "#bae6fd" : "#fef3c7",
      color: selected ? "#082f49" : "#92400e",
      boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
      cursor: "not-allowed",
      opacity: 0.9,
    };
  }

  return {
    ...base,
    border: selected ? "1px solid #0284c7" : "1px solid #cbd5e1",
    background: selected ? "#bae6fd" : colour.background,
    color: selected ? "#082f49" : colour.text,
    boxShadow: selected ? "0 0 0 3px rgba(14,165,233,0.35)" : "none",
    cursor: "pointer",
  };
}
function statusLabel(status: string) {
  if (status === "reserved") return "Reserved";
  if (status === "sold") return "Sold";
  if (status === "blocked") return "Blocked";
  return "Available";
}

function seatHoverLabel(
  seat: Seat,
  ticketType: TicketType | undefined,
  currency: string,
) {
  const priceLine = ticketType
    ? `${ticketType.name} — ${currency} ${moneyFromCents(ticketType.price)}`
    : "Ticket price unavailable";

  return `${seatLabel(seat)}
${priceLine}
Status: ${statusLabel(seat.status)}`;
}

function scrollToSelectorTarget(id: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function getVisibleRowEntries<T extends { rowKey: string }>(
  rowEntries: T[],
  activeIndex: number,
) {
  if (rowEntries.length <= 12) {
    return rowEntries;
  }

  const windowSize = 7;
  const sideCount = Math.floor(windowSize / 2);
  const start = Math.max(
    0,
    Math.min(
      activeIndex - sideCount,
      Math.max(0, rowEntries.length - windowSize),
    ),
  );
  const end = Math.min(rowEntries.length, start + windowSize);

  return rowEntries.slice(start, end);
}

export default function PublicReservedSeatSelector({
  eventId,
  seats,
  ticketTypes,
  currency,
  platformFeePercent = 0,
  menuOptions = [],
  checkoutAddOns = [],
}: {
  eventId: string;
  eventType?: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  platformFeePercent?: number;
  menuOptions?: string[];
  initialSeatingLayout?: Record<string, unknown> | null;
  checkoutAddOns?: PublicEventCheckoutAddOn[];
}) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
  const [selectedRowKey, setSelectedRowKey] = useState("");
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>(
    {},
  );
  const [addOnBuyerAnswers, setAddOnBuyerAnswers] = useState<
    Record<string, string>
  >({});
  const [addOnPlayers, setAddOnPlayers] = useState<
    Record<string, PublicEventCheckoutAddOnPlayer[]>
  >({});
  const [coverFees, setCoverFees] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const cleanedAccessCode = cleanAccessCode(accessCode);
  const hasAccessCode = cleanedAccessCode.length > 0;

  const selectedSeatIds = cartItems.map((item) => item.seatId);

  const publicSeats = useMemo(
    () =>
      seats
        .filter((seat) => seat.row_label || seat.seat_number || seat.section)
        .slice()
        .sort((a, b) => {
          const sectionSort = String(a.section || "").localeCompare(
            String(b.section || ""),
          );

          if (sectionSort !== 0) return sectionSort;

          const rowSort = numericSort(a.row_label, b.row_label);

          if (rowSort !== 0) return rowSort;

          return numericSort(a.seat_number, b.seat_number);
        }),
    [seats],
  );

  const rowEntries = useMemo<RowEntry[]>(() => {
    const grouped = groupBy(publicSeats, rowKeyForSeat);

    return Object.entries(grouped)
      .map(([rowKey, rowSeats]) => {
        const sortedSeats = rowSeats.slice().sort((a, b) => {
          return numericSort(a.seat_number, b.seat_number);
        });

        return {
          section: sortedSeats[0]?.section || "General",
          row: sortedSeats[0]?.row_label || "Unassigned",
          rowKey,
          seats: sortedSeats,
          available: sortedSeats.filter((seat) => seat.status === "available")
            .length,
          unavailable: sortedSeats.filter(
            (seat) => seat.status !== "available",
          ).length,
          selected: sortedSeats.filter((seat) =>
            selectedSeatIds.includes(seat.id),
          ).length,
        };
      })
      .sort((a, b) => {
        const sectionSort = a.section.localeCompare(b.section);

        if (sectionSort !== 0) return sectionSort;

        return numericSort(a.row, b.row);
      });
  }, [publicSeats, selectedSeatIds]);

  const activeRow =
    rowEntries.find((row) => row.rowKey === selectedRowKey) ||
    rowEntries[0] ||
    null;

  const resolvedActiveRowIndex = activeRow
    ? Math.max(
        0,
        rowEntries.findIndex((row) => row.rowKey === activeRow.rowKey),
      )
    : 0;

  const visibleRowEntries = getVisibleRowEntries(
    rowEntries,
    resolvedActiveRowIndex,
  );

  const isLargeSeatEvent = rowEntries.length > 12;
  const canGoPreviousRow = resolvedActiveRowIndex > 0;
  const canGoNextRow = resolvedActiveRowIndex < rowEntries.length - 1;

  const totalAvailableSeats = rowEntries.reduce(
    (sum, row) => sum + row.available,
    0,
  );

  const selectedSeatLabels = useMemo(() => {
    return cartItems
      .map((item) => seats.find((seat) => seat.id === item.seatId))
      .filter(Boolean)
      .map((seat) => seatLabel(seat as Seat));
  }, [cartItems, seats]);

  const cartSeats = useMemo(() => {
    return cartItems
      .map((item) => {
        const seat = seats.find((currentSeat) => currentSeat.id === item.seatId);
        const ticketType = ticketTypes.find(
          (currentTicketType) => currentTicketType.id === item.ticketTypeId,
        );

        if (!seat || !ticketType) return null;

        return {
          seat,
          ticketType,
        };
      })
      .filter(Boolean) as { seat: Seat; ticketType: TicketType }[];
  }, [cartItems, seats, ticketTypes]);

  const hasSeatSelection = cartItems.length > 0;
  const addOnsLocked = hasAccessCode || !hasSeatSelection;

  const addOnLockedTitle = hasAccessCode
    ? "Add-ons are not used with access-code bookings"
    : "Choose at least one seat first";

  const addOnLockedReason = hasAccessCode
    ? "VIP and complimentary access-code bookings do not collect paid event add-ons at checkout."
    : "Event add-ons are linked to your booking. Select a seat first, then you can add extras such as Heads or Tails or Higher or Lower.";

  const safeAddOnQuantities = normaliseAddOnQuantities({
    checkoutAddOns,
    addOnQuantities,
    hasAccessCode,
    hasSeatSelection,
  });

  const selectedAddOns: PublicEventCheckoutAddOnSelection[] = checkoutAddOns
    .map((addOn) => {
      const quantity = safeAddOnQuantities[addOn.type] || 0;
      const players =
        addOn.type === "higher_or_lower"
          ? normalisePlayerRows({
              quantity,
              players: addOnPlayers[addOn.type],
              buyerName,
              buyerEmail,
            })
          : undefined;

      return {
        type: addOn.type,
        quantity,
        buyerAnswer: cleanAnswer(addOnBuyerAnswers[addOn.type]),
        ...(players ? { players } : {}),
      };
    })
    .filter((addOn) => addOn.quantity > 0);
    const ticketTotal = cartSeats.reduce(
    (sum, item) => sum + Number(item.ticketType.price || 0),
    0,
  );

  const addOnTotal = checkoutAddOns.reduce(
    (sum, addOn) =>
      sum +
      Number(addOn.entryPriceCents || 0) *
        Number(safeAddOnQuantities[addOn.type] || 0),
    0,
  );

  const checkoutSubtotal = ticketTotal + addOnTotal;

  const estimatedCoverFeeCents = calculatePlatformFeeCents(
    checkoutSubtotal,
    platformFeePercent,
  );

  const platformFeeCents =
    coverFees && !hasAccessCode ? estimatedCoverFeeCents : 0;

  const totalTodayCents = hasAccessCode
    ? 0
    : checkoutSubtotal + platformFeeCents;

  const totalAddOnQuantity = selectedAddOns.reduce(
    (sum, addOn) => sum + addOn.quantity,
    0,
  );

  function goToRowByIndex(nextIndex: number) {
    const row = rowEntries[nextIndex];

    if (!row) {
      return;
    }

    setSelectedRowKey(row.rowKey);
  }

  function chooseMobileRow(rowKey: string) {
    setSelectedRowKey(rowKey);
    scrollToSelectorTarget("public-reserved-active-row");
  }

  function updateGuestData(seatId: string, patch: Partial<GuestData>) {
    setGuestData((current) => ({
      ...current,
      [seatId]: {
        ...getDefaultGuestData(),
        ...(current[seatId] || {}),
        ...patch,
      },
    }));
  }

  function updateAddOnQuantity(
    addOn: PublicEventCheckoutAddOn,
    nextQuantity: number,
  ) {
    if (addOnsLocked) {
      setCheckoutError(addOnLockedReason);
      return;
    }

    const quantity = normaliseAddOnQuantity(nextQuantity, addOn);

    setAddOnQuantities((current) => ({
      ...current,
      [addOn.type]: quantity,
    }));

    if (addOn.type === "higher_or_lower") {
      setAddOnPlayers((current) => ({
        ...current,
        [addOn.type]: normalisePlayerRows({
          quantity,
          players: current[addOn.type],
          buyerName,
          buyerEmail,
        }),
      }));
    }

    setCheckoutError("");
  }

  function updateAddOnBuyerAnswer(
    addOn: PublicEventCheckoutAddOn,
    answer: string,
  ) {
    setAddOnBuyerAnswers((current) => ({
      ...current,
      [addOn.type]: answer,
    }));
  }

  function updateAddOnPlayers(
    addOn: PublicEventCheckoutAddOn,
    players: PublicEventCheckoutAddOnPlayer[],
  ) {
    setAddOnPlayers((current) => ({
      ...current,
      [addOn.type]: normalisePlayerRows({
        quantity: safeAddOnQuantities[addOn.type] || 0,
        players,
        buyerName,
        buyerEmail,
      }),
    }));
  }

  function validateAddOnAnswers() {
    if (hasAccessCode) {
      return true;
    }

    for (const addOn of checkoutAddOns) {
      const quantity = safeAddOnQuantities[addOn.type] || 0;

      if (quantity <= 0) {
        continue;
      }

      if (
        addOnNeedsBuyerAnswer(addOn) &&
        !cleanAnswer(addOnBuyerAnswers[addOn.type])
      ) {
        setCheckoutError(
          "Please answer the Higher or Lower skill question before continuing.",
        );
        return false;
      }

      if (addOn.type === "higher_or_lower") {
        const players = normalisePlayerRows({
          quantity,
          players: addOnPlayers[addOn.type],
          buyerName,
          buyerEmail,
        });

        if (players.length !== quantity) {
          setCheckoutError(
            "Please add player details for every Higher or Lower entry.",
          );
          return false;
        }

        const missingPlayer = players.find(
          (player) => !cleanPlayer(player.name) || !cleanPlayer(player.email),
        );

        if (missingPlayer) {
          setCheckoutError(
            "Please enter a name and email for every Higher or Lower player.",
          );
          return false;
        }

        const invalidEmail = players.find(
          (player) => !isValidEmail(player.email),
        );

        if (invalidEmail) {
          setCheckoutError(
            "Please enter a valid email for every Higher or Lower player.",
          );
          return false;
        }
      }
    }

    return true;
  }

  function toggleSeat(seat: Seat) {
    if (seat.status !== "available") return;

    setCartItems((current) => {
      const existing = current.find((item) => item.seatId === seat.id);

      if (existing) {
        return current.filter((item) => item.seatId !== seat.id);
      }

      const ticketTypeId = seat.ticket_type_id || ticketTypes[0]?.id || "";

      if (!ticketTypeId) return current;

      return [...current, { seatId: seat.id, ticketTypeId }];
    });

    setCheckoutError("");
  }

  function updateTicketType(seatId: string, ticketTypeId: string) {
    setCartItems((current) =>
      current.map((item) =>
        item.seatId === seatId ? { ...item, ticketTypeId } : item,
      ),
    );
  }

  function removeSeat(seatId: string) {
    setCartItems((current) => current.filter((item) => item.seatId !== seatId));
    setCheckoutError("");
  }

  async function startCheckout() {
    if (isCheckingOut) return;

    if (!buyerName.trim() || !buyerEmail.trim()) {
      setCheckoutError("Please enter your name and email address.");
      return;
    }

    if (cartItems.length === 0) {
      setCheckoutError("Please select at least one seat.");
      return;
    }

    if (!validateAddOnAnswers()) {
      return;
    }

    setCheckoutError("");
    setIsCheckingOut(true);

    try {
      const response = await fetch("/api/events/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventId,
          buyerName,
          buyerEmail,
          coverFees: hasAccessCode ? false : coverFees,
          platformFeeCents,
          accessCode: cleanedAccessCode || null,
          addOns: selectedAddOns,
          items: cartItems.map((item) => {
            const seat = seats.find(
              (currentSeat) => currentSeat.id === item.seatId,
            );
            const data = guestData[item.seatId] || getDefaultGuestData();

            return {
              seatId: item.seatId,
              ticketTypeId: item.ticketTypeId,
              guestName: data.guestName,
              dietary: data.dietaryRequirements,
              dietaryRequirements: data.dietaryRequirements,
              menuChoice: data.menuChoice,
              tableName: data.tableName || seat?.table_number || "",
            };
          }),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout failed.");
      }

      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Checkout failed.",
      );
      setIsCheckingOut(false);
    }
  }
    return (
    <div className="public-reserved-selector-root" style={styles.root}>
      <style>
        {`
          @media (max-width: 980px) {
            .public-reserved-selector-shell {
              grid-template-columns: 1fr !important;
            }

            .public-reserved-selector-cart {
              position: static !important;
            }

            .public-reserved-selector-cart-grid,
            .public-reserved-selector-picker-header,
            .public-reserved-selector-active-summary,
            .public-reserved-selector-nav-row {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 620px) {
            .public-reserved-selector-shell {
              gap: 12px !important;
            }

            .public-reserved-selector-map-panel,
            .public-reserved-selector-cart {
              padding: 12px !important;
              border-radius: 20px !important;
            }

            .public-reserved-selector-map-title,
            .public-reserved-selector-cart-title {
              font-size: 24px !important;
            }

            .public-reserved-selector-workflow-guide {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
              padding: 12px !important;
            }

            .public-reserved-selector-workflow-badge {
              width: fit-content !important;
            }

            .public-reserved-selector-map-header {
              display: none !important;
            }

            .public-reserved-selector-mobile-row-cards {
              display: grid !important;
            }

            .public-reserved-selector-desktop-row-picker {
              display: none !important;
            }

            .public-reserved-selector-active-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 8px !important;
            }

            .public-reserved-selector-seat-scroll {
              padding: 10px !important;
              border-radius: 16px !important;
              overflow-x: hidden !important;
              overflow-y: visible !important;
            }

            .public-reserved-selector-row-card {
              width: 100% !important;
              min-width: 0 !important;
              padding: 12px !important;
              border-radius: 18px !important;
              overflow: hidden !important;
            }

            .public-reserved-selector-desktop-seat-row {
              display: none !important;
            }

            .public-reserved-selector-mobile-seat-panel {
              display: grid !important;
            }

            .public-reserved-selector-mobile-seat-grid {
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }

            .public-reserved-selector-mobile-seat-button {
              min-height: 54px !important;
              min-width: 0 !important;
              width: 100% !important;
              height: auto !important;
              border-radius: 16px !important;
              font-size: 15px !important;
            }

            .public-reserved-selector-helper-notice {
              display: none !important;
            }

            .public-reserved-selector-mobile-summary {
              display: flex !important;
              position: sticky !important;
              bottom: 10px !important;
              z-index: 20 !important;
            }

            .public-reserved-selector-mobile-locked-details {
              display: none !important;
            }

            .public-reserved-selector-cart {
              padding-bottom: 14px !important;
            }

            .public-reserved-selector-cart-item {
              padding: 12px !important;
              border-radius: 16px !important;
            }

            .public-reserved-selector-cart-item-header {
              flex-direction: column !important;
              gap: 8px !important;
            }

            .public-reserved-selector-remove-button {
              width: 100% !important;
              min-height: 40px !important;
              border-radius: 999px !important;
              background: rgba(254,202,202,0.12) !important;
              border: 1px solid rgba(254,202,202,0.22) !important;
            }

            .public-reserved-selector-checkout {
              border-radius: 18px !important;
              min-height: 52px !important;
            }
          }
        `}
      </style>

      <div className="public-reserved-selector-shell" style={styles.shell}>
        <div
          className="public-reserved-selector-map-panel"
          style={styles.mapPanel}
        >
          <div
            className="public-reserved-selector-workflow-guide"
            style={styles.workflowGuide}
          >
            <span
              className="public-reserved-selector-workflow-badge"
              style={styles.workflowBadge}
            >
              Step 1
            </span>
            <div>
              <h3 style={styles.workflowTitle}>Choose your row first</h3>
              <p style={styles.workflowText}>
                Pick a row, then choose available seats. Guest details, optional
                extras and checkout appear once your seat choice has started.
              </p>
            </div>
          </div>

          <div
            className="public-reserved-selector-map-header"
            style={styles.mapHeader}
          >
            <div>
              <h3
                className="public-reserved-selector-map-title"
                style={styles.mapTitle}
              >
                Seat plan
              </h3>
              <p style={styles.mapText}>
                Choose a row, then select available seats from that row.
              </p>
            </div>

            <div style={styles.legend}>
              <SeatLegend color="#dcfce7" label="Available" />
              <SeatLegend color="#bae6fd" label="Selected" />
              <SeatLegend color="#334155" label="Blocked" />
              <SeatLegend color="#fef3c7" label="Reserved" />
              <SeatLegend color="#fecaca" label="Sold" />
            </div>
          </div>

          {rowEntries.length === 0 || !activeRow ? (
            <div style={styles.emptyLight}>
              <strong>No reserved seats available yet</strong>
              <p>Seats may not have been released yet.</p>
            </div>
          ) : (
            <>
              <section
                className="public-reserved-selector-mobile-row-cards"
                style={styles.mobileRowCards}
              >
                <div style={styles.mobileRowCardsHeader}>
                  <span style={styles.mobileStepPill}>Choose a row</span>
                  <strong style={styles.mobileRowCardsTitle}>
                    {totalAvailableSeats} seat
                    {totalAvailableSeats === 1 ? "" : "s"} available
                  </strong>
                </div>

                <div style={styles.mobileRowCardGrid}>
                  {rowEntries.map((row, index) => {
                    const active = row.rowKey === activeRow.rowKey;
                    const isSoldOut = row.available === 0;

                    return (
                      <button
                        key={row.rowKey}
                        type="button"
                        onClick={() => chooseMobileRow(row.rowKey)}
                        style={{
                          ...styles.mobileRowCard,
                          ...(active ? styles.mobileRowCardActive : {}),
                          opacity: isSoldOut && !active ? 0.68 : 1,
                        }}
                      >
                        <span style={styles.mobileRowCardKicker}>
                          Row {index + 1}
                        </span>
                        <strong style={styles.mobileRowCardTitle}>
                          {row.section} · Row {row.row}
                        </strong>
                        <span style={styles.mobileRowCardMeta}>
                          {row.available > 0
                            ? `${row.available} available`
                            : "Sold out / unavailable"}
                        </span>
                        {row.selected > 0 ? (
                          <span style={styles.mobileRowCardSelected}>
                            {row.selected} selected
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div
                className="public-reserved-selector-seat-scroll"
                style={styles.seatScroll}
              >
                <div style={styles.singleRowStack}>
                  <section
                    className="public-reserved-selector-desktop-row-picker"
                    style={styles.rowPicker}
                  >
                    <div
                      className="public-reserved-selector-picker-header"
                      style={styles.rowPickerHeader}
                    >
                      <div>
                        <p style={styles.rowPickerEyebrow}>Choose row</p>
                        <h4 style={styles.rowPickerTitle}>
                          {activeRow.section} · Row {activeRow.row}
                        </h4>
                        <p style={styles.rowPickerText}>
                          Showing one row at a time. Seats already selected from
                          other rows remain in your booking summary.
                        </p>
                      </div>

                      <label style={styles.rowSelectWrap}>
                        <span style={styles.labelDark}>Current row</span>
                        <select
                          className="public-reserved-selector-row-select"
                          value={activeRow.rowKey}
                          onChange={(event) =>
                            setSelectedRowKey(event.target.value)
                          }
                          style={styles.rowSelect}
                        >
                          {rowEntries.map((row, index) => (
                            <option key={row.rowKey} value={row.rowKey}>
                              Row {index + 1} of {rowEntries.length} ·{" "}
                              {row.section} · Row {row.row} ·{" "}
                              {row.seats.length} seats
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div
                      className="public-reserved-selector-nav-row"
                      style={styles.rowNavRow}
                    >
                      <button
                        type="button"
                        className="public-reserved-selector-nav-button"
                        onClick={() =>
                          goToRowByIndex(resolvedActiveRowIndex - 1)
                        }
                        disabled={!canGoPreviousRow}
                        style={{
                          ...styles.rowNavButton,
                          opacity: canGoPreviousRow ? 1 : 0.45,
                          cursor: canGoPreviousRow
                            ? "pointer"
                            : "not-allowed",
                        }}
                      >
                        ← Previous row
                      </button>

                      <div
                        className="public-reserved-selector-position-card"
                        style={styles.rowPositionCard}
                      >
                        <span style={styles.rowPositionLabel}>
                          {isLargeSeatEvent ? "Large seat event" : "Row"}
                        </span>
                        <strong style={styles.rowPositionValue}>
                          Row {resolvedActiveRowIndex + 1} of{" "}
                          {rowEntries.length}
                        </strong>
                        <span style={styles.rowPositionHint}>
                          {isLargeSeatEvent
                            ? "Use the dropdown for direct access to any row."
                            : "Use the row shortcuts below."}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="public-reserved-selector-nav-button"
                        onClick={() =>
                          goToRowByIndex(resolvedActiveRowIndex + 1)
                        }
                        disabled={!canGoNextRow}
                        style={{
                          ...styles.rowNavButton,
                          opacity: canGoNextRow ? 1 : 0.45,
                          cursor: canGoNextRow ? "pointer" : "not-allowed",
                        }}
                      >
                        Next row →
                      </button>
                    </div>
                                        <div
                      className="public-reserved-selector-row-pills"
                      style={styles.rowPills}
                    >
                      {isLargeSeatEvent ? (
                        <span style={styles.windowedPillsLabel}>
                          Nearby rows
                        </span>
                      ) : null}

                      {visibleRowEntries.map((row) => {
                        const active = row.rowKey === activeRow.rowKey;

                        return (
                          <button
                            key={row.rowKey}
                            type="button"
                            className="public-reserved-selector-row-pill"
                            onClick={() => setSelectedRowKey(row.rowKey)}
                            style={{
                              ...styles.rowPill,
                              ...(active ? styles.rowPillActive : {}),
                            }}
                          >
                            <span>{row.row}</span>
                            {row.selected > 0 ? (
                              <strong style={styles.rowPillBadge}>
                                {row.selected}
                              </strong>
                            ) : null}
                          </button>
                        );
                      })}

                      {isLargeSeatEvent ? (
                        <span style={styles.windowedPillsHint}>
                          Showing {visibleRowEntries.length} of{" "}
                          {rowEntries.length}
                        </span>
                      ) : null}
                    </div>
                  </section>

                  <div
                    className="public-reserved-selector-active-summary"
                    style={styles.activeSummary}
                  >
                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Seats</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeRow.seats.length}
                      </strong>
                    </div>

                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Available</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeRow.available}
                      </strong>
                    </div>

                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Unavailable</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeRow.unavailable}
                      </strong>
                    </div>

                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Selected</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeRow.selected}
                      </strong>
                    </div>
                  </div>

                  <section
                    id="public-reserved-active-row"
                    className="public-reserved-selector-row-card"
                    style={styles.rowCard}
                  >
                    <div style={styles.rowHeader}>
                      <div>
                        <h4 style={styles.rowTitle}>
                          {activeRow.section} · Row {activeRow.row}
                        </h4>
                        <p style={styles.rowMeta}>
                          {activeRow.seats.length} seat
                          {activeRow.seats.length === 1 ? "" : "s"} •{" "}
                          {activeRow.available} available
                        </p>
                      </div>
                    </div>

                    <div
                      className="public-reserved-selector-desktop-seat-row"
                      style={styles.desktopSeatRowWrap}
                    >
                      <div
                        style={{
                          ...styles.desktopSeatRow,
                          minWidth: Math.max(
                            420,
                            rowVisualUnits(activeRow.seats) * 42,
                          ),
                        }}
                      >
                        <span style={styles.rowLabelPlate}>
                          Row {activeRow.row}
                        </span>

                        {activeRow.seats.map((seat, index) => {
                          const selected = selectedSeatIds.includes(seat.id);
                          const ticketType = ticketTypes.find(
                            (item) => item.id === seat.ticket_type_id,
                          );

                          return (
                            <span key={seat.id} style={styles.seatWithAisle}>
                              <button
                                type="button"
                                onClick={() => toggleSeat(seat)}
                                disabled={seat.status !== "available"}
                                title={seatHoverLabel(
                                  seat,
                                  ticketType,
                                  currency,
                                )}
                                style={publicSeatStyle({
                                  selected,
                                  ticketType,
                                  ticketTypes,
                                  status: seat.status,
                                })}
                              >
                                {seat.seat_number || index + 1}
                              </button>

                              {seat.aisle_after ? (
                                <span
                                  aria-hidden="true"
                                  style={styles.aisleGap}
                                />
                              ) : null}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <section
                      className="public-reserved-selector-mobile-seat-panel"
                      style={styles.mobileSeatPanel}
                    >
                      <div style={styles.mobileSeatPanelHeader}>
                        <span style={styles.mobileStepPill}>Choose seats</span>
                        <strong style={styles.mobileSeatPanelTitle}>
                          {activeRow.section} · Row {activeRow.row}
                        </strong>
                        <span style={styles.mobileSeatPanelText}>
                          Tap available seats to add or remove them from your
                          booking.
                        </span>
                      </div>

                      <div
                        className="public-reserved-selector-mobile-seat-grid"
                        style={styles.mobileSeatGrid}
                      >
                        {activeRow.seats.map((seat, index) => {
                          const selected = selectedSeatIds.includes(seat.id);
                          const ticketType = ticketTypes.find(
                            (item) => item.id === seat.ticket_type_id,
                          );

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              className="public-reserved-selector-mobile-seat-button"
                              onClick={() => toggleSeat(seat)}
                              disabled={seat.status !== "available"}
                              title={seatHoverLabel(seat, ticketType, currency)}
                              style={{
                                ...styles.mobileSeatButton,
                                ...publicSeatStyle({
                                  selected,
                                  ticketType,
                                  ticketTypes,
                                  status: seat.status,
                                }),
                                minWidth: 0,
                                width: "100%",
                                height: "auto",
                              }}
                            >
                              <span style={styles.mobileSeatButtonLabel}>
                                Seat
                              </span>
                              <strong style={styles.mobileSeatButtonValue}>
                                {seat.seat_number || index + 1}
                              </strong>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </section>
                </div>
              </div>
            </>
          )}

          <div
            className="public-reserved-selector-helper-notice"
            style={styles.helperNotice}
          >
            <span style={styles.helperIcon}>ⓘ</span>
            Use the row selector above to switch between rows. On smaller
            screens, the row list appears first so you can choose seats with
            fewer distractions.
          </div>

          <div
            className="public-reserved-selector-mobile-summary"
            style={styles.mobileSummary}
          >
            <div style={styles.mobileSummaryText}>
              <span style={styles.mobileSummaryLabel}>
                {cartSeats.length} seat{cartSeats.length === 1 ? "" : "s"}{" "}
                selected
              </span>
              <strong style={styles.mobileSummaryTotal}>
                {currency} {moneyFromCents(checkoutSubtotal)}
              </strong>
            </div>

            <button
              type="button"
              onClick={() =>
                scrollToSelectorTarget("public-reserved-booking-details")
              }
              disabled={cartSeats.length === 0}
              style={{
                ...styles.mobileSummaryButton,
                opacity: cartSeats.length === 0 ? 0.55 : 1,
                cursor: cartSeats.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              Continue
            </button>
          </div>
        </div>

        <aside
          id="public-reserved-booking-details"
          className="public-reserved-selector-cart"
          style={styles.cart}
        >
          {!hasSeatSelection ? (
            <div style={styles.mobileBeforeDetailsNotice}>
              <span style={styles.mobileStepPill}>Next step</span>
              <strong style={styles.mobileBeforeDetailsTitle}>
                Choose at least one seat first
              </strong>
              <span style={styles.mobileBeforeDetailsText}>
                Guest details, optional extras and checkout will unlock after a
                seat is selected.
              </span>
            </div>
          ) : null}

          <div
            className={
              hasSeatSelection
                ? "public-reserved-selector-cart-grid"
                : "public-reserved-selector-cart-grid public-reserved-selector-mobile-locked-details"
            }
            style={styles.cartGrid}
          >
            <div>
              <BuyerDetailsFields
                buyerName={buyerName}
                buyerEmail={buyerEmail}
                onBuyerNameChange={setBuyerName}
                onBuyerEmailChange={setBuyerEmail}
                dark
              />

              <div style={styles.summarySpacer} />

              <label style={styles.accessCodeBox}>
                <span style={styles.accessCodeLabel}>
                  VIP / complimentary code
                </span>
                <input
                  value={accessCode}
                  onChange={(event) => {
                    setAccessCode(event.target.value);
                    setCheckoutError("");
                  }}
                  placeholder="Enter access code"
                  style={styles.accessCodeInput}
                />
                <small style={styles.accessCodeHelp}>
                  Use this for VIP, sponsor, staff or complimentary bookings.
                  Codes are validated securely before booking.
                </small>
              </label>
                            {checkoutAddOns.length > 0 ? (
                <>
                  <div style={styles.summarySpacer} />

                  <div style={styles.addOnWorkflowBox}>
                    <span style={styles.addOnWorkflowBadge}>Step 3</span>
                    <strong style={styles.addOnWorkflowTitle}>
                      Add event extras
                    </strong>
                    <span style={styles.addOnWorkflowText}>
                      Heads or Tails and Higher or Lower entries can be added
                      once your seat selection is started.
                    </span>
                  </div>

                  <div style={styles.addOnStack}>
                    {checkoutAddOns.map((addOn) => (
                      <PublicEventCheckoutAddOnSelector
                        key={addOn.type}
                        addOn={addOn}
                        currency={currency}
                        quantity={safeAddOnQuantities[addOn.type] || 0}
                        buyerAnswer={addOnBuyerAnswers[addOn.type] || ""}
                        buyerName={buyerName}
                        buyerEmail={buyerEmail}
                        players={addOnPlayers[addOn.type] || []}
                        disabled={addOnsLocked}
                        disabledTitle={addOnLockedTitle}
                        disabledReason={addOnLockedReason}
                        onQuantityChange={(nextQuantity) =>
                          updateAddOnQuantity(addOn, nextQuantity)
                        }
                        onBuyerAnswerChange={(answer) =>
                          updateAddOnBuyerAnswer(addOn, answer)
                        }
                        onPlayersChange={(players) =>
                          updateAddOnPlayers(addOn, players)
                        }
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div>
              <div style={styles.cartTop}>
                <div>
                  <p style={styles.cartEyebrow}>Booking summary</p>
                  <h3
                    className="public-reserved-selector-cart-title"
                    style={styles.cartTitle}
                  >
                    Your seats
                  </h3>
                </div>

                <div style={styles.countBadge}>{cartSeats.length}</div>
              </div>

              {cartSeats.length === 0 ? (
                <div style={styles.emptyBox}>
                  <img
                    src={TICKET_PLACEHOLDER_IMAGE}
                    alt="SO ticket"
                    style={styles.emptyTicketImage}
                  />

                  <p style={styles.emptyTitle}>Select seats to begin</p>
                  <p style={styles.emptyText}>
                    Your selected seats and guest details will appear here.
                    Event add-ons unlock after you choose at least one seat.
                  </p>
                </div>
              ) : (
                <>
                  <div style={styles.selectedSeatRibbon}>
                    <span style={styles.selectedSeatRibbonLabel}>
                      Selected seats
                    </span>
                    <strong style={styles.selectedSeatRibbonText}>
                      {selectedSeatLabels.slice(0, 2).join(" • ")}
                      {selectedSeatLabels.length > 2
                        ? ` • +${selectedSeatLabels.length - 2} more`
                        : ""}
                    </strong>
                  </div>

                  <div style={styles.cartList}>
                    {cartSeats.map(({ seat, ticketType }) => {
                      const data = guestData[seat.id] || getDefaultGuestData();
                      const availableTicketTypes = seat.ticket_type_id
                        ? ticketTypes.filter(
                            (currentTicketType) =>
                              currentTicketType.id === seat.ticket_type_id,
                          )
                        : ticketTypes;

                      return (
                        <div
                          key={seat.id}
                          className="public-reserved-selector-cart-item"
                          style={styles.cartItem}
                        >
                          <div
                            className="public-reserved-selector-cart-item-header"
                            style={styles.cartItemHeader}
                          >
                            <div>
                              <p style={styles.cartSeatLabel}>
                                {seatLabel(seat)}
                              </p>
                              <p style={styles.cartPrice}>
                                {currency} {moneyFromCents(ticketType.price)}
                              </p>
                            </div>

                            <button
                              type="button"
                              className="public-reserved-selector-remove-button"
                              onClick={() => removeSeat(seat.id)}
                              style={styles.removeButton}
                            >
                              Remove
                            </button>
                          </div>

                          <label style={styles.field}>
                            <span style={styles.label}>Ticket type</span>
                            <select
                              value={ticketType.id}
                              onChange={(event) =>
                                updateTicketType(seat.id, event.target.value)
                              }
                              disabled={Boolean(seat.ticket_type_id)}
                              style={styles.input}
                            >
                              {availableTicketTypes.map((currentTicketType) => (
                                <option
                                  key={currentTicketType.id}
                                  value={currentTicketType.id}
                                >
                                  {currentTicketType.name} — {currency}{" "}
                                  {moneyFromCents(currentTicketType.price)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>Guest name</span>
                            <input
                              value={data.guestName}
                              onChange={(event) =>
                                updateGuestData(seat.id, {
                                  guestName: event.target.value,
                                })
                              }
                              placeholder="Guest name"
                              style={styles.input}
                            />
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>
                              Dietary requirements
                            </span>
                            <textarea
                              value={data.dietaryRequirements}
                              onChange={(event) =>
                                updateGuestData(seat.id, {
                                  dietaryRequirements: event.target.value,
                                })
                              }
                              placeholder="None, vegetarian, gluten free, allergies..."
                              rows={2}
                              style={styles.textarea}
                            />
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>Menu choice</span>
                            {menuOptions.length > 0 ? (
                              <select
                                value={data.menuChoice}
                                onChange={(event) =>
                                  updateGuestData(seat.id, {
                                    menuChoice: event.target.value,
                                  })
                                }
                                style={styles.input}
                              >
                                <option value="">Select menu option</option>
                                {menuOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                value={data.menuChoice}
                                onChange={(event) =>
                                  updateGuestData(seat.id, {
                                    menuChoice: event.target.value,
                                  })
                                }
                                placeholder="Optional menu choice"
                                style={styles.input}
                              />
                            )}
                          </label>

                          <label style={styles.field}>
                            <span style={styles.label}>
                              Table, group or note
                            </span>
                            <input
                              value={data.tableName}
                              onChange={(event) =>
                                updateGuestData(seat.id, {
                                  tableName: event.target.value,
                                })
                              }
                              placeholder="Optional"
                              style={styles.input}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div style={styles.totalBox}>
                <span>
                  Ticket total
                  {totalAddOnQuantity > 0
                    ? ` • ${totalAddOnQuantity} add-on entr${
                        totalAddOnQuantity === 1 ? "y" : "ies"
                      }`
                    : ""}
                </span>
                <strong>
                  {currency} {moneyFromCents(checkoutSubtotal)}
                </strong>
              </div>

              {checkoutAddOns.map((addOn) => {
                const quantity = safeAddOnQuantities[addOn.type] || 0;

                if (quantity <= 0) {
                  return null;
                }

                return (
                  <div key={addOn.type} style={styles.addOnSummaryRow}>
                    <span>
                      {addOn.title || "Event add-on"} × {quantity}
                    </span>
                    <strong>
                      {currency}{" "}
                      {moneyFromCents(
                        Number(addOn.entryPriceCents || 0) * quantity,
                      )}
                    </strong>
                  </div>
                );
              })}

              {hasAccessCode ? (
                <div style={styles.accessCodeNotice}>
                  <strong>Access code entered.</strong>
                  <span>
                    If valid, this booking will complete without Stripe payment.
                  </span>
                </div>
              ) : (
                <label style={styles.feeBox}>
                  <input
                    type="checkbox"
                    checked={coverFees}
                    onChange={(event) => setCoverFees(event.target.checked)}
                    disabled={checkoutSubtotal <= 0}
                  />
                  <span>
                    <strong>
                      I’d like to cover platform and payment costs
                    </strong>
                    <small style={styles.feeSmall}>
                      Adds approximately {currency}{" "}
                      {moneyFromCents(estimatedCoverFeeCents)} so the organiser
                      receives the full ticket value.
                    </small>
                  </span>
                </label>
              )}

              <div
                style={
                  hasAccessCode
                    ? styles.totalBoxComplimentary
                    : styles.totalBoxStrong
                }
              >
                <span>
                  {hasAccessCode ? "Due after valid code" : "Total today"}
                </span>
                <strong>
                  {currency} {moneyFromCents(totalTodayCents)}
                </strong>
              </div>

              {checkoutError ? (
                <div style={styles.errorBox}>{checkoutError}</div>
              ) : null}

              <button
                type="button"
                className="public-reserved-selector-checkout"
                onClick={startCheckout}
                disabled={cartSeats.length === 0 || isCheckingOut}
                style={{
                  ...styles.checkout,
                  opacity: cartSeats.length === 0 || isCheckingOut ? 0.55 : 1,
                  cursor:
                    cartSeats.length === 0 || isCheckingOut
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {isCheckingOut
                  ? "Processing..."
                  : hasAccessCode
                    ? "Validate code and book"
                    : "Continue to checkout"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SeatLegend({ color, label }: { color: string; label: string }) {
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      {label}
    </span>
  );
}
const styles: Record<string, CSSProperties> = {
  root: {
    width: "100%",
    minWidth: 0,
  },

  shell: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(340px, 0.8fr)",
    gap: 18,
    alignItems: "start",
    width: "100%",
    minWidth: 0,
  },

  mapPanel: {
    padding: "clamp(14px, 4vw, 18px)",
    borderRadius: 24,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "hidden",
  },

  workflowGuide: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    background: "linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)",
    border: "1px solid #bfdbfe",
  },

  workflowBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    whiteSpace: "nowrap",
  },

  workflowTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
  },

  workflowText: {
    margin: "5px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  mapHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  mapTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "clamp(24px, 5vw, 30px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    fontWeight: 950,
  },

  mapText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 700,
  },

  legend: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  legendItem: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    padding: "7px 9px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.14)",
  },

  emptyLight: {
    display: "grid",
    gap: 8,
    padding: 18,
    borderRadius: 18,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
    textAlign: "center",
  },

  mobileRowCards: {
    display: "none",
    gap: 12,
    marginBottom: 12,
  },

  mobileRowCardsHeader: {
    display: "grid",
    gap: 6,
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  mobileStepPill: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    padding: "0 10px",
    borderRadius: 999,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  mobileRowCardsTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.15,
    letterSpacing: "-0.025em",
    fontWeight: 950,
  },

  mobileRowCardGrid: {
    display: "grid",
    gap: 10,
  },

  mobileRowCard: {
    display: "grid",
    gap: 5,
    width: "100%",
    padding: 14,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#0f172a",
    textAlign: "left",
    boxShadow: "0 10px 24px rgba(15,23,42,0.06)",
  },

  mobileRowCardActive: {
    borderColor: "#1683f8",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 78%)",
    boxShadow: "0 12px 28px rgba(22,131,248,0.14)",
  },

  mobileRowCardKicker: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  mobileRowCardTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  mobileRowCardMeta: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 850,
  },

  mobileRowCardSelected: {
    display: "inline-flex",
    width: "fit-content",
    marginTop: 2,
    padding: "6px 9px",
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    fontSize: 11,
    fontWeight: 950,
  },

  seatScroll: {
    width: "100%",
    overflowX: "auto",
    overflowY: "visible",
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  singleRowStack: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  rowPicker: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    minWidth: 0,
  },

  rowPickerHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.36fr)",
    gap: 12,
    alignItems: "end",
    minWidth: 0,
  },

  rowPickerEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  rowPickerTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "clamp(22px, 5vw, 28px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  rowPickerText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  rowSelectWrap: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  labelDark: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },

  rowSelect: {
    width: "100%",
    minHeight: 42,
    padding: "9px 10px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 850,
    boxSizing: "border-box",
  },

  rowNavRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 0.25fr) minmax(220px, 0.5fr) minmax(0, 0.25fr)",
    gap: 10,
    alignItems: "stretch",
  },

  rowNavButton: {
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 950,
    padding: "10px 12px",
    boxShadow: "0 8px 18px rgba(37,99,235,0.08)",
  },

  rowPositionCard: {
    display: "grid",
    gap: 4,
    alignContent: "center",
    padding: 12,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    minWidth: 0,
    textAlign: "center",
  },

  rowPositionLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  rowPositionValue: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.15,
    fontWeight: 950,
  },

  rowPositionHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
  },

  rowPills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  windowedPillsLabel: {
    display: "inline-flex",
    width: "100%",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  windowedPillsHint: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 38,
    padding: "0 10px",
    borderRadius: 999,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },

  rowPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 44,
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  rowPillActive: {
    borderColor: "#1683f8",
    background: "#1683f8",
    color: "#ffffff",
    boxShadow: "0 10px 20px rgba(22,131,248,0.16)",
  },

  rowPillBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    background: "rgba(255,255,255,0.22)",
    color: "inherit",
    fontSize: 11,
    fontWeight: 950,
  },

  activeSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },

  activeSummaryCard: {
    display: "grid",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  activeSummaryLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  activeSummaryValue: {
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 950,
  },

  rowCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
    overflow: "visible",
    scrollMarginTop: 16,
  },

  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  rowTitle: {
    margin: 0,
    color: "#111827",
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.02em",
    overflowWrap: "break-word",
  },

  rowMeta: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 800,
  },

  desktopSeatRowWrap: {
    display: "block",
    overflowX: "auto",
    overflowY: "visible",
    padding: 10,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  desktopSeatRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "fit-content",
    padding: 12,
    borderRadius: 14,
    background:
      "linear-gradient(135deg, rgba(22,131,248,0.05), rgba(255,255,255,1))",
  },

  rowLabelPlate: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#fef3c7",
    fontSize: 12,
    fontWeight: 950,
    marginRight: 4,
    whiteSpace: "nowrap",
  },

  seatWithAisle: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  aisleGap: {
    display: "inline-flex",
    width: 30,
    height: 36,
    borderRadius: 10,
    background:
      "repeating-linear-gradient(45deg, #e2e8f0 0, #e2e8f0 4px, #f8fafc 4px, #f8fafc 8px)",
    border: "1px dashed #cbd5e1",
  },

  mobileSeatPanel: {
    display: "none",
    gap: 12,
  },

  mobileSeatPanelHeader: {
    display: "grid",
    gap: 6,
  },

  mobileSeatPanelTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  mobileSeatPanelText: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 750,
  },

  mobileSeatGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 8,
  },

  mobileSeatButton: {
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 1,
    minHeight: 50,
    borderRadius: 16,
    boxSizing: "border-box",
  },

  mobileSeatButtonLabel: {
    fontSize: 9,
    lineHeight: 1,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 950,
    opacity: 0.78,
  },

  mobileSeatButtonValue: {
    fontSize: 16,
    lineHeight: 1.05,
    fontWeight: 950,
  },

  helperNotice: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    background: "#eff6ff",
    color: "#1e3a8a",
    border: "1px solid #bfdbfe",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 800,
  },

  helperIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 950,
    flexShrink: 0,
  },

  mobileSummary: {
    display: "none",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    width: "100%",
    marginTop: 12,
    padding: 10,
    borderRadius: 20,
    background: "rgba(15,23,42,0.94)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 40px rgba(15,23,42,0.26)",
    backdropFilter: "blur(14px)",
  },

  mobileSummaryText: {
    display: "grid",
    gap: 2,
    minWidth: 0,
  },

  mobileSummaryLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: 900,
  },

  mobileSummaryTotal: {
    color: "#fef3c7",
    fontSize: 17,
    lineHeight: 1.1,
    fontWeight: 950,
  },

  mobileSummaryButton: {
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 999,
    border: "none",
    background: "#1683f8",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 950,
    flexShrink: 0,
  },

  cart: {
    position: "sticky",
    top: 18,
    padding: "clamp(14px, 4vw, 18px)",
    borderRadius: 24,
    background: "#111827",
    color: "#ffffff",
    boxShadow: "0 18px 45px rgba(15,23,42,0.24)",
    minWidth: 0,
    scrollMarginTop: 16,
  },

  cartGrid: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  mobileBeforeDetailsNotice: {
    display: "grid",
    gap: 7,
    marginBottom: 14,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  mobileBeforeDetailsTitle: {
    color: "#ffffff",
    fontSize: 17,
    lineHeight: 1.2,
    fontWeight: 950,
  },

  mobileBeforeDetailsText: {
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  summarySpacer: {
    height: 16,
  },

  accessCodeBox: {
    display: "grid",
    gap: 7,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  accessCodeLabel: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  accessCodeInput: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 850,
    boxSizing: "border-box",
    textTransform: "uppercase",
  },

  accessCodeHelp: {
    color: "#cbd5e1",
    lineHeight: 1.4,
    fontSize: 12,
    fontWeight: 750,
  },

  addOnWorkflowBox: {
    display: "grid",
    gap: 6,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    background: "rgba(250,204,21,0.12)",
    border: "1px solid rgba(250,204,21,0.22)",
  },

  addOnWorkflowBadge: {
    display: "inline-flex",
    width: "fit-content",
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(250,204,21,0.18)",
    color: "#fde68a",
    border: "1px solid rgba(250,204,21,0.24)",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  addOnWorkflowTitle: {
    color: "#ffffff",
    fontSize: 15,
    lineHeight: 1.25,
    fontWeight: 950,
  },

  addOnWorkflowText: {
    color: "#dbeafe",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 800,
  },

  addOnStack: {
    display: "grid",
    gap: 12,
  },

  cartTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },

  cartEyebrow: {
    margin: 0,
    color: "#facc15",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
  },

  cartTitle: {
    margin: "5px 0 0",
    fontSize: "clamp(23px, 5vw, 28px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    fontWeight: 950,
  },

  countBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
    height: 42,
    borderRadius: 999,
    background: "rgba(250,204,21,0.16)",
    color: "#fde68a",
    border: "1px solid rgba(250,204,21,0.24)",
    fontWeight: 950,
  },

  emptyBox: {
    display: "grid",
    justifyItems: "center",
    gap: 8,
    padding: 18,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.05)",
    textAlign: "center",
  },

  emptyTicketImage: {
    width: 78,
    height: 78,
    objectFit: "contain",
    opacity: 0.82,
  },

  emptyTitle: {
    margin: 0,
    color: "#ffffff",
    fontWeight: 950,
  },

  emptyText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.45,
  },

  selectedSeatRibbon: {
    display: "grid",
    gap: 4,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    background: "rgba(96,165,250,0.14)",
    border: "1px solid rgba(147,197,253,0.22)",
  },

  selectedSeatRibbonLabel: {
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  selectedSeatRibbonText: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  cartList: {
    display: "grid",
    gap: 12,
  },

  cartItem: {
    display: "grid",
    gap: 11,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  cartItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  cartSeatLabel: {
    margin: 0,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  cartPrice: {
    margin: "5px 0 0",
    color: "#fde68a",
    fontSize: 13,
    fontWeight: 900,
  },

  removeButton: {
    border: "none",
    background: "transparent",
    color: "#fecaca",
    fontWeight: 950,
    cursor: "pointer",
  },

  field: {
    display: "grid",
    gap: 6,
  },

  label: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 900,
  },

  input: {
    width: "100%",
    minHeight: 42,
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
  },

  textarea: {
    width: "100%",
    minHeight: 72,
    padding: "10px 11px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
    resize: "vertical",
  },

  totalBox: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
    padding: 15,
    borderRadius: 18,
    background: "rgba(250,204,21,0.14)",
    color: "#fde68a",
    fontWeight: 950,
    fontSize: 18,
  },

  addOnSummaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    color: "#e2e8f0",
    fontWeight: 850,
  },

  accessCodeNotice: {
    display: "grid",
    gap: 4,
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    background: "rgba(96,165,250,0.16)",
    border: "1px solid rgba(147,197,253,0.2)",
    color: "#dbeafe",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 800,
  },

  feeBox: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#ffffff",
    cursor: "pointer",
    lineHeight: 1.35,
  },

  feeSmall: {
    display: "block",
    marginTop: 4,
    color: "#cbd5e1",
    lineHeight: 1.4,
  },

  totalBoxStrong: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 10,
    padding: 15,
    borderRadius: 18,
    background: "rgba(34,197,94,0.16)",
    color: "#bbf7d0",
    fontWeight: 950,
    fontSize: 18,
    border: "1px solid rgba(187,247,208,0.18)",
  },

  totalBoxComplimentary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 10,
    padding: 15,
    borderRadius: 18,
    background: "rgba(96,165,250,0.18)",
    color: "#bfdbfe",
    fontWeight: 950,
    fontSize: 18,
    border: "1px solid rgba(147,197,253,0.22)",
  },

  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 900,
  },

  checkout: {
    marginTop: 14,
    width: "100%",
    padding: 15,
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    fontSize: 15,
    boxShadow: "0 16px 30px rgba(22,131,248,0.25)",
  },
};
