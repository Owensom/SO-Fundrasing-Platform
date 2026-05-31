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
  table_name?: string | null;
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
};

type TableShape = "round" | "square" | "rectangle";

type SeatingLayoutJson = Record<string, unknown>;

const TICKET_PLACEHOLDER_IMAGE = "/brand/so-ticket-placeholder.png";
const STRIPE_STANDARD_UK_PERCENT = 0.015;
const STRIPE_STANDARD_UK_FIXED_CENTS = 20;

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
}) {
  if (input.hasAccessCode) {
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

function tableSortValue(value: string | null | undefined) {
  const number = Number(value);
  if (Number.isFinite(number)) return number;
  return Number.MAX_SAFE_INTEGER;
}

function normaliseShape(value: unknown): TableShape | null {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "round" || raw === "circle" || raw === "circular") return "round";
  if (raw === "square") return "square";
  if (raw === "rectangle" || raw === "rectangular" || raw === "long") {
    return "rectangle";
  }

  return null;
}

function readShapeFromObject(
  value: unknown,
  tableNumber: string,
  tableLabel: string,
): TableShape | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const objectValue = value as Record<string, unknown>;

  return (
    normaliseShape(objectValue[tableNumber]) ||
    normaliseShape(objectValue[tableLabel]) ||
    normaliseShape(objectValue[`Table ${tableNumber}`]) ||
    normaliseShape(objectValue.shape) ||
    normaliseShape(objectValue.tableShape) ||
    normaliseShape(objectValue.table_shape)
  );
}

function getTableShapeForGroup({
  seatingLayoutJson,
  tableNumber,
  tableLabel,
}: {
  seatingLayoutJson?: SeatingLayoutJson | null;
  tableNumber: string;
  tableLabel: string;
  seatCount: number;
}): TableShape {
  const layout = seatingLayoutJson || {};

  const directShape =
    normaliseShape(layout[`tableShape:${tableNumber}`]) ||
    normaliseShape(layout[`table_shape:${tableNumber}`]) ||
    normaliseShape(layout[`table:${tableNumber}:shape`]) ||
    normaliseShape(layout[`tableShape:${tableLabel}`]) ||
    normaliseShape(layout[`table_shape:${tableLabel}`]);

  if (directShape) return directShape;

  const mappedShape =
    readShapeFromObject(layout.tableShapes, tableNumber, tableLabel) ||
    readShapeFromObject(layout.table_shapes, tableNumber, tableLabel) ||
    readShapeFromObject(layout.tableLayouts, tableNumber, tableLabel) ||
    readShapeFromObject(layout.table_layouts, tableNumber, tableLabel) ||
    readShapeFromObject(layout.tables, tableNumber, tableLabel);

  if (mappedShape) return mappedShape;

  const globalShape =
    normaliseShape(layout.tableShape) || normaliseShape(layout.table_shape);

  if (globalShape) return globalShape;

  return "round";
}

