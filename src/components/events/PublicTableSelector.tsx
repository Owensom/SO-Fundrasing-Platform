"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
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

type TableEntry = {
  tableNumber: string;
  tableLabel: string;
  seats: Seat[];
  shape: TableShape;
};

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

function getVisibleTableEntries<T extends { tableNumber: string }>(
  tableEntries: T[],
  activeIndex: number,
) {
  if (tableEntries.length <= 12) {
    return tableEntries;
  }

  const windowSize = 7;
  const sideCount = Math.floor(windowSize / 2);
  const start = Math.max(
    0,
    Math.min(
      activeIndex - sideCount,
      Math.max(0, tableEntries.length - windowSize),
    ),
  );
  const end = Math.min(tableEntries.length, start + windowSize);

  return tableEntries.slice(start, end);
}

function getTableSeatCounts(table: TableEntry, selectedSeatIds: string[]) {
  const total = table.seats.length;
  const available = table.seats.filter(
    (seat) => seat.status === "available",
  ).length;
  const unavailable = table.seats.filter(
    (seat) => seat.status !== "available",
  ).length;
  const selected = table.seats.filter((seat) =>
    selectedSeatIds.includes(seat.id),
  ).length;

  return {
    total,
    available,
    unavailable,
    selected,
  };
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
  const [selectedTableNumber, setSelectedTableNumber] = useState("");
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

  const tableEntries = useMemo<TableEntry[]>(() => {
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
    const activeTable =
    tableEntries.find((table) => table.tableNumber === selectedTableNumber) ||
    tableEntries[0] ||
    null;

  const resolvedActiveTableIndex = activeTable
    ? Math.max(
        0,
        tableEntries.findIndex(
          (table) => table.tableNumber === activeTable.tableNumber,
        ),
      )
    : 0;

  const visibleTableEntries = getVisibleTableEntries(
    tableEntries,
    resolvedActiveTableIndex,
  );

  const isLargeTableEvent = tableEntries.length > 12;
  const canGoPreviousTable = resolvedActiveTableIndex > 0;
  const canGoNextTable = resolvedActiveTableIndex < tableEntries.length - 1;

  const activeTableCounts = activeTable
    ? getTableSeatCounts(activeTable, selectedSeatIds)
    : {
        total: 0,
        available: 0,
        unavailable: 0,
        selected: 0,
      };

  const overallAvailableSeats = tableEntries.reduce(
    (sum, table) =>
      sum + table.seats.filter((seat) => seat.status === "available").length,
    0,
  );

  const selectedTableLabels = useMemo(() => {
    return cartItems
      .map((item) => seats.find((seat) => seat.id === item.seatId))
      .filter(Boolean)
      .map((seat) => seatLabel(seat as Seat));
  }, [cartItems, seats]);

  useEffect(() => {
    if (tableEntries.length === 0) {
      if (selectedTableNumber) {
        setSelectedTableNumber("");
      }

      return;
    }

    const stillExists = tableEntries.some(
      (table) => table.tableNumber === selectedTableNumber,
    );

    if (!selectedTableNumber || !stillExists) {
      setSelectedTableNumber(tableEntries[0].tableNumber);
    }
  }, [selectedTableNumber, tableEntries]);

  function goToTableByIndex(nextIndex: number) {
    const table = tableEntries[nextIndex];

    if (!table) {
      return;
    }

    setSelectedTableNumber(table.tableNumber);
  }

  function chooseMobileTable(tableNumber: string) {
    setSelectedTableNumber(tableNumber);
    scrollToSelectorTarget("public-table-active-plan");
  }

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
    : "Choose at least one table seat first";

  const addOnLockedReason = hasAccessCode
    ? "VIP and complimentary access-code bookings do not collect paid event add-ons at checkout."
    : "Event add-ons are linked to your booking. Select a table seat first, then you can add extras such as Heads or Tails or Higher or Lower.";

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
    <div className="public-table-selector-root" style={styles.root}>
      <style>
        {`
          @media (max-width: 980px) {
            .public-table-selector-shell {
              grid-template-columns: 1fr !important;
            }

            .public-table-selector-cart {
              position: static !important;
            }

            .public-table-selector-cart-grid,
            .public-table-selector-picker-header,
            .public-table-selector-active-summary,
            .public-table-selector-nav-row {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 620px) {
            .public-table-selector-shell {
              gap: 12px !important;
            }

            .public-table-selector-map-panel,
            .public-table-selector-cart {
              padding: 12px !important;
              border-radius: 20px !important;
            }

            .public-table-selector-map-title,
            .public-table-selector-cart-title {
              font-size: 24px !important;
            }

            .public-table-selector-workflow-guide {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
              padding: 12px !important;
            }

            .public-table-selector-workflow-badge {
              width: fit-content !important;
            }

            .public-table-selector-map-header {
              display: none !important;
            }

            .public-table-selector-mobile-table-cards {
              display: grid !important;
            }

            .public-table-selector-desktop-table-picker {
              display: none !important;
            }

            .public-table-selector-active-summary {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 8px !important;
            }

            .public-table-selector-table-scroll {
              padding: 10px !important;
              border-radius: 16px !important;
              overflow-x: hidden !important;
              overflow-y: visible !important;
            }

            .public-table-selector-table-card {
              width: 100% !important;
              min-width: 0 !important;
              padding: 12px !important;
              border-radius: 18px !important;
              overflow: hidden !important;
            }

            .public-table-selector-desktop-table-plan {
              display: none !important;
            }

            .public-table-selector-mobile-seat-panel {
              display: grid !important;
            }

            .public-table-selector-mobile-seat-grid {
              grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            }

            .public-table-selector-mobile-seat-button {
              min-height: 54px !important;
              min-width: 0 !important;
              width: 100% !important;
              height: auto !important;
              border-radius: 16px !important;
              font-size: 15px !important;
            }

            .public-table-selector-helper-notice {
              display: none !important;
            }

            .public-table-selector-mobile-summary {
              display: flex !important;
              position: sticky !important;
              bottom: 10px !important;
              z-index: 20 !important;
            }

            .public-table-selector-mobile-locked-details {
              display: none !important;
            }

            .public-table-selector-cart {
              padding-bottom: 14px !important;
            }

            .public-table-selector-cart-item {
              padding: 12px !important;
              border-radius: 16px !important;
            }

            .public-table-selector-cart-item-header {
              flex-direction: column !important;
              gap: 8px !important;
            }

            .public-table-selector-remove-button {
              width: 100% !important;
              min-height: 40px !important;
              border-radius: 999px !important;
              background: rgba(254,202,202,0.12) !important;
              border: 1px solid rgba(254,202,202,0.22) !important;
            }

            .public-table-selector-checkout {
              border-radius: 18px !important;
              min-height: 52px !important;
            }
          }
        `}
      </style>

      <div className="public-table-selector-shell" style={styles.shell}>
        <div
          className="public-table-selector-map-panel"
          style={styles.mapPanel}
        >
          <div
            className="public-table-selector-workflow-guide"
            style={styles.workflowGuide}
          >
            <span
              className="public-table-selector-workflow-badge"
              style={styles.workflowBadge}
            >
              Step 1
            </span>
            <div>
              <h3 style={styles.workflowTitle}>Choose your table first</h3>
              <p style={styles.workflowText}>
                Pick a table, then choose available seats. Guest details,
                optional extras and checkout appear once your seat choice has
                started.
              </p>
            </div>
          </div>

          <div
            className="public-table-selector-map-header"
            style={styles.mapHeader}
          >
            <div>
              <h3
                className="public-table-selector-map-title"
                style={styles.mapTitle}
              >
                Table plan
              </h3>
              <p style={styles.mapText}>
                Choose a table, then select available seats from that table.
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

          {tableEntries.length === 0 || !activeTable ? (
            <div style={styles.emptyLight}>
              <strong>No table seats available yet</strong>
              <p>Tables may not have been released yet.</p>
            </div>
          ) : (
            <>
              <section
                className="public-table-selector-mobile-table-cards"
                style={styles.mobileTableCards}
              >
                <div style={styles.mobileTableCardsHeader}>
                  <span style={styles.mobileStepPill}>Choose a table</span>
                  <strong style={styles.mobileTableCardsTitle}>
                    {overallAvailableSeats} seat
                    {overallAvailableSeats === 1 ? "" : "s"} available
                  </strong>
                </div>

                <div style={styles.mobileTableCardGrid}>
                  {tableEntries.map((table, index) => {
                    const counts = getTableSeatCounts(table, selectedSeatIds);
                    const active =
                      table.tableNumber === activeTable.tableNumber;
                    const isSoldOut = counts.available === 0;

                    return (
                      <button
                        key={table.tableNumber}
                        type="button"
                        onClick={() => chooseMobileTable(table.tableNumber)}
                        style={{
                          ...styles.mobileTableCard,
                          ...(active ? styles.mobileTableCardActive : {}),
                          opacity: isSoldOut && !active ? 0.68 : 1,
                        }}
                      >
                        <span style={styles.mobileTableCardKicker}>
                          Table {index + 1}
                        </span>
                        <strong style={styles.mobileTableCardTitle}>
                          {table.tableLabel}
                        </strong>
                        <span style={styles.mobileTableCardMeta}>
                          {counts.available > 0
                            ? `${counts.available} available`
                            : "Sold out / unavailable"}
                        </span>
                        {counts.selected > 0 ? (
                          <span style={styles.mobileTableCardSelected}>
                            {counts.selected} selected
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div
                className="public-table-selector-table-scroll"
                style={styles.tableScroll}
              >
                <div style={styles.singleTableStack}>
                  <section
                    className="public-table-selector-desktop-table-picker"
                    style={styles.tablePicker}
                  >
                    <div
                      className="public-table-selector-picker-header"
                      style={styles.tablePickerHeader}
                    >
                      <div>
                        <p style={styles.tablePickerEyebrow}>Choose table</p>
                        <h4 style={styles.tablePickerTitle}>
                          {activeTable.tableLabel}
                        </h4>
                        <p style={styles.tablePickerText}>
                          Showing one table at a time. Seats already selected
                          from other tables remain in your booking summary.
                        </p>
                      </div>

                      <label style={styles.tableSelectWrap}>
                        <span style={styles.labelDark}>Current table</span>
                        <select
                          className="public-table-selector-table-select"
                          value={activeTable.tableNumber}
                          onChange={(event) =>
                            setSelectedTableNumber(event.target.value)
                          }
                          style={styles.tableSelect}
                        >
                          {tableEntries.map((table, index) => (
                            <option
                              key={table.tableNumber}
                              value={table.tableNumber}
                            >
                              Table {index + 1} of {tableEntries.length} ·{" "}
                              {table.tableLabel} · {table.seats.length} seats
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div
                      className="public-table-selector-nav-row"
                      style={styles.tableNavRow}
                    >
                      <button
                        type="button"
                        className="public-table-selector-nav-button"
                        onClick={() =>
                          goToTableByIndex(resolvedActiveTableIndex - 1)
                        }
                        disabled={!canGoPreviousTable}
                        style={{
                          ...styles.tableNavButton,
                          opacity: canGoPreviousTable ? 1 : 0.45,
                          cursor: canGoPreviousTable
                            ? "pointer"
                            : "not-allowed",
                        }}
                      >
                        ← Previous table
                      </button>

                      <div
                        className="public-table-selector-position-card"
                        style={styles.tablePositionCard}
                      >
                        <span style={styles.tablePositionLabel}>
                          {isLargeTableEvent ? "Large table event" : "Table"}
                        </span>
                        <strong style={styles.tablePositionValue}>
                          Table {resolvedActiveTableIndex + 1} of{" "}
                          {tableEntries.length}
                        </strong>
                        <span style={styles.tablePositionHint}>
                          {isLargeTableEvent
                            ? "Use the dropdown for direct access to any table."
                            : "Use the table shortcuts below."}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="public-table-selector-nav-button"
                        onClick={() =>
                          goToTableByIndex(resolvedActiveTableIndex + 1)
                        }
                        disabled={!canGoNextTable}
                        style={{
                          ...styles.tableNavButton,
                          opacity: canGoNextTable ? 1 : 0.45,
                          cursor: canGoNextTable ? "pointer" : "not-allowed",
                        }}
                      >
                        Next table →
                      </button>
                    </div>

                    <div
                      className="public-table-selector-table-pills"
                      style={styles.tablePills}
                    >
                      {isLargeTableEvent ? (
                        <span style={styles.windowedPillsLabel}>
                          Nearby tables
                        </span>
                      ) : null}

                      {visibleTableEntries.map((table) => {
                        const active =
                          table.tableNumber === activeTable.tableNumber;
                        const counts = getTableSeatCounts(
                          table,
                          selectedSeatIds,
                        );

                        return (
                          <button
                            key={table.tableNumber}
                            type="button"
                            className="public-table-selector-table-pill"
                            onClick={() =>
                              setSelectedTableNumber(table.tableNumber)
                            }
                            style={{
                              ...styles.tablePill,
                              ...(active ? styles.tablePillActive : {}),
                            }}
                          >
                            <span>{table.tableNumber}</span>
                            {counts.selected > 0 ? (
                              <strong style={styles.tablePillBadge}>
                                {counts.selected}
                              </strong>
                            ) : null}
                          </button>
                        );
                      })}

                      {isLargeTableEvent ? (
                        <span style={styles.windowedPillsHint}>
                          Showing {visibleTableEntries.length} of{" "}
                          {tableEntries.length}
                        </span>
                      ) : null}
                    </div>
                  </section>
                                    <div
                    className="public-table-selector-active-summary"
                    style={styles.activeSummary}
                  >
                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Seats</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeTableCounts.total}
                      </strong>
                    </div>

                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Available</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeTableCounts.available}
                      </strong>
                    </div>

                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Unavailable</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeTableCounts.unavailable}
                      </strong>
                    </div>

                    <div style={styles.activeSummaryCard}>
                      <span style={styles.activeSummaryLabel}>Selected</span>
                      <strong style={styles.activeSummaryValue}>
                        {activeTableCounts.selected}
                      </strong>
                    </div>
                  </div>

                  <section
                    id="public-table-active-plan"
                    className="public-table-selector-table-card"
                    style={styles.tableCard}
                  >
                    <div style={styles.tableHeader}>
                      <div>
                        <h4 style={styles.tableTitle}>
                          {activeTable.tableLabel}
                        </h4>
                        <p style={styles.tableMeta}>
                          {activeTable.seats.length} seat
                          {activeTable.seats.length === 1 ? "" : "s"} •{" "}
                          {activeTable.shape === "round"
                            ? "Round"
                            : activeTable.shape === "square"
                              ? "Square"
                              : "Rectangle"}{" "}
                          table
                        </p>
                      </div>
                    </div>

                    <div
                      className="public-table-selector-desktop-table-plan"
                      style={styles.desktopTablePlan}
                    >
                      <div
                        className="public-table-selector-table-area"
                        style={tableAreaStyle(activeTable.shape)}
                      >
                        <div style={tablePlateStyle(activeTable.shape)}>
                          <span style={styles.tablePlateLabel}>
                            {activeTable.tableLabel}
                          </span>
                        </div>

                        {activeTable.seats.map((seat, index) => {
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
                                  activeTable.seats.length,
                                  activeTable.shape,
                                ),
                                ...colours,
                              }}
                            >
                              {seat.seat_number || index + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <section
                      className="public-table-selector-mobile-seat-panel"
                      style={styles.mobileSeatPanel}
                    >
                      <div style={styles.mobileSeatPanelHeader}>
                        <span style={styles.mobileStepPill}>Choose seats</span>
                        <strong style={styles.mobileSeatPanelTitle}>
                          {activeTable.tableLabel}
                        </strong>
                        <span style={styles.mobileSeatPanelText}>
                          Tap available seats to add or remove them from your
                          booking.
                        </span>
                      </div>

                      <div
                        className="public-table-selector-mobile-seat-grid"
                        style={styles.mobileSeatGrid}
                      >
                        {activeTable.seats.map((seat, index) => {
                          const selected = selectedSeatIds.includes(seat.id);
                          const colours = seatColours(seat.status, selected);
                          const ticketType = ticketTypes.find(
                            (item) => item.id === seat.ticket_type_id,
                          );

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              className="public-table-selector-mobile-seat-button"
                              onClick={() => toggleSeat(seat)}
                              disabled={seat.status !== "available"}
                              title={seatHoverLabel(seat, ticketType, currency)}
                              style={{
                                ...styles.mobileSeatButton,
                                ...colours,
                                cursor:
                                  seat.status === "available"
                                    ? "pointer"
                                    : "not-allowed",
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
            className="public-table-selector-helper-notice"
            style={styles.helperNotice}
          >
            <span style={styles.helperIcon}>ⓘ</span>
            Use the table selector above to switch between tables. On smaller
            screens, the table list appears first so you can choose seats with
            fewer distractions.
          </div>

          <div
            className="public-table-selector-mobile-summary"
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
                scrollToSelectorTarget("public-table-booking-details")
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
          id="public-table-booking-details"
          className="public-table-selector-cart"
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
                table seat is selected.
              </span>
            </div>
          ) : null}

          <div
            className={
              hasSeatSelection
                ? "public-table-selector-cart-grid"
                : "public-table-selector-cart-grid public-table-selector-mobile-locked-details"
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
                      once your table seat selection is started.
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
                    className="public-table-selector-cart-title"
                    style={styles.cartTitle}
                  >
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
                    Event add-ons unlock after you choose at least one table
                    seat.
                  </p>
                </div>
              ) : (
                <>
                  <div style={styles.selectedSeatRibbon}>
                    <span style={styles.selectedSeatRibbonLabel}>
                      Selected seats
                    </span>
                    <strong style={styles.selectedSeatRibbonText}>
                      {selectedTableLabels.slice(0, 2).join(" • ")}
                      {selectedTableLabels.length > 2
                        ? ` • +${selectedTableLabels.length - 2} more`
                        : ""}
                    </strong>
                  </div>

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
                        <div
                          key={seat.id}
                          className="public-table-selector-cart-item"
                          style={styles.cartItem}
                        >
                          <div
                            className="public-table-selector-cart-item-header"
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
                              className="public-table-selector-remove-button"
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
                className="public-table-selector-checkout"
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

function Legend({ color, label }: { color: string; label: string }) {
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

  tableScroll: {
    width: "100%",
    overflowX: "auto",
    overflowY: "visible",
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.75)",
  },

  singleTableStack: {
    display: "grid",
    gap: 14,
    minWidth: 0,
  },

  mobileTableCards: {
    display: "none",
    gap: 12,
    marginBottom: 12,
  },

  mobileTableCardsHeader: {
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

  mobileTableCardsTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.15,
    letterSpacing: "-0.025em",
    fontWeight: 950,
  },

  mobileTableCardGrid: {
    display: "grid",
    gap: 10,
  },

  mobileTableCard: {
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

  mobileTableCardActive: {
    borderColor: "#1683f8",
    background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 78%)",
    boxShadow: "0 12px 28px rgba(22,131,248,0.14)",
  },

  mobileTableCardKicker: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  mobileTableCardTitle: {
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  mobileTableCardMeta: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.35,
    fontWeight: 850,
  },

  mobileTableCardSelected: {
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

  tablePicker: {
    display: "grid",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    minWidth: 0,
  },

  tablePickerHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 0.36fr)",
    gap: 12,
    alignItems: "end",
    minWidth: 0,
  },

  tablePickerEyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  tablePickerTitle: {
    margin: 0,
    color: "#111827",
    fontSize: "clamp(22px, 5vw, 28px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  tablePickerText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
    overflowWrap: "anywhere",
  },

  tableSelectWrap: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },

  labelDark: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },

  tableSelect: {
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

  tableNavRow: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 0.25fr) minmax(220px, 0.5fr) minmax(0, 0.25fr)",
    gap: 10,
    alignItems: "stretch",
  },

  tableNavButton: {
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

  tablePositionCard: {
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

  tablePositionLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  tablePositionValue: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 1.15,
    fontWeight: 950,
  },

  tablePositionHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 750,
  },

  tablePills: {
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

  tablePill: {
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

  tablePillActive: {
    borderColor: "#1683f8",
    background: "#1683f8",
    color: "#ffffff",
    boxShadow: "0 10px 20px rgba(22,131,248,0.16)",
  },

  tablePillBadge: {
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

  tableCard: {
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

  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  tableTitle: {
    margin: 0,
    color: "#111827",
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.02em",
    overflowWrap: "break-word",
  },

  tableMeta: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
    fontWeight: 800,
  },

  desktopTablePlan: {
    display: "block",
    minWidth: 0,
    overflow: "visible",
  },

  tableArea: {
    position: "relative",
    margin: "0 auto",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 34%), #ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
    overflow: "visible",
  },

  tablePlate: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #020617 100%)",
    color: "#fef3c7",
    border: "1px solid rgba(250,204,21,0.28)",
    boxShadow: "0 16px 34px rgba(15,23,42,0.18)",
    textAlign: "center",
    padding: 12,
  },

  tablePlateLabel: {
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },

  tableSeat: {
    width: 42,
    height: 42,
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    boxSizing: "border-box",
    zIndex: 2,
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

  summarySpacer: {
    height: 16,
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
