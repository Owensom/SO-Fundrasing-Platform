import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { query } from "@/lib/db";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  canPublishAnotherCampaign,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import {
  createEvent,
  createEventSeat,
  createEventTicketType,
  type EventPrize,
  type EventStatus,
  type EventSubtype,
  type EventType,
} from "../../../../../api/_lib/events-repo";

type TicketTypeInput = {
  id?: string;
  name?: string;
  description?: string;
  price?: string | number;
  capacity?: string | number | null;
  sort_order?: string | number;
  is_active?: boolean;
};

type SeatingConfigInput = {
  section?: string;
  rows?: string;
  seats_per_row?: string | number;
  aisle_after?: string;
  ticket_type_id?: string;
};

type TableConfigInput = {
  table_count?: string | number;
  seats_per_table?: string | number;
  ticket_type_id?: string;
};

type ActiveCampaignCountRow = {
  active_count: string | number;
};

function positiveInteger(
  value: FormDataEntryValue | string | number | null,
  fallback = 0,
) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function cleanImageFocus(value: FormDataEntryValue | null) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function moneyToCents(value: string | number | null | undefined) {
  const number = Number(String(value || "0").replace(",", "."));
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

function cleanEventType(value: FormDataEntryValue | null): EventType {
  const eventType = String(value || "general_admission").trim();

  if (
    eventType === "general_admission" ||
    eventType === "reserved_seating" ||
    eventType === "tables"
  ) {
    return eventType;
  }

  return "general_admission";
}

function cleanEventSubtype(value: FormDataEntryValue | null): EventSubtype {
  const eventSubtype = String(value || "standard").trim();

  if (eventSubtype === "quiz_night") {
    return "quiz_night";
  }

  return "standard";
}

function cleanStatus(value: FormDataEntryValue | null): EventStatus {
  const status = String(value || "draft").trim();

  if (status === "draft" || status === "published" || status === "closed") {
    return status;
  }

  return "draft";
}

function optionalDate(value: FormDataEntryValue | null) {
  const clean = String(value || "").trim();

  if (!clean) return null;

  const date = new Date(clean);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function parseBritishDate(value: FormDataEntryValue | null) {
  const clean = String(value || "").trim();

  if (!clean) return null;

  const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100
  ) {
    return null;
  }

  return {
    day,
    month,
    year,
  };
}

function parseTime(value: FormDataEntryValue | null) {
  const clean = String(value || "").trim();

  if (!clean) return null;

  const match = clean.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
  };
}

function optionalSplitDateTime(
  dateValue: FormDataEntryValue | null,
  timeValue: FormDataEntryValue | null,
  fallbackValue: FormDataEntryValue | null,
) {
  const dateParts = parseBritishDate(dateValue);
  const timeParts = parseTime(timeValue);

  const hasDate = String(dateValue || "").trim().length > 0;
  const hasTime = String(timeValue || "").trim().length > 0;

  if (!hasDate && !hasTime) {
    return optionalDate(fallbackValue);
  }

  if (!dateParts) {
    return null;
  }

  const hour = timeParts?.hour ?? 0;
  const minute = timeParts?.minute ?? 0;

  const date = new Date(
    Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hour, minute),
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== dateParts.year ||
    date.getUTCMonth() !== dateParts.month - 1 ||
    date.getUTCDate() !== dateParts.day
  ) {
    return null;
  }

  return date.toISOString();
}

function parseJsonArray<T>(value: FormDataEntryValue | null): T[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T extends Record<string, unknown>>(
  value: FormDataEntryValue | null,
): T | null {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : null;
  } catch {
    return null;
  }
}

function parseTableNames(value: FormDataEntryValue | null): Record<string, string> {
  const parsed = parseJsonObject<Record<string, unknown>>(value);

  if (!parsed) return {};

  return Object.fromEntries(
    Object.entries(parsed)
      .map(([key, rawValue]) => [String(key), String(rawValue || "").trim()])
      .filter(([, name]) => name),
  );
}

function parseAisleAfterList(value: string | undefined) {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((number) => Number.isFinite(number) && number > 0)
        .map((number) => Math.floor(number)),
    ),
  );
}

function expandRows(value: string): string[] {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const rows: string[] = [];

  for (const part of parts) {
    if (part.includes("-")) {
      const [rawStart, rawEnd] = part.split("-").map((item) => item.trim());

      const startNumber = Number(rawStart);
      const endNumber = Number(rawEnd);

      if (Number.isFinite(startNumber) && Number.isFinite(endNumber)) {
        const start = Math.min(startNumber, endNumber);
        const end = Math.max(startNumber, endNumber);

        for (let row = start; row <= end; row += 1) {
          rows.push(String(row));
        }

        continue;
      }

      if (
        rawStart.length === 1 &&
        rawEnd.length === 1 &&
        /^[A-Za-z]$/.test(rawStart) &&
        /^[A-Za-z]$/.test(rawEnd)
      ) {
        const start = Math.min(
          rawStart.toUpperCase().charCodeAt(0),
          rawEnd.toUpperCase().charCodeAt(0),
        );
        const end = Math.max(
          rawStart.toUpperCase().charCodeAt(0),
          rawEnd.toUpperCase().charCodeAt(0),
        );

        for (let code = start; code <= end; code += 1) {
          rows.push(String.fromCharCode(code));
        }

        continue;
      }
    }

    rows.push(part);
  }

  return Array.from(new Set(rows));
}

function localTicketIdToCreatedId(
  localId: string | undefined,
  ticketTypeIdMap: Map<string, string>,
) {
  if (!localId || localId === "__normal__") return null;
  return ticketTypeIdMap.get(localId) || null;
}

async function getActivePublishedCampaignCountForTenant(tenantSlug: string) {
  const rows = await query<ActiveCampaignCountRow>(
    `
      select count(*)::int as active_count
      from (
        select 1
        from raffles
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from squares_games
        where tenant_slug = $1
          and status = 'published'

        union all

        select 1
        from events
        where tenant_slug = $1
          and status = 'published'
      ) active_campaigns
    `,
    [tenantSlug],
  );

  return Number(rows[0]?.active_count || 0);
}

