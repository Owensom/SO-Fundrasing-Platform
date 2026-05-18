"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import ImageFocusUploadField from "@/components/ImageFocusUploadField";

type Props = {
  tenantSlug: string;
  subscriptionTier?: string | null;
  customImagesAllowed?: boolean;
};

type EventType = "general_admission" | "reserved_seating" | "tables";
type SectionTone = "default" | "tickets" | "seating" | "media" | "prize";

type PrizeRow = {
  id: string;
  position: string;
  title: string;
  description: string;
  is_public: boolean;
};

type TicketTypeRow = {
  id: string;
  name: string;
  description: string;
  price: string;
  capacity: string;
  sort_order: string;
  is_active: boolean;
};

const DEFAULT_EVENTS_IMAGE = "/brand/so-default-events.png";

const DEFAULT_TICKETS: TicketTypeRow[] = [
  {
    id: "ticket-standard",
    name: "Standard",
    description: "",
    price: "",
    capacity: "",
    sort_order: "0",
    is_active: true,
  },
  {
    id: "ticket-concession",
    name: "Concession",
    description: "",
    price: "",
    capacity: "",
    sort_order: "1",
    is_active: true,
  },
];

function safeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makePrize(
  id: string,
  position = "1",
  title = "",
  description = "",
): PrizeRow {
  return {
    id,
    position,
    title,
    description,
    is_public: true,
  };
}

function makeTicketType(id: string, sortOrder: number): TicketTypeRow {
  return {
    id,
    name: "",
    description: "",
    price: "",
    capacity: "",
    sort_order: String(sortOrder),
    is_active: true,
  };
}

function cleanFocus(value: number | null | undefined) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function formatEventType(value: EventType) {
  if (value === "reserved_seating") return "Reserved seating";
  if (value === "tables") return "Tables";
  return "General admission";
}

function formatPreviewMoney(value: number | string, currency: string) {
  const amount = Number(value || 0);

  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    const safeAmount = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
    return `${safeAmount} ${currency || "GBP"}`;
  }
}