function seatLabel(seat: Seat) {
  const tableLabel = seat.table_name
    ? seat.table_name
    : `Table ${seat.table_number || "Unassigned"}`;

  return `${tableLabel}, Seat ${seat.seat_number || "?"}`;
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

function groupLabel(seat: Seat) {
  if (seat.table_name) return seat.table_name;
  return `Table ${seat.table_number || "Unassigned"}`;
}

function sortSeatNumber(a: Seat, b: Seat) {
  const aNumber = Number(a.seat_number);
  const bNumber = Number(b.seat_number);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return String(a.seat_number || "").localeCompare(String(b.seat_number || ""));
}

function getDefaultGuest(): GuestData {
  return {
    guestName: "",
    dietaryRequirements: "",
    menuChoice: "",
  };
}

function seatColours(status: string, selected: boolean) {
  if (selected) {
    return {
      background: "#2563eb",
      color: "#ffffff",
      border: "2px solid #93c5fd",
      opacity: 1,
      boxShadow: "0 12px 26px rgba(37,99,235,0.32)",
    };
  }

  if (status === "reserved") {
    return {
      background: "#f59e0b",
      color: "#451a03",
      border: "2px solid #fbbf24",
      opacity: 0.92,
      boxShadow: "0 10px 18px rgba(245,158,11,0.18)",
    };
  }

  if (status === "sold") {
    return {
      background: "#ef4444",
      color: "#ffffff",
      border: "2px solid #f87171",
      opacity: 0.92,
      boxShadow: "0 10px 18px rgba(239,68,68,0.18)",
    };
  }

  if (status === "blocked") {
    return {
      background: "#64748b",
      color: "#ffffff",
      border: "2px solid #94a3b8",
      opacity: 0.72,
      boxShadow: "none",
    };
  }

  return {
    background: "#16a34a",
    color: "#ffffff",
    border: "2px solid #86efac",
    opacity: 1,
    boxShadow: "0 10px 18px rgba(22,163,74,0.18)",
  };
}

function roundSeatPosition(index: number, total: number) {
  const angle = -90 + (360 / Math.max(total, 1)) * index;
  const radians = (angle * Math.PI) / 180;
  const radius = 106;

  return {
    position: "absolute" as const,
    left: `calc(50% + ${Math.cos(radians) * radius}px)`,
    top: `calc(50% + ${Math.sin(radians) * radius}px)`,
    transform: "translate(-50%, -50%)",
  };
}

function rectangleSeatCounts(total: number) {
  if (total <= 2) return { top: total, right: 0, bottom: 0, left: 0 };

  if (total <= 4) {
    return {
      top: Math.ceil(total / 2),
      right: 0,
      bottom: Math.floor(total / 2),
      left: 0,
    };
  }

  const endSeats = total >= 6 ? 2 : 0;
  const sideSeats = Math.max(0, total - endSeats);

  return {
    top: Math.ceil(sideSeats / 2),
    right: endSeats >= 1 ? 1 : 0,
    bottom: Math.floor(sideSeats / 2),
    left: endSeats >= 2 ? 1 : 0,
  };
}

function squareSeatCounts(total: number) {
  const top = Math.ceil(total / 4);
  const right = Math.ceil((total - top) / 3);
  const bottom = Math.ceil((total - top - right) / 2);
  const left = Math.max(0, total - top - right - bottom);

  return { top, right, bottom, left };
}

function edgeSeatPosition(index: number, total: number, shape: TableShape) {
  const width = shape === "rectangle" ? 500 : 360;
  const height = shape === "rectangle" ? 300 : 360;
  const tableTop = shape === "rectangle" ? 88 : 76;
  const tableBottom = height - tableTop;
  const tableLeft = shape === "rectangle" ? 92 : 76;
  const tableRight = width - tableLeft;

  const counts =
    shape === "rectangle" ? rectangleSeatCounts(total) : squareSeatCounts(total);

  if (index < counts.top) {
    const position = (index + 1) / (counts.top + 1);

    return {
      position: "absolute" as const,
      left: tableLeft + position * (tableRight - tableLeft),
      top: tableTop - 42,
      transform: "translate(-50%, -50%)",
    };
  }

  if (index < counts.top + counts.right) {
    const sideIndex = index - counts.top;
    const position = (sideIndex + 1) / (counts.right + 1);

    return {
      position: "absolute" as const,
      left: tableRight + 48,
      top: tableTop + position * (tableBottom - tableTop),
      transform: "translate(-50%, -50%)",
    };
  }

  if (index < counts.top + counts.right + counts.bottom) {
    const bottomIndex = index - counts.top - counts.right;
    const position = (bottomIndex + 1) / (counts.bottom + 1);

    return {
      position: "absolute" as const,
      left: tableRight - position * (tableRight - tableLeft),
      top: tableBottom + 42,
      transform: "translate(-50%, -50%)",
    };
  }

  const leftIndex = index - counts.top - counts.right - counts.bottom;
  const position = (leftIndex + 1) / (Math.max(counts.left, 1) + 1);

  return {
    position: "absolute" as const,
    left: tableLeft - 48,
    top: tableBottom - position * (tableBottom - tableTop),
    transform: "translate(-50%, -50%)",
  };
}

function seatPosition(index: number, total: number, shape: TableShape) {
  if (shape === "round") return roundSeatPosition(index, total);
  return edgeSeatPosition(index, total, shape);
}

function tableAreaStyle(shape: TableShape): CSSProperties {
  if (shape === "square") {
    return {
      ...styles.tableArea,
      width: 360,
      height: 360,
      borderRadius: 34,
    };
  }

  if (shape === "rectangle") {
    return {
      ...styles.tableArea,
      width: 500,
      height: 300,
      borderRadius: 34,
    };
  }

  return {
    ...styles.tableArea,
    width: 304,
    height: 304,
    borderRadius: 999,
  };
}

function tablePlateStyle(shape: TableShape): CSSProperties {
  if (shape === "square") {
    return {
      ...styles.tablePlate,
      width: 164,
      height: 164,
      borderRadius: 30,
    };
  }

  if (shape === "rectangle") {
    return {
      ...styles.tablePlate,
      width: 288,
      height: 122,
      borderRadius: 30,
    };
  }

  return {
    ...styles.tablePlate,
    width: 142,
    height: 142,
    borderRadius: 999,
  };
}

export default function PublicTableSelector({
  eventId,
  seats,
  ticketTypes,
  currency,
  platformFeePercent = 0,
  menuOptions = [],
  seatingLayoutJson = {},
  checkoutAddOns = [],
}: {
  eventId: string;
  seats: Seat[];
  ticketTypes: TicketType[];
  currency: string;
  platformFeePercent?: number;
  menuOptions?: string[];
  seatingLayoutJson?: SeatingLayoutJson;
  checkoutAddOns?: PublicEventCheckoutAddOn[];
}) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestData, setGuestData] = useState<Record<string, GuestData>>({});
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

  const tableSeats = useMemo(
    () => seats.filter((seat) => seat.table_number),
    [seats],
  );

  const groupedTables = useMemo(() => {
    return tableSeats.reduce<Record<string, Seat[]>>((groups, seat) => {
      const key = seat.table_number || "Unassigned";
      groups[key] = groups[key] || [];
      groups[key].push(seat);
      return groups;
    }, {});
  }, [tableSeats]);

  const tableEntries = useMemo(() => {
    return Object.entries(groupedTables)
      .sort(([a], [b]) => {
        const aSort = tableSortValue(a);
        const bSort = tableSortValue(b);

        if (aSort !== bSort) return aSort - bSort;
        return a.localeCompare(b);
      })
      .map(([tableNumber, currentSeats]) => {
        const sortedSeats = currentSeats.slice().sort(sortSeatNumber);
        const tableLabel = groupLabel(sortedSeats[0]);

        return {
          tableNumber,
          tableLabel,
          seats: sortedSeats,
          shape: getTableShapeForGroup({
            seatingLayoutJson,
            tableNumber,
            tableLabel,
            seatCount: sortedSeats.length,
          }),
        };
      });
  }, [groupedTables, seatingLayoutJson]);

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

  const safeAddOnQuantities = normaliseAddOnQuantities({
    checkoutAddOns,
    addOnQuantities,
    hasAccessCode,
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

  function updateGuestData(seatId: string, patch: Partial<GuestData>) {
    setGuestData((current) => ({
      ...current,
      [seatId]: {
        ...getDefaultGuest(),
        ...(current[seatId] || {}),
        ...patch,
      },
    }));
  }

  function updateAddOnQuantity(
    addOn: PublicEventCheckoutAddOn,
    nextQuantity: number,
  ) {
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
            const data = guestData[item.seatId] || getDefaultGuest();

            return {
              seatId: item.seatId,
              ticketTypeId: item.ticketTypeId,
              guestName: data.guestName,
              dietary: data.dietaryRequirements,
              dietaryRequirements: data.dietaryRequirements,
              menuChoice: data.menuChoice,
              tableName: seat?.table_name || "",
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
    <>
      <style>
        {`
          @media (max-width: 980px) {
            .public-table-selector-shell {
              grid-template-columns: 1fr !important;
            }

            .public-table-selector-cart {
              position: static !important;
            }

            .public-table-selector-cart-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 620px) {
            .public-table-selector-map-panel,
            .public-table-selector-cart {
              padding: 12px !important;
              border-radius: 20px !important;
            }

            .public-table-selector-map-title,
            .public-table-selector-cart-title {
              font-size: 24px !important;
            }

            .public-table-selector-table-scroll {
              padding: 10px !important;
              border-radius: 14px !important;
            }

            .public-table-selector-table-card {
              padding: 12px !important;
              border-radius: 18px !important;
            }

            .public-table-selector-table-area {
              transform: scale(0.82);
              transform-origin: top center;
              margin-bottom: -52px !important;
            }
          }
        `}
      </style>

      <div className="public-table-selector-shell" style={styles.shell}>
        <div className="public-table-selector-map-panel" style={styles.mapPanel}>
          <div style={styles.mapHeader}>
            <div>
              <h3 className="public-table-selector-map-title" style={styles.mapTitle}>
                Table plan
              </h3>
              <p style={styles.mapText}>
                Choose available seats from the table layout below.
              </p>
            </div>

            <div style={styles.legend}>
              <Legend color="#16a34a" label="Available" />
              <Legend color="#2563eb" label="Selected" />
              <Legend color="#64748b" label="Blocked" />
              <Legend color="#f59e0b" label="Reserved" />
              <Legend color="#ef4444" label="Sold" />
            </div>
          </div>

          <div className="public-table-selector-table-scroll" style={styles.tableScroll}>
            {tableEntries.length === 0 ? (
              <div style={styles.emptyLight}>
                <strong>No table seats available yet</strong>
                <p>Tables may not have been released yet.</p>
              </div>
            ) : (
              <div style={styles.tableGrid}>
                {tableEntries.map((table) => (
                  <section
                    key={table.tableNumber}
                    className="public-table-selector-table-card"
                    style={styles.tableCard}
                  >
                    <div style={styles.tableHeader}>
                      <div>
                        <h4 style={styles.tableTitle}>{table.tableLabel}</h4>
                        <p style={styles.tableMeta}>
                          {table.seats.length} seat
                          {table.seats.length === 1 ? "" : "s"} •{" "}
                          {table.shape === "round"
                            ? "Round"
                            : table.shape === "square"
                              ? "Square"
                              : "Rectangle"}{" "}
                          table
                        </p>
                      </div>
                    </div>

                    <div
                      className="public-table-selector-table-area"
                      style={tableAreaStyle(table.shape)}
                    >
                      <div style={tablePlateStyle(table.shape)}>
                        <span style={styles.tablePlateLabel}>
                          {table.tableLabel}
                        </span>
                      </div>

                      {table.seats.map((seat, index) => {
                        const selected = selectedSeatIds.includes(seat.id);
                        const colours = seatColours(seat.status, selected);
                        const ticketType = ticketTypes.find(
                          (item) => item.id === seat.ticket_type_id,
                        );

                        return (
                          <button
                            key={seat.id}
                            type="button"
                            onClick={() => toggleSeat(seat)}
                            disabled={seat.status !== "available"}
                            title={seatHoverLabel(seat, ticketType, currency)}
                            style={{
                              ...styles.tableSeat,
                              ...seatPosition(
                                index,
                                table.seats.length,
                                table.shape,
                              ),
                              ...colours,
                            }}
                          >
                            {seat.seat_number || index + 1}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <div style={styles.helperNotice}>
            <span style={styles.helperIcon}>ⓘ</span>
            On smaller screens, swipe across the table plan to view all seats.
          </div>
        </div>

        <aside className="public-table-selector-cart" style={styles.cart}>
          <div className="public-table-selector-cart-grid" style={styles.cartGrid}>
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
                <span style={styles.accessCodeLabel}>VIP / complimentary code</span>
                <input
                  value={accessCode}
                  onChange={(event) => setAccessCode(event.target.value)}
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
                        disabled={hasAccessCode}
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
                  <h3 className="public-table-selector-cart-title" style={styles.cartTitle}>
                    Your table seats
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
                    Your selected table seats and guest details will appear here.
                  </p>
                </div>
              ) : (
                <div style={styles.cartList}>
                  {cartSeats.map(({ seat, ticketType }) => {
                    const data = guestData[seat.id] || getDefaultGuest();
                    const availableTicketTypes = seat.ticket_type_id
                      ? ticketTypes.filter(
                          (currentTicketType) =>
                            currentTicketType.id === seat.ticket_type_id,
                        )
                      : ticketTypes;

                    return (
                      <div key={seat.id} style={styles.cartItem}>
                        <div style={styles.cartItemHeader}>
                          <div>
                            <p style={styles.cartSeatLabel}>{seatLabel(seat)}</p>
                            <p style={styles.cartPrice}>
                              {currency} {moneyFromCents(ticketType.price)}
                            </p>
                          </div>

                          <button
                            type="button"
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
                          <span style={styles.label}>Dietary requirements</span>
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
                      </div>
                    );
                  })}
                </div>
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
                    <strong>I’d like to cover platform and payment costs</strong>
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
                <span>{hasAccessCode ? "Due after valid code" : "Total today"}</span>
                <strong>
                  {currency} {moneyFromCents(totalTodayCents)}
                </strong>
              </div>

              {checkoutError ? (
                <div style={styles.errorBox}>{checkoutError}</div>
              ) : null}

              <button
                type="button"
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
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      {label}
    </span>
  );
}