async function canPublishEventForTenant(tenantSlug: string) {
  const tenantSettings = await getTenantSettings(tenantSlug);
  const subscriptionTier = normaliseSubscriptionTier(
    tenantSettings?.subscription_tier,
  );
  const currentActiveCampaigns =
    await getActivePublishedCampaignCountForTenant(tenantSlug);

  return canPublishAnotherCampaign({
    subscription_tier: subscriptionTier,
    currentActiveCampaigns,
  });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.redirect(new URL("/admin/login", request.url), {
      status: 303,
    });
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
    return NextResponse.redirect(
      new URL("/admin/login?error=tenant_access_denied", request.url),
      { status: 303 },
    );
  }

  const formData = await request.formData();

  const submittedTenantSlug = String(formData.get("tenantSlug") || "").trim();

  if (submittedTenantSlug && submittedTenantSlug !== tenantSlug) {
    return NextResponse.redirect(
      new URL("/admin/login?error=tenant_access_denied", request.url),
      { status: 303 },
    );
  }

  const title = String(formData.get("title") || "").trim();
  const slug = String(formData.get("slug") || "").trim();
  const eventType = cleanEventType(formData.get("event_type"));
  const eventSubtype = cleanEventSubtype(formData.get("event_subtype"));
  const status = cleanStatus(formData.get("status"));

  if (!title || !slug) {
    return NextResponse.redirect(
      new URL("/admin/events/new?error=missing-required", request.url),
      { status: 303 },
    );
  }

  const startsAt = optionalSplitDateTime(
    formData.get("starts_date"),
    formData.get("starts_time"),
    formData.get("starts_at"),
  );

  const endsAt = optionalSplitDateTime(
    formData.get("ends_date"),
    formData.get("ends_time"),
    formData.get("ends_at"),
  );

  const hasInvalidStartDate =
    String(formData.get("starts_date") || "").trim() && !startsAt;

  const hasInvalidEndDate =
    String(formData.get("ends_date") || "").trim() && !endsAt;

  if (hasInvalidStartDate || hasInvalidEndDate) {
    return NextResponse.redirect(
      new URL("/admin/events/new?error=invalid-event-datetime", request.url),
      { status: 303 },
    );
  }

  try {
    if (status === "published" && !(await canPublishEventForTenant(tenantSlug))) {
      return NextResponse.redirect(
        new URL("/admin/events/new?error=campaign-limit", request.url),
        { status: 303 },
      );
    }

    const prizes = parseJsonArray<EventPrize>(formData.get("prizes"));
    const ticketTypes = parseJsonArray<TicketTypeInput>(
      formData.get("ticket_types"),
    );
    const rowSeating = parseJsonObject<SeatingConfigInput>(
      formData.get("row_seating"),
    );
    const tableSeating = parseJsonObject<TableConfigInput>(
      formData.get("table_seating"),
    );
    const tableNamesJson = parseTableNames(formData.get("table_names_json"));

    const event = await createEvent({
      tenantSlug,
      title,
      slug,
      description: String(formData.get("description") || "").trim() || null,
      imageUrl: String(formData.get("image_url") || "").trim() || null,
      imageFocusX: cleanImageFocus(formData.get("image_focus_x")),
      imageFocusY: cleanImageFocus(formData.get("image_focus_y")),
      location: String(formData.get("location") || "").trim() || null,
      startsAt,
      endsAt,
      capacity: positiveInteger(formData.get("capacity"), 0) || null,
      currency: String(formData.get("currency") || "GBP").trim() || "GBP",
      eventType,
      eventSubtype,
      status,
      prizesJson: prizes,
      tableNamesJson,
      seatingLayoutJson: {},
      menuOptions: [],
      askDietaryRequirements: true,
      askMenuChoice: true,
    });

    const ticketTypeIdMap = new Map<string, string>();

    for (const ticketType of ticketTypes) {
      const name = String(ticketType.name || "").trim();
      if (!name) continue;

      const createdTicketType = await createEventTicketType({
        eventId: event.id,
        name,
        description: String(ticketType.description || "").trim() || null,
        price: moneyToCents(ticketType.price),
        capacity: positiveInteger(ticketType.capacity ?? null, 0) || null,
        sortOrder: positiveInteger(ticketType.sort_order ?? 0, 0),
        isActive: ticketType.is_active !== false,
      });

      if (ticketType.id) {
        ticketTypeIdMap.set(String(ticketType.id), createdTicketType.id);
      }
    }

    if (eventType === "reserved_seating" && rowSeating) {
      const rowsRaw = String(rowSeating.rows || "").trim();
      const seatsPerRow = positiveInteger(rowSeating.seats_per_row ?? null, 0);
      const section = String(rowSeating.section || "").trim();
      const aisleAfterList = parseAisleAfterList(rowSeating.aisle_after);
      const ticketTypeId = localTicketIdToCreatedId(
        rowSeating.ticket_type_id,
        ticketTypeIdMap,
      );

      if (rowsRaw && seatsPerRow > 0) {
        const rows = expandRows(rowsRaw);

        for (const row of rows) {
          for (let seat = 1; seat <= seatsPerRow; seat += 1) {
            try {
              await createEventSeat({
                eventId: event.id,
                ticketTypeId,
                section: section || null,
                rowLabel: row,
                seatNumber: String(seat),
                tableNumber: null,
                aisleAfter: aisleAfterList.includes(seat) ? seat : null,
                status: "available",
              });
            } catch {
              // Skip duplicate seats safely.
            }
          }
        }
      }
    }

    if (eventType === "tables" && tableSeating) {
      const tableCount = positiveInteger(tableSeating.table_count ?? null, 0);
      const seatsPerTable = positiveInteger(
        tableSeating.seats_per_table ?? null,
        0,
      );
      const ticketTypeId = localTicketIdToCreatedId(
        tableSeating.ticket_type_id,
        ticketTypeIdMap,
      );

      if (tableCount > 0 && seatsPerTable > 0) {
        for (let table = 1; table <= tableCount; table += 1) {
          for (let seat = 1; seat <= seatsPerTable; seat += 1) {
            try {
              await createEventSeat({
                eventId: event.id,
                ticketTypeId,
                section: null,
                rowLabel: null,
                seatNumber: String(seat),
                tableNumber: String(table),
                aisleAfter: null,
                status: "available",
              });
            } catch {
              // Skip duplicate seats safely.
            }
          }
        }
      }
    }

    return NextResponse.redirect(
      new URL(`/admin/events/${event.id}?saved=created`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("Create event failed", error);

    return NextResponse.redirect(
      new URL("/admin/events/new?error=create-failed", request.url),
      { status: 303 },
    );
  }
}
  const totalTicketCapacity = useMemo(() => {
    return ticketTypes.reduce(
      (sum, ticketType) => sum + toPositiveNumber(ticketType.capacity),
      0,
    );
  }, [ticketTypes]);

  const reservedSeatsPreview = useMemo(() => {
    const rowsText = rowRows.trim();
    const seats = toPositiveNumber(rowSeatsPerRow);

    if (!rowsText || !seats) return 0;

    const parts = rowsText
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    let rowCount = 0;

    for (const part of parts) {
      if (part.includes("-")) {
        const [startRaw, endRaw] = part.split("-").map((item) => item.trim());
        const startNumber = Number(startRaw);
        const endNumber = Number(endRaw);

        if (Number.isFinite(startNumber) && Number.isFinite(endNumber)) {
          rowCount += Math.max(0, Math.floor(endNumber - startNumber + 1));
        } else if (startRaw.length === 1 && endRaw.length === 1) {
          const startCode = startRaw.toUpperCase().charCodeAt(0);
          const endCode = endRaw.toUpperCase().charCodeAt(0);
          rowCount += Math.max(0, endCode - startCode + 1);
        }
      } else {
        rowCount += 1;
      }
    }

    return rowCount * seats;
  }, [rowRows, rowSeatsPerRow]);

  const tableSeatsPreview = useMemo(() => {
    return toPositiveNumber(tableCount) * toPositiveNumber(tableSeatsPerTable);
  }, [tableCount, tableSeatsPerTable]);

  const seatingPreview =
    eventType === "reserved_seating"
      ? reservedSeatsPreview
      : eventType === "tables"
        ? tableSeatsPreview
        : toPositiveNumber(capacity);

  const prizesValue = useMemo(() => {
    const clean = prizes
      .map((prize, index) => {
        const position = Number(prize.position);
        const prizeTitle = prize.title.trim();

        return {
          id: prize.id,
          position:
            Number.isFinite(position) && position > 0
              ? Math.floor(position)
              : index + 1,
          title: prizeTitle,
          name: prizeTitle,
          description: prize.description.trim(),
          isPublic: Boolean(prize.is_public),
          is_public: Boolean(prize.is_public),
          sortOrder: index,
          sort_order: index,
        };
      })
      .filter((prize) => prize.title);

    return JSON.stringify(clean);
  }, [prizes]);

  const ticketTypesValue = useMemo(() => {
    const clean = ticketTypes
      .map((ticketType, index) => ({
        id: ticketType.id,
        name: ticketType.name.trim(),
        description: ticketType.description.trim(),
        price: ticketType.price,
        capacity: ticketType.capacity,
        sort_order: ticketType.sort_order || String(index),
        is_active: Boolean(ticketType.is_active),
      }))
      .filter((ticketType) => ticketType.name);

    return JSON.stringify(clean);
  }, [ticketTypes]);

  const rowSeatingValue = useMemo(() => {
    return JSON.stringify({
      section: rowSection.trim(),
      rows: rowRows.trim(),
      seats_per_row: rowSeatsPerRow,
      aisle_after: rowAislesAfter.trim(),
      ticket_type_id: rowInitialTicketTypeId,
    });
  }, [
    rowSection,
    rowRows,
    rowSeatsPerRow,
    rowAislesAfter,
    rowInitialTicketTypeId,
  ]);

  const tableSeatingValue = useMemo(() => {
    return JSON.stringify({
      table_count: tableCount,
      seats_per_table: tableSeatsPerTable,
      ticket_type_id: tableInitialTicketTypeId,
    });
  }, [tableCount, tableSeatsPerTable, tableInitialTicketTypeId]);

  const tableNamesValue = useMemo(() => {
    const tableNamesPayload: Record<string, string> = {
      [TABLE_SHAPE_KEY]: tableShape,
    };

    for (const tableNumber of tableNumbers) {
      const name = String(tableNames[tableNumber] || "").trim();

      if (name) {
        tableNamesPayload[tableNumber] = name;
      }
    }

    return JSON.stringify(tableNamesPayload);
  }, [tableNames, tableNumbers, tableShape]);

  function updateTitle(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  function updateEventSubtype(value: EventSubtype) {
    setEventSubtype(value);

    if (value === "quiz_night") {
      setTicketTypes((current) => {
        const hasEditedTickets = current.some(
          (ticketType) =>
            ticketType.name.trim() ||
            ticketType.description.trim() ||
            ticketType.price.trim() ||
            ticketType.capacity.trim(),
        );

        const isDefaultTicketSet =
          current.length === DEFAULT_TICKETS.length &&
          current.every((ticketType, index) => {
            const defaultTicket = DEFAULT_TICKETS[index];

            return (
              defaultTicket &&
              ticketType.name === defaultTicket.name &&
              ticketType.description === defaultTicket.description &&
              ticketType.price === defaultTicket.price &&
              ticketType.capacity === defaultTicket.capacity
            );
          });

        if (!hasEditedTickets || isDefaultTicketSet) {
          return QUIZ_TICKETS;
        }

        return current;
      });

      setEventType((current) =>
        current === "reserved_seating" ? "tables" : current,
      );
    }
  }

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setPrizes((current) =>
      current.map((prize) =>
        prize.id === id ? { ...prize, ...patch } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizes((current) => [
      ...current,
      makePrize(safeId("prize"), String(current.length + 1)),
    ]);
  }

  function removePrize(id: string) {
    setPrizes((current) => current.filter((prize) => prize.id !== id));
  }

  function updateTicketType(id: string, patch: Partial<TicketTypeRow>) {
    setTicketTypes((current) =>
      current.map((ticketType) =>
        ticketType.id === id ? { ...ticketType, ...patch } : ticketType,
      ),
    );
  }

  function addTicketType() {
    setTicketTypes((current) => [
      ...current,
      makeTicketType(safeId("ticket"), current.length),
    ]);
  }

  function removeTicketType(id: string) {
    setTicketTypes((current) =>
      current.length <= 1
        ? current
        : current.filter((ticketType) => ticketType.id !== id),
    );

    if (rowInitialTicketTypeId === id) setRowInitialTicketTypeId("");
    if (tableInitialTicketTypeId === id) setTableInitialTicketTypeId("");
  }

  function updateTableName(tableNumber: string, value: string) {
    setTableNames((current) => ({
      ...current,
      [tableNumber]: value,
    }));
  }

  const focusedImageStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${imageFocusX}% ${imageFocusY}%`,
    display: "block",
  };

  return (
    <form
      className="new-event-form"
      action="/api/admin/events"
      method="post"
      style={styles.form}
    >
      <style>{responsiveStyles}</style>

      <div style={styles.topBar}>
        <Link href="/admin/events" style={styles.backLink}>
          ← Back to events
        </Link>

        <Link href="/admin" style={styles.dashboardLink}>
          Dashboard
        </Link>
      </div>

      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="event_subtype" value={eventSubtype} />
      <input type="hidden" name="starts_at" value="" />
      <input type="hidden" name="ends_at" value="" />
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="ticket_types" value={ticketTypesValue} />
      <input type="hidden" name="row_seating" value={rowSeatingValue} />
      <input type="hidden" name="table_seating" value={tableSeatingValue} />
      <input type="hidden" name="table_names_json" value={tableNamesValue} />

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>
            {isQuizNight ? "Quiz night builder" : "Events builder"}
          </div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {title.trim()
                ? title
                : isQuizNight
                  ? "Build a premium quiz night"
                  : "Build a premium event"}
            </h1>

            <div style={styles.statusPill}>{status}</div>
          </div>

          <p style={styles.heroSlug}>/e/{slug.trim() ? slug : "event-slug"}</p>

          <p style={styles.heroDescription}>
            {isQuizNight
              ? "Create a quiz night booking page, add team or player tickets, prepare tables if needed, upload a polished campaign image and keep the existing secure event checkout flow."
              : "Create the public event page, add ticket types, set event timing, upload a polished campaign image and prepare seating or tables in one guided setup flow."}
          </p>

          <p style={styles.heroUseCase}>
            {isQuizNight
              ? "Ideal for pub quizzes, charity quiz nights, team fundraisers, table challenges and community social nights."
              : "Ideal for galas, dinners, ceilidhs, concerts, race nights, charity evenings and seated fundraising events."}
          </p>

          <div style={styles.heroMetricGrid}>
            <HeroMetric label="Subtype" value={formatEventSubtype(eventSubtype)} />

            <HeroMetric label="Event type" value={formatEventType(eventType)} />

            <HeroMetric
              label={isQuizNight ? "Booking types" : "Tickets"}
              value={`${activeTicketCount} active`}
            />

            <HeroMetric
              label="From"
              value={
                lowestTicketPrice === null
                  ? "Not priced"
                  : formatPreviewMoney(lowestTicketPrice, currency)
              }
            />

            <HeroMetric
              label={isQuizNight ? "Places / teams" : "Capacity"}
              value={seatingPreview > 0 ? seatingPreview : "Not set"}
            />
          </div>
        </div>

        <div style={styles.previewShell}>
          <div style={styles.previewBadge}>Public preview</div>

          <div style={styles.previewImageWrap}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title.trim() || "Event image preview"}
                style={focusedImageStyle}
              />
            ) : (
              <img
                src={DEFAULT_EVENTS_IMAGE}
                alt="Event placeholder"
                style={styles.placeholderImage}
              />
            )}
          </div>

          <div style={styles.previewCardBody}>
            <div style={styles.previewTitle}>
              {title.trim()
                ? title
                : isQuizNight
                  ? "Your quiz night"
                  : "Your event"}
            </div>

            <div style={styles.previewText}>
              {description.trim()
                ? description.trim().slice(0, 96)
                : isQuizNight
                  ? "A short public summary of your quiz night will appear here."
                  : "A short public summary of your event will appear here."}
              {description.trim().length > 96 ? "…" : ""}
            </div>

            <div style={styles.previewMetaGrid}>
              <span style={styles.previewMetaItem}>
                {formatEventSubtype(eventSubtype)}
              </span>

              <span style={styles.previewMetaItem}>
                {formatEventType(eventType)}
              </span>

              <span style={styles.previewMetaItem}>
                {formatDatePreview(startsDate, startsTime)}
              </span>

              <span style={styles.previewMetaItem}>
                {lowestTicketPrice === null
                  ? "Price not set"
                  : `${formatPreviewMoney(lowestTicketPrice, currency)} from`}
              </span>

              <span style={styles.previewMetaItem}>
                {seatingPreview > 0
                  ? `${seatingPreview} places`
                  : "Capacity TBC"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <SummaryCard label="Subtype" value={formatEventSubtype(eventSubtype)} />

        <SummaryCard label="Event type" value={formatEventType(eventType)} />

        <SummaryCard
          label={isQuizNight ? "Booking types" : "Ticket types"}
          value={`${activeTicketCount} active`}
        />

        <SummaryCard
          label="Starting price"
          value={
            lowestTicketPrice === null
              ? "Not priced"
              : formatPreviewMoney(lowestTicketPrice, currency)
          }
        />

        <SummaryCard
          label="Starts"
          value={startsDate.trim() ? "Scheduled" : "Not scheduled"}
        />

        <SummaryCard
          label="Public prizes"
          value={prizeText(publicPrizesCount)}
        />
      </section>

      <section style={styles.readinessGrid}>
        <ReadinessCard eyebrow="Campaign readiness" title="Before publishing">
          <CheckItem done={Boolean(title.trim())}>
            {isQuizNight ? "Add quiz night title" : "Add event title"}
          </CheckItem>
          <CheckItem done={Boolean(slug.trim())}>Confirm public slug</CheckItem>
          <CheckItem done={Boolean(description.trim())}>Add description</CheckItem>
          <CheckItem done={Boolean(location.trim())}>Add location</CheckItem>
          <CheckItem done={Boolean(startsDate.trim())}>Schedule start date</CheckItem>
          <CheckItem done={activeTicketCount > 0}>
            {isQuizNight ? "Add team or player ticket" : "Add active ticket type"}
          </CheckItem>
        </ReadinessCard>

        <ReadinessCard
          eyebrow={isQuizNight ? "Quiz booking preview" : "Ticket preview"}
          title={isQuizNight ? "Bookings" : "Tickets"}
        >
          <PreviewLine label="Active types" value={activeTicketCount} />

          <PreviewLine
            label="Starting price"
            value={
              lowestTicketPrice === null
                ? "Not priced"
                : formatPreviewMoney(lowestTicketPrice, currency)
            }
          />

          <PreviewLine
            label={isQuizNight ? "Booking limit" : "Ticket limit"}
            value={
              totalTicketCapacity > 0
                ? `${totalTicketCapacity} from ticket types`
                : isQuizNight
                  ? "No booking limit set"
                  : "No ticket limit set"
            }
          />
        </ReadinessCard>

        <ReadinessCard
          eyebrow={isQuizNight ? "Quiz setup preview" : "Event setup preview"}
          title={formatEventType(eventType)}
        >
          <PreviewLine
            label={isQuizNight ? "Places / teams" : "Capacity"}
            value={seatingPreview > 0 ? seatingPreview : "Not set"}
          />

          {eventType === "tables" ? (
            <PreviewLine label="Table shape" value={formatTableShape(tableShape)} />
          ) : null}

          <PreviewLine
            label="Starts"
            value={formatDatePreview(startsDate, startsTime)}
          />

          <PreviewLine label="Prizes" value={prizeText(publicPrizesCount)} />
        </ReadinessCard>
      </section>
            <SectionCard
        number="01"
        title={isQuizNight ? "Quiz night details" : "Event details"}
        description={
          isQuizNight
            ? "Set the public title, URL, description, image, venue and quiz timing."
            : "Set the public title, URL, description, image, location and timing."
        }
        badge={startsDate.trim() ? "Event scheduled" : undefined}
        tone="default"
      >
        <div style={styles.subtypeGrid}>
          <label
            style={{
              ...styles.subtypeCard,
              borderColor: eventSubtype === "standard" ? "#1683f8" : "#e2e8f0",
              background: eventSubtype === "standard" ? "#eff6ff" : "#ffffff",
            }}
          >
            <input
              type="radio"
              name="event_subtype_selector"
              value="standard"
              checked={eventSubtype === "standard"}
              onChange={() => updateEventSubtype("standard")}
            />

            <span style={styles.subtypeTitle}>Standard event</span>

            <span style={styles.subtypeText}>
              Use the normal event setup for galas, concerts, dinners, ceilidhs
              and seated fundraisers.
            </span>
          </label>

          <label
            style={{
              ...styles.subtypeCard,
              borderColor: isQuizNight ? "#d97706" : "#e2e8f0",
              background: isQuizNight ? "#fffbeb" : "#ffffff",
            }}
          >
            <input
              type="radio"
              name="event_subtype_selector"
              value="quiz_night"
              checked={isQuizNight}
              onChange={() => updateEventSubtype("quiz_night")}
            />

            <span style={styles.subtypeTitle}>Quiz night</span>

            <span style={styles.subtypeText}>
              Use event checkout with quiz-focused wording, team tickets and
              optional table bookings.
            </span>
          </label>
        </div>

        {isQuizNight ? (
          <div style={styles.quizInlineNotice}>
            <strong>Quiz night mode is active.</strong>
            <span>
              This keeps the existing Events checkout and booking flow. Use
              general admission for team/player tickets, or tables for team
              table bookings.
            </span>
          </div>
        ) : null}

        <div style={styles.twoCol}>
          <Field label="Title">
            <input
              name="title"
              required
              value={title}
              onChange={(event) => updateTitle(event.target.value)}
              style={styles.input}
              placeholder={isQuizNight ? "Charity Quiz Night" : "Summer Gala Night"}
            />
          </Field>

          <Field label="Slug">
            <input
              name="slug"
              required
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(slugify(event.target.value));
              }}
              style={styles.input}
              placeholder={isQuizNight ? "charity-quiz-night" : "summer-gala-night"}
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            name="description"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            style={styles.textarea}
            placeholder={
              isQuizNight
                ? "Describe the quiz format, team size, rounds, prizes and fundraising cause..."
                : "Describe the event..."
            }
          />
        </Field>

        <div style={styles.mediaBox}>
          <div style={styles.mediaControls}>
            <h3 style={styles.panelTitle}>
              {isQuizNight ? "Quiz night image" : "Event image"}
            </h3>

            <p style={styles.sectionText}>
              Upload or replace the public event image, then choose the focal
              point for wide banners and cards.
            </p>

            <ImageFocusUploadField
              currentImageUrl={imageUrl}
              currentFocusX={imageFocusX}
              currentFocusY={imageFocusY}
              label={isQuizNight ? "Quiz night image upload" : "Event image upload"}
              previewAlt={title.trim() || "Event image preview"}
              subscriptionTier={subscriptionTier}
              customImagesAllowed={customImagesAllowed}
              onImageUrlChange={(url) => setImageUrl(url)}
              onFocusXChange={(value) => setImageFocusX(cleanFocus(value))}
              onFocusYChange={(value) => setImageFocusY(cleanFocus(value))}
            />
          </div>

          <div style={styles.previewBox}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title.trim() || "Event image preview"}
                style={focusedImageStyle}
              />
            ) : (
              <img
                src={DEFAULT_EVENTS_IMAGE}
                alt="Event placeholder"
                style={styles.previewPlaceholderImage}
              />
            )}
          </div>
        </div>

        <div style={styles.twoCol}>
          <Field label={isQuizNight ? "Venue" : "Location"}>
            <input
              name="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={isQuizNight ? "Pub, hall, school or venue" : "Venue, city or online"}
              style={styles.input}
            />
          </Field>

          <Field label="General admission capacity">
            <input
              name="capacity"
              type="number"
              min="0"
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder={
                isQuizNight
                  ? "Leave blank if using team/table ticket limits"
                  : "Leave blank for unlimited"
              }
              style={styles.input}
            />
          </Field>
        </div>

        <div className="new-event-date-grid" style={styles.dateGrid}>
          <Field label={isQuizNight ? "Quiz start date" : "Start date"}>
            <input
              name="starts_date"
              type="text"
              inputMode="numeric"
              value={startsDate}
              onChange={(event) => setStartsDate(event.target.value)}
              placeholder="DD/MM/YYYY"
              style={styles.input}
            />
          </Field>

          <Field label={isQuizNight ? "Quiz start time" : "Start time"}>
            <input
              name="starts_time"
              type="text"
              inputMode="numeric"
              value={startsTime}
              onChange={(event) => setStartsTime(event.target.value)}
              placeholder="HH:MM"
              style={styles.input}
            />
          </Field>

          <Field label={isQuizNight ? "Quiz end date" : "End date"}>
            <input
              name="ends_date"
              type="text"
              inputMode="numeric"
              value={endsDate}
              onChange={(event) => setEndsDate(event.target.value)}
              placeholder="DD/MM/YYYY"
              style={styles.input}
            />
          </Field>

          <Field label={isQuizNight ? "Quiz end time" : "End time"}>
            <input
              name="ends_time"
              type="text"
              inputMode="numeric"
              value={endsTime}
              onChange={(event) => setEndsTime(event.target.value)}
              placeholder="HH:MM"
              style={styles.input}
            />
          </Field>
        </div>

        <div style={styles.previewInfoCard}>
          <div style={styles.previewInfoLabel}>
            {isQuizNight ? "Quiz night preview" : "Event preview"}
          </div>

          <div style={styles.previewInfoValue}>
            {formatDatePreview(startsDate, startsTime)}
            {location.trim() ? ` • ${location.trim()}` : ""}
          </div>
        </div>

        <div style={styles.threeCol}>
          <Field label="Currency">
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              style={styles.input}
            >
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </Field>

          <Field label={isQuizNight ? "Booking layout" : "Type"}>
            <select
              name="event_type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value as EventType)}
              style={styles.input}
            >
              <option value="general_admission">
                {isQuizNight ? "General admission / team tickets" : "General admission"}
              </option>
              <option value="reserved_seating">Reserved seating</option>
              <option value="tables">
                {isQuizNight ? "Tables / team tables" : "Tables"}
              </option>
            </select>
          </Field>

          <Field label="Status">
            <select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              style={styles.input}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        number="02"
        title={isQuizNight ? "Team bookings" : "Tickets & prices"}
        description={
          isQuizNight
            ? "Add team or player booking choices. You can edit them after creation."
            : "Add public ticket choices now. You can edit them after creation."
        }
        badge={`${activeTicketCount} active`}
        tone="tickets"
      >
        <div style={styles.sectionHeaderInner}>
          <div>
            <h3 style={styles.panelTitle}>
              {isQuizNight ? "Booking choices" : "Ticket types"}
            </h3>

            <p style={styles.sectionText}>
              {isQuizNight
                ? "Create team or player options with prices, limits and public descriptions."
                : "Create ticket names, prices, limits and public descriptions."}
            </p>
          </div>

          <button type="button" onClick={addTicketType} style={styles.lightButton}>
            {isQuizNight ? "+ Add booking choice" : "+ Add ticket type"}
          </button>
        </div>

        <div style={styles.list}>
          {ticketTypes.map((ticketType, index) => (
            <div key={ticketType.id} style={styles.editTicketCard}>
              <div style={styles.rowHeader}>
                <strong>
                  {isQuizNight ? "Booking choice" : "Ticket type"} {index + 1}
                </strong>

                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={ticketType.is_active}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Active
                </label>
              </div>

              <div style={styles.twoCol}>
                <Field label={isQuizNight ? "Booking name" : "Ticket name"}>
                  <input
                    value={ticketType.name}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        name: event.target.value,
                      })
                    }
                    placeholder={isQuizNight ? "Team entry" : "Standard"}
                    style={styles.input}
                  />
                </Field>

                <Field label="Description">
                  <input
                    value={ticketType.description}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        description: event.target.value,
                      })
                    }
                    placeholder={
                      isQuizNight
                        ? "e.g. Up to 6 players per team"
                        : "Optional description"
                    }
                    style={styles.input}
                  />
                </Field>
              </div>

              <div style={styles.threeCol}>
                <Field label="Price">
                  <input
                    value={ticketType.price}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        price: event.target.value,
                      })
                    }
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="10.00"
                    style={styles.input}
                  />
                </Field>

                <Field label={isQuizNight ? "Booking limit" : "Ticket limit"}>
                  <input
                    value={ticketType.capacity}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        capacity: event.target.value,
                      })
                    }
                    type="number"
                    min="0"
                    placeholder="Leave blank for unlimited"
                    style={styles.input}
                  />
                </Field>

                <Field label="Order">
                  <input
                    value={ticketType.sort_order}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        sort_order: event.target.value,
                      })
                    }
                    type="number"
                    min="0"
                    style={styles.input}
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={() => removeTicketType(ticketType.id)}
                disabled={ticketTypes.length <= 1}
                style={{
                  ...styles.dangerOutlineButton,
                  opacity: ticketTypes.length <= 1 ? 0.55 : 1,
                  cursor: ticketTypes.length <= 1 ? "not-allowed" : "pointer",
                }}
              >
                {isQuizNight
                  ? "Delete this booking choice"
                  : "Delete this ticket type"}
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {eventType === "reserved_seating" ? (
        <SectionCard
          number="03"
          title="Row seating"
          description="Generate initial row seats during creation. You can fine-tune them later."
          badge={
            reservedSeatsPreview ? `${reservedSeatsPreview} seats` : "Optional"
          }
          tone="seating"
        >
          <div style={styles.twoPanel}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Generate row seating</h3>

              <div style={styles.formInner}>
                <Field label="Initial marking">
                  <select
                    value={rowInitialTicketTypeId}
                    onChange={(event) =>
                      setRowInitialTicketTypeId(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="">Normal public seats</option>
                    {ticketTypes
                      .filter((ticketType) => ticketType.name.trim())
                      .map((ticketType) => (
                        <option key={ticketType.id} value={ticketType.id}>
                          {ticketType.name}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Section">
                  <input
                    value={rowSection}
                    onChange={(event) => setRowSection(event.target.value)}
                    placeholder="Main, VIP, Balcony, Left, Centre..."
                    style={styles.input}
                  />
                </Field>

                <Field label="Rows">
                  <input
                    value={rowRows}
                    onChange={(event) => setRowRows(event.target.value)}
                    placeholder="1-10 or A-C or 1-3,8-10"
                    style={styles.input}
                  />
                </Field>

                <div style={styles.twoCol}>
                  <Field label="Seats per row">
                    <input
                      value={rowSeatsPerRow}
                      onChange={(event) => setRowSeatsPerRow(event.target.value)}
                      type="number"
                      min="1"
                      placeholder="40"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Aisles after seats">
                    <input
                      value={rowAislesAfter}
                      onChange={(event) => setRowAislesAfter(event.target.value)}
                      placeholder="10,20,30"
                      style={styles.input}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Row seating summary</h3>

              <p style={styles.sectionText}>
                Leave these blank if you want to create the event first and
                generate row seats later.
              </p>

              <div style={styles.previewInfoCard}>
                <div style={styles.previewInfoLabel}>Seat preview</div>

                <div style={styles.previewInfoValue}>
                  {reservedSeatsPreview
                    ? `${reservedSeatsPreview} seats estimated`
                    : "No rows configured yet"}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : null}
            {eventType === "tables" ? (
        <SectionCard
          number="03"
          title={isQuizNight ? "Team table seating" : "Table seating"}
          description={
            isQuizNight
              ? "Generate quiz team tables during creation, choose the table shape and optionally name tables."
              : "Generate table seats during creation, choose the table shape and optionally name tables."
          }
          badge={tableSeatsPreview ? `${tableSeatsPreview} places` : "Optional"}
          tone="seating"
        >
          <div style={styles.twoPanel}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>
                {isQuizNight ? "Generate team tables" : "Generate table seating"}
              </h3>

              <div style={styles.formInner}>
                <Field label="Initial marking">
                  <select
                    value={tableInitialTicketTypeId}
                    onChange={(event) =>
                      setTableInitialTicketTypeId(event.target.value)
                    }
                    style={styles.input}
                  >
                    <option value="">Normal public seats</option>
                    {ticketTypes
                      .filter((ticketType) => ticketType.name.trim())
                      .map((ticketType) => (
                        <option key={ticketType.id} value={ticketType.id}>
                          {ticketType.name}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Table shape">
                  <select
                    value={tableShape}
                    onChange={(event) =>
                      setTableShape(cleanTableShape(event.target.value))
                    }
                    style={styles.input}
                  >
                    <option value="round">Round tables</option>
                    <option value="square">Square tables</option>
                    <option value="rectangle">Rectangle tables</option>
                  </select>
                </Field>

                <div style={styles.twoCol}>
                  <Field
                    label={
                      isQuizNight
                        ? "Number of teams/tables"
                        : "Number of tables"
                    }
                  >
                    <input
                      value={tableCount}
                      onChange={(event) => setTableCount(event.target.value)}
                      type="number"
                      min="1"
                      placeholder="10"
                      style={styles.input}
                    />
                  </Field>

                  <Field
                    label={isQuizNight ? "Players per table" : "Seats per table"}
                  >
                    <input
                      value={tableSeatsPerTable}
                      onChange={(event) =>
                        setTableSeatsPerTable(event.target.value)
                      }
                      type="number"
                      min="1"
                      placeholder={isQuizNight ? "6" : "8"}
                      style={styles.input}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>
                {isQuizNight ? "Quiz table summary" : "Table seating summary"}
              </h3>

              <p style={styles.sectionText}>
                Leave these blank if you want to create the event first and
                generate table seats later.
              </p>

              <div style={styles.previewInfoCard}>
                <div style={styles.previewInfoLabel}>Table preview</div>

                <div style={styles.previewInfoValue}>
                  {tableSeatsPreview
                    ? `${tableCount || 0} tables • ${tableSeatsPreview} places`
                    : "No tables configured yet"}
                </div>
              </div>

              <div style={{ ...styles.previewInfoCard, marginTop: 12 }}>
                <div style={styles.previewInfoLabel}>Shape</div>

                <div style={styles.previewInfoValue}>
                  {formatTableShape(tableShape)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ ...styles.panel, marginTop: 16 }}>
            <h3 style={styles.panelTitle}>
              {isQuizNight ? "Team/table names optional" : "Table names optional"}
            </h3>

            <p style={styles.sectionText}>
              {isQuizNight
                ? "Add friendly team or table names before they go public. These save as table names automatically."
                : "Add friendly names for tables before they go public. These save as table names automatically."}
            </p>

            {tableNumbers.length === 0 ? (
              <div style={styles.emptyBox}>
                Enter the number of tables above to show table name fields.
              </div>
            ) : (
              <div style={styles.tableNamesGrid}>
                {tableNumbers.map((tableNumber) => (
                  <label key={tableNumber} style={styles.tableNameRow}>
                    <span style={styles.tableNameLabel}>Table {tableNumber}</span>

                    <input
                      value={tableNames[tableNumber] || ""}
                      onChange={(event) =>
                        updateTableName(tableNumber, event.target.value)
                      }
                      placeholder={
                        isQuizNight
                          ? "e.g. Team 1, Sponsors, Staff Team"
                          : "e.g. VIP, Sponsors, Smith Family"
                      }
                      style={styles.input}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        number={eventType === "general_admission" ? "03" : "04"}
        title={isQuizNight ? "Quiz prizes" : "Prize settings"}
        description={
          isQuizNight
            ? "Choose which quiz prizes are visible on the public event page."
            : "Choose which prizes are visible on the public event page."
        }
        badge={prizeText(publicPrizesCount)}
        tone="prize"
      >
        <div style={styles.prizeSectionShell}>
          <div style={styles.prizeSectionTop}>
            <div>
              <div style={styles.prizeSectionTitle}>
                {isQuizNight ? "Quiz prize list" : "Public prize list"}
              </div>
              <div style={styles.prizeSectionText}>
                {isQuizNight
                  ? "These prizes can be used for quiz winners or later event draws."
                  : "These prizes can also be used later during winner draws."}
              </div>
            </div>

            <button type="button" onClick={addPrize} style={styles.prizeAddButton}>
              + Add prize
            </button>
          </div>

          <div style={styles.prizeGrid}>
            {prizes.map((prize, index) => (
              <div key={prize.id} style={styles.prizeCard}>
                <div style={styles.prizeHeader}>
                  <div style={styles.prizeBadge}>Prize {index + 1}</div>

                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={prize.is_public}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          is_public: event.target.checked,
                        })
                      }
                    />
                    Public
                  </label>
                </div>

                <div style={styles.threeCol}>
                  <Field label="Position">
                    <input
                      value={prize.position}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          position: event.target.value,
                        })
                      }
                      type="number"
                      min="1"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Prize title">
                    <input
                      value={prize.title}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          title: event.target.value,
                        })
                      }
                      placeholder={isQuizNight ? "Winning team prize" : "Luxury hamper"}
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Prize description">
                    <input
                      value={prize.description}
                      onChange={(event) =>
                        updatePrize(prize.id, {
                          description: event.target.value,
                        })
                      }
                      placeholder="Optional"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => removePrize(prize.id)}
                  disabled={prizes.length <= 1}
                  style={{
                    ...styles.dangerOutlineButton,
                    opacity: prizes.length <= 1 ? 0.55 : 1,
                    cursor: prizes.length <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  Remove prize
                </button>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <section style={styles.submitBar}>
        <div>
          <div style={styles.submitTitle}>
            {isQuizNight ? "Create quiz night" : "Create event"}
          </div>

          <div style={styles.submitText}>
            {isQuizNight
              ? "Your quiz night will be created and can be edited further afterwards."
              : "Your event will be created in draft mode and can be edited further afterwards."}
          </div>
        </div>

        <button type="submit" style={styles.submitButton}>
          {isQuizNight ? "Create quiz night" : "Create event"}
        </button>
      </section>
    </form>
  );
}

function SectionCard({
  number,
  title,
  description,
  children,
  badge,
  tone = "default",
}: {
  number: string;
  title: string;
  description: string;
  children: ReactNode;
  badge?: ReactNode;
  tone?: SectionTone;
}) {
  return (
    <section
      style={{
        ...styles.sectionCard,
        ...getSectionToneStyle(tone),
      }}
    >
      <div style={styles.sectionTop}>
        <div>
          <div style={styles.sectionEyebrow}>Section {number}</div>

          <h2 style={styles.sectionTitle}>{title}</h2>

          <p style={styles.sectionDescription}>{description}</p>
        </div>

        {badge ? <div style={styles.sectionBadge}>{badge}</div> : null}
      </div>

      {children}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetricCard}>
      <div style={styles.heroMetricLabel}>{label}</div>
      <div style={styles.heroMetricValue}>{value}</div>
    </div>
  );
}

function ReadinessCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={styles.readinessCard}>
      <div style={styles.readinessEyebrow}>{eyebrow}</div>
      <h3 style={styles.readinessTitle}>{title}</h3>
      <div style={styles.readinessBody}>{children}</div>
    </div>
  );
}

function CheckItem({
  done,
  children,
}: {
  done: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        ...styles.checkItem,
        background: done ? "#ecfdf5" : "#f8fafc",
        borderColor: done ? "#bbf7d0" : "#e2e8f0",
      }}
    >
      <span
        style={{
          ...styles.checkIcon,
          background: done ? "#16a34a" : "#cbd5e1",
        }}
      >
        {done ? "✓" : ""}
      </span>

      <span>{children}</span>
    </div>
  );
}

function PreviewLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.previewLine}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      {children}
    </label>
  );
}

const responsiveStyles = `
  .new-event-form,
  .new-event-form * {
    box-sizing: border-box;
  }

  .new-event-form {
    width: 100%;
    overflow-x: hidden;
  }

  .new-event-form img,
  .new-event-form input,
  .new-event-form textarea,
  .new-event-form select,
  .new-event-form button {
    max-width: 100%;
  }

  @media (max-width: 760px) {
    .new-event-form {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
    }

    .new-event-form [style*="grid-template-columns"] {
      grid-template-columns: 1fr !important;
    }

    .new-event-form section,
    .new-event-form details,
    .new-event-form div,
    .new-event-form label {
      min-width: 0 !important;
      max-width: 100% !important;
    }

    .new-event-form h1 {
      font-size: clamp(34px, 12vw, 46px) !important;
      line-height: 1.02 !important;
      letter-spacing: -0.055em !important;
      overflow-wrap: anywhere !important;
    }

    .new-event-form h2 {
      font-size: clamp(28px, 9vw, 36px) !important;
      line-height: 1.05 !important;
      overflow-wrap: anywhere !important;
    }

    .new-event-form p,
    .new-event-form span,
    .new-event-form strong {
      overflow-wrap: anywhere !important;
    }

    .new-event-form [style*="height: 278px"],
    .new-event-form [style*="height: 260px"] {
      height: auto !important;
      min-height: 190px !important;
      aspect-ratio: 16 / 10 !important;
    }

    .new-event-form [style*="display: flex"] {
      flex-wrap: wrap !important;
    }

    .new-event-form button,
    .new-event-form a {
      min-height: 46px !important;
    }
  }

  @media (max-width: 520px) {
    .new-event-form > div:first-child {
      display: grid !important;
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }

    .new-event-form > div:first-child a {
      width: 100% !important;
      justify-content: center !important;
    }

    .new-event-form section,
    .new-event-form details {
      border-radius: 22px !important;
    }

    .new-event-form input,
    .new-event-form textarea,
    .new-event-form select {
      font-size: 16px !important;
    }

    .new-event-form button {
      width: 100% !important;
      justify-content: center !important;
    }
  }
`;

const styles: Record<string, CSSProperties> = {
  form: {
    display: "grid",
    gap: 16,
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "11px 14px",
    borderRadius: 999,
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 900,
  },
  dashboardLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "11px 14px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 900,
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(300px, 0.9fr)",
    gap: 24,
    alignItems: "stretch",
    padding: "clamp(24px, 4vw, 34px)",
    borderRadius: 30,
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    overflow: "hidden",
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 14,
  },
  heroTitleRow: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 5vw, 50px)",
    lineHeight: 1.02,
    letterSpacing: "-0.06em",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    maxWidth: 720,
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    fontSize: 13,
    textTransform: "capitalize",
    fontWeight: 900,
    background: "rgba(255,255,255,0.1)",
    color: "#ffffff",
  },
  heroSlug: {
    margin: "12px 0 0",
    color: "#bfdbfe",
    fontSize: 14,
    fontWeight: 800,
    wordBreak: "break-word",
  },
  heroDescription: {
    margin: "16px 0 0",
    color: "#dbeafe",
    lineHeight: 1.7,
    maxWidth: 760,
    overflowWrap: "anywhere",
    fontSize: 16,
  },
  heroUseCase: {
    margin: "14px 0 0",
    padding: "11px 13px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    color: "#bfdbfe",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 800,
  },
  heroMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
    gap: 10,
    marginTop: 24,
  },
  heroMetricCard: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  heroMetricLabel: {
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
  },
  heroMetricValue: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  previewShell: {
    display: "grid",
    alignContent: "start",
    gap: 12,
    borderRadius: 24,
    padding: 14,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  previewBadge: {
    justifySelf: "start",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  previewImageWrap: {
    height: 278,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderImage: {
    width: "min(92%, 254px)",
    height: "min(92%, 254px)",
    objectFit: "contain",
    display: "block",
  },
  previewCardBody: {
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    color: "#0f172a",
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  previewText: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  },
  previewMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },
  previewMetaItem: {
    padding: "8px 10px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
    gap: 12,
  },
  summaryCard: {
    padding: 15,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
  },
  summaryValue: {
    color: "#0f172a",
    fontSize: 21,
    fontWeight: 950,
    marginTop: 5,
    wordBreak: "break-word",
  },
  readinessGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: 14,
  },
  readinessCard: {
    padding: 18,
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },
  readinessEyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  readinessTitle: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
  },
  readinessBody: {
    display: "grid",
    gap: 10,
    marginTop: 14,
  },
  previewLine: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    color: "#334155",
    fontSize: 14,
  },
  sectionCard: {
    padding: "clamp(18px, 4vw, 22px)",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
    overflow: "hidden",
  },
  sectionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  sectionEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    letterSpacing: "-0.03em",
  },
  sectionDescription: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  sectionBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #dbe3ef",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  subtypeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  subtypeCard: {
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 18,
    border: "1px solid",
    cursor: "pointer",
    minWidth: 0,
  },
  subtypeTitle: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },
  subtypeText: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    fontWeight: 750,
  },
  quizInlineNotice: {
    display: "grid",
    gap: 6,
    padding: 14,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 800,
    marginBottom: 16,
  },
  dateGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },
  sectionHeaderInner: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  sectionText: {
    margin: "6px 0 12px",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },
  formInner: {
    display: "grid",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  input: {
    width: "100%",
    minHeight: 48,
    padding: "12px 13px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "12px 13px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 16,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
    gap: 14,
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
    gap: 14,
  },
  twoPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
    gap: 16,
  },
  mediaBox: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 0.95fr) minmax(280px, 1.05fr)",
    gap: 18,
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  mediaControls: {
    minWidth: 0,
  },
  previewBox: {
    height: 260,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPlaceholderImage: {
    width: "min(92%, 238px)",
    height: "min(92%, 238px)",
    objectFit: "contain",
    display: "block",
  },
  panel: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    marginBottom: 0,
    minWidth: 0,
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  previewInfoCard: {
    display: "grid",
    alignContent: "center",
    minHeight: 48,
    padding: "12px 13px",
    borderRadius: 16,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: 900,
  },
  previewInfoLabel: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 2,
  },
  previewInfoValue: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: 950,
  },
  lightButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  list: {
    display: "grid",
    gap: 12,
  },
  editTicketCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #bfdbfe",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #eff6ff 0%, #ffffff 55%, #f8fafc 100%)",
    minWidth: 0,
  },
  prizeSectionShell: {
    display: "grid",
    gap: 14,
    padding: "clamp(14px, 4vw, 16px)",
    borderRadius: 22,
    background: "#ffffff",
    border: "1px solid #fde68a",
    minWidth: 0,
    overflow: "hidden",
  },
  prizeSectionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  prizeSectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  prizeSectionText: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.45,
  },
  prizeAddButton: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #facc15",
    background: "#fef3c7",
    color: "#92400e",
    cursor: "pointer",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  prizeGrid: {
    display: "grid",
    gap: 12,
  },
  prizeCard: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid #fde68a",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, #fffbeb 0%, #ffffff 55%, #f8fafc 100%)",
  },
  prizeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  prizeBadge: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 12,
    fontWeight: 950,
  },
  rowHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    color: "#0f172a",
  },
  checkboxLabel: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    fontWeight: 900,
    color: "#334155",
  },
  dangerOutlineButton: {
    width: "fit-content",
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  emptyBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 800,
    overflowWrap: "anywhere",
  },
  tableNamesGrid: {
    display: "grid",
    gap: 10,
    marginTop: 14,
  },
  tableNameRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 110px), 1fr))",
    gap: 10,
    alignItems: "center",
  },
  tableNameLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
  },
  checkItem: {
    display: "flex",
    gap: 9,
    alignItems: "center",
    color: "#334155",
    fontSize: 14,
    fontWeight: 800,
    padding: "9px 10px",
    borderRadius: 14,
    border: "1px solid",
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 950,
    flexShrink: 0,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    marginTop: 18,
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  submitTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  submitText: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
  submitButton: {
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.22)",
 };
}