function formatDatePreview(value: string) {
  if (!value) return "Date to be confirmed";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toPositiveNumber(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getTierLabel(value: string | null | undefined) {
  if (value === "professional") return "Professional";
  if (value === "foundation") return "Foundation";
  return "Community";
}

function getSectionToneStyle(tone: SectionTone): CSSProperties {
  if (tone === "tickets") {
    return {
      background:
        "linear-gradient(135deg, #eff6ff 0%, #ffffff 48%, #f8fafc 100%)",
      borderColor: "#bfdbfe",
    };
  }

  if (tone === "seating") {
    return {
      background:
        "linear-gradient(135deg, #f5f3ff 0%, #ffffff 50%, #eff6ff 100%)",
      borderColor: "#ddd6fe",
    };
  }

  if (tone === "media") {
    return {
      background:
        "linear-gradient(135deg, #f8fafc 0%, #ffffff 48%, #eef2ff 100%)",
      borderColor: "#c7d2fe",
    };
  }

  if (tone === "prize") {
    return {
      background:
        "linear-gradient(135deg, #fffbeb 0%, #ffffff 52%, #f8fafc 100%)",
      borderColor: "#fde68a",
    };
  }

  return {
    background: "#ffffff",
    borderColor: "#e2e8f0",
  };
}

function prizeText(count: number) {
  if (count <= 0) return "No prizes yet";
  return `${count} prize${count === 1 ? "" : "s"}`;
}

export default function NewEventForm({
  tenantSlug,
  subscriptionTier,
  customImagesAllowed = false,
}: Props) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [status, setStatus] = useState("draft");
  const [eventType, setEventType] = useState<EventType>("general_admission");

  const [imageUrl, setImageUrl] = useState("");
  const [imageFocusX, setImageFocusX] = useState(50);
  const [imageFocusY, setImageFocusY] = useState(50);

  const [prizes, setPrizes] = useState<PrizeRow[]>([
    makePrize("prize-1", "1", "", ""),
  ]);

  const [ticketTypes, setTicketTypes] =
    useState<TicketTypeRow[]>(DEFAULT_TICKETS);

  const [rowSection, setRowSection] = useState("");
  const [rowRows, setRowRows] = useState("");
  const [rowSeatsPerRow, setRowSeatsPerRow] = useState("");
  const [rowAislesAfter, setRowAislesAfter] = useState("");
  const [rowInitialTicketTypeId, setRowInitialTicketTypeId] = useState("");

  const [tableCount, setTableCount] = useState("");
  const [tableSeatsPerTable, setTableSeatsPerTable] = useState("");
  const [tableInitialTicketTypeId, setTableInitialTicketTypeId] = useState("");
  const [tableNames, setTableNames] = useState<Record<string, string>>({});

  const tierLabel = getTierLabel(subscriptionTier);

  const tableNumbers = useMemo(() => {
    const count = Number(tableCount);
    if (!Number.isFinite(count) || count <= 0) return [];

    return Array.from({ length: Math.floor(count) }, (_, index) =>
      String(index + 1),
    );
  }, [tableCount]);

  const publicPrizesCount = useMemo(() => {
    return prizes.filter((prize) => prize.title.trim() && prize.is_public)
      .length;
  }, [prizes]);

  const activeTicketCount = useMemo(() => {
    return ticketTypes.filter(
      (ticketType) => ticketType.name.trim() && ticketType.is_active,
    ).length;
  }, [ticketTypes]);

  const lowestTicketPrice = useMemo(() => {
    const prices = ticketTypes
      .filter((ticketType) => ticketType.name.trim() && ticketType.is_active)
      .map((ticketType) => Number(ticketType.price))
      .filter((price) => Number.isFinite(price) && price >= 0);

    if (!prices.length) return null;

    return Math.min(...prices);
  }, [ticketTypes]);

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
    return JSON.stringify(
      Object.fromEntries(
        tableNumbers
          .map((tableNumber) => [
            tableNumber,
            String(tableNames[tableNumber] || "").trim(),
          ])
          .filter(([, name]) => name),
      ),
    );
  }, [tableNames, tableNumbers]);

  function updateTitle(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(slugify(value));
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
      <input type="hidden" name="prizes" value={prizesValue} />
      <input type="hidden" name="ticket_types" value={ticketTypesValue} />
      <input type="hidden" name="row_seating" value={rowSeatingValue} />
      <input type="hidden" name="table_seating" value={tableSeatingValue} />
      <input type="hidden" name="table_names_json" value={tableNamesValue} />

      <section style={styles.subscriptionCard}>
        <div>
          <div style={styles.subscriptionEyebrow}>Subscription access</div>

          <h2 style={styles.subscriptionTitle}>{tierLabel} plan</h2>

          <p style={styles.subscriptionText}>
            Events are available on all plans. Custom campaign images are
            available on Professional and Foundation plans.
          </p>
        </div>

        <div
          style={{
            ...styles.subscriptionPill,
            ...(customImagesAllowed
              ? styles.subscriptionPillAllowed
              : styles.subscriptionPillLocked),
          }}
        >
          {customImagesAllowed ? "Custom images enabled" : "Default images only"}
        </div>
      </section>

      {!customImagesAllowed ? (
        <section style={styles.upgradeNotice}>
          <div style={styles.upgradeIcon}>★</div>

          <div>
            <strong style={styles.upgradeTitle}>
              Upgrade to use custom event images
            </strong>

            <p style={styles.upgradeText}>
              Community campaigns use the SO default event image. Upgrade to
              Professional to upload your own campaign images and unlock more
              premium branding controls.
            </p>
          </div>

          <Link href="/admin/billing" style={styles.upgradeButton}>
            View plans
          </Link>
        </section>
      ) : null}

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Events builder</div>

          <div style={styles.heroTitleRow}>
            <h1 style={styles.heroTitle}>
              {title.trim() ? title : "Build a premium event"}
            </h1>

            <div style={styles.statusPill}>{status}</div>
          </div>

          <p style={styles.heroSlug}>/e/{slug.trim() ? slug : "event-slug"}</p>

          <p style={styles.heroDescription}>
            Create the public event page, add ticket types, set event timing,
            upload a polished campaign image and prepare seating or tables in one
            guided setup flow.
          </p>

          <p style={styles.heroUseCase}>
            Ideal for galas, dinners, ceilidhs, concerts, race nights, charity
            evenings and seated fundraising events.
          </p>

          <div style={styles.heroMetricGrid}>
            <HeroMetric label="Event type" value={formatEventType(eventType)} />

            <HeroMetric label="Tickets" value={`${activeTicketCount} active`} />

            <HeroMetric
              label="From"
              value={
                lowestTicketPrice === null
                  ? "Not priced"
                  : formatPreviewMoney(lowestTicketPrice, currency)
              }
            />

            <HeroMetric
              label="Capacity"
              value={seatingPreview > 0 ? seatingPreview : "Not set"}
            />
          </div>
        </div>

        <div style={styles.previewShell}>
          <div style={styles.previewBadge}>Public preview</div>

          <div style={styles.previewImageWrap}>
            {imageUrl && customImagesAllowed ? (
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
              {title.trim() ? title : "Your event"}
            </div>

            <div style={styles.previewText}>
              {description.trim()
                ? description.trim().slice(0, 96)
                : "A short public summary of your event will appear here."}
              {description.trim().length > 96 ? "…" : ""}
            </div>

            <div style={styles.previewMetaGrid}>
              <span style={styles.previewMetaItem}>
                {formatEventType(eventType)}
              </span>

              <span style={styles.previewMetaItem}>
                {formatDatePreview(startsAt)}
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
        <SummaryCard label="Event type" value={formatEventType(eventType)} />

        <SummaryCard label="Ticket types" value={`${activeTicketCount} active`} />

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
          value={startsAt ? "Scheduled" : "Not scheduled"}
        />

        <SummaryCard label="Public prizes" value={prizeText(publicPrizesCount)} />
      </section>

      <section style={styles.readinessGrid}>
        <ReadinessCard eyebrow="Campaign readiness" title="Before publishing">
          <CheckItem done={Boolean(title.trim())}>Add event title</CheckItem>
          <CheckItem done={Boolean(slug.trim())}>Confirm public slug</CheckItem>
          <CheckItem done={Boolean(description.trim())}>Add description</CheckItem>
          <CheckItem done={Boolean(location.trim())}>Add location</CheckItem>
          <CheckItem done={Boolean(startsAt)}>Schedule start time</CheckItem>
          <CheckItem done={activeTicketCount > 0}>Add active ticket type</CheckItem>
        </ReadinessCard>

        <ReadinessCard eyebrow="Ticket preview" title="Tickets">
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
            label="Ticket limit"
            value={
              totalTicketCapacity > 0
                ? `${totalTicketCapacity} from ticket types`
                : "No ticket limit set"
            }
          />
        </ReadinessCard>

        <ReadinessCard
          eyebrow="Event setup preview"
          title={formatEventType(eventType)}
        >
          <PreviewLine
            label="Capacity"
            value={seatingPreview > 0 ? seatingPreview : "Not set"}
          />

          <PreviewLine label="Starts" value={formatDatePreview(startsAt)} />

          <PreviewLine label="Prizes" value={prizeText(publicPrizesCount)} />
        </ReadinessCard>
      </section>

      <SectionCard
        number="01"
        title="Event details"
        description="Set the public title, URL, description, image, location and timing."
        badge={startsAt ? "Event scheduled" : undefined}
        tone="default"
      >
        <div style={styles.twoCol}>
          <Field label="Title">
            <input
              name="title"
              required
              value={title}
              onChange={(event) => updateTitle(event.target.value)}
              style={styles.input}
              placeholder="Summer Gala Night"
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
              placeholder="summer-gala-night"
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
            placeholder="Describe the event..."
          />
        </Field>
                <div style={styles.mediaBox}>
          <div style={styles.mediaControls}>
            <h3 style={styles.panelTitle}>Event image</h3>

            <p style={styles.sectionText}>
              Upload or replace the public event image, then choose the focal
              point for wide banners and cards.
            </p>

            <ImageFocusUploadField
              currentImageUrl={customImagesAllowed ? imageUrl : ""}
              currentFocusX={imageFocusX}
              currentFocusY={imageFocusY}
              label="Event image upload"
              previewAlt={title.trim() || "Event image preview"}
              subscriptionTier={subscriptionTier}
              customImagesAllowed={customImagesAllowed}
              onImageUrlChange={(url) => {
                if (customImagesAllowed) setImageUrl(url);
              }}
              onFocusXChange={(value) => setImageFocusX(cleanFocus(value))}
              onFocusYChange={(value) => setImageFocusY(cleanFocus(value))}
            />
          </div>

          <div style={styles.previewBox}>
            {imageUrl && customImagesAllowed ? (
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
          <Field label="Location">
            <input
              name="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Venue, city or online"
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
              placeholder="Leave blank for unlimited"
              style={styles.input}
            />
          </Field>
        </div>

        <div style={styles.twoCol}>
          <Field label="Starts at">
            <input
              name="starts_at"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              style={styles.input}
            />
          </Field>

          <Field label="Ends at">
            <input
              name="ends_at"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              style={styles.input}
            />
          </Field>
        </div>

        <div style={styles.previewInfoCard}>
          <div style={styles.previewInfoLabel}>Event preview</div>

          <div style={styles.previewInfoValue}>
            {formatDatePreview(startsAt)}
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

          <Field label="Type">
            <select
              name="event_type"
              value={eventType}
              onChange={(event) => setEventType(event.target.value as EventType)}
              style={styles.input}
            >
              <option value="general_admission">General admission</option>
              <option value="reserved_seating">Reserved seating</option>
              <option value="tables">Tables</option>
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
        title="Tickets & prices"
        description="Add public ticket choices now. You can edit them after creation."
        badge={`${activeTicketCount} active`}
        tone="tickets"
      >
        <div style={styles.sectionHeaderInner}>
          <div>
            <h3 style={styles.panelTitle}>Ticket types</h3>

            <p style={styles.sectionText}>
              Create ticket names, prices, limits and public descriptions.
            </p>
          </div>

          <button type="button" onClick={addTicketType} style={styles.lightButton}>
            + Add ticket type
          </button>
        </div>

        <div style={styles.list}>
          {ticketTypes.map((ticketType, index) => (
            <div key={ticketType.id} style={styles.editTicketCard}>
              <div style={styles.rowHeader}>
                <strong>Ticket type {index + 1}</strong>

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
                <Field label="Ticket name">
                  <input
                    value={ticketType.name}
                    onChange={(event) =>
                      updateTicketType(ticketType.id, {
                        name: event.target.value,
                      })
                    }
                    placeholder="Standard"
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
                    placeholder="Optional description"
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

                <Field label="Ticket limit">
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
                Delete this ticket type
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
          badge={reservedSeatsPreview ? `${reservedSeatsPreview} seats` : "Optional"}
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
          title="Table seating"
          description="Generate table seats during creation and optionally name tables."
          badge={tableSeatsPreview ? `${tableSeatsPreview} places` : "Optional"}
          tone="seating"
        >
          <div style={styles.twoPanel}>
            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Generate table seating</h3>

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

                <div style={styles.twoCol}>
                  <Field label="Number of tables">
                    <input
                      value={tableCount}
                      onChange={(event) => setTableCount(event.target.value)}
                      type="number"
                      min="1"
                      placeholder="10"
                      style={styles.input}
                    />
                  </Field>

                  <Field label="Seats per table">
                    <input
                      value={tableSeatsPerTable}
                      onChange={(event) =>
                        setTableSeatsPerTable(event.target.value)
                      }
                      type="number"
                      min="1"
                      placeholder="8"
                      style={styles.input}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div style={styles.panel}>
              <h3 style={styles.panelTitle}>Table seating summary</h3>

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
            </div>
          </div>

          <div style={{ ...styles.panel, marginTop: 16 }}>
            <h3 style={styles.panelTitle}>Table names optional</h3>

            <p style={styles.sectionText}>
              Add friendly names for tables before they go public. These save as
              table names automatically.
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
                      placeholder="e.g. VIP, Sponsors, Smith Family"
                      style={styles.input}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      ) : null}
      
  .new-event-form details > summary::-webkit-details-marker {
    display: none;
  }

  @media (max-width: 760px) {
    .new-event-form {
      width: 100% !important;
