import { createHash } from "crypto";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { query } from "@/lib/db";
import { updateGuestMenuChoiceAction } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    saved?: string;
    error?: string;
  };
};

type MenuOption = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  isActive?: boolean;
  is_active?: boolean;
};

type GuestUpdateRow = {
  token_id: string;
  event_id: string;
  event_title: string;
  event_location: string | null;
  event_starts_at: string | null;
  menu_options: MenuOption[] | null;
  ask_dietary_requirements: boolean | null;
  ask_menu_choice: boolean | null;
  customer_email: string;
  buyer_name: string | null;
  guest_name: string | null;
  menu_choice: string | null;
  dietary_requirements: string | null;
  ticket_label: string | null;
  ticket_type_name: string | null;
  table_number: string | null;
  row_label: string | null;
  seat_number: string | null;
  expires_at: string;
  submitted_at: string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function ticketLabel(row: GuestUpdateRow) {
  return (
    String(row.ticket_label || "").trim() ||
    String(row.ticket_type_name || "").trim() ||
    "Event ticket"
  );
}

function seatLabel(row: GuestUpdateRow) {
  if (row.table_number) {
    return `Table ${row.table_number}${
      row.seat_number ? `, Seat ${row.seat_number}` : ""
    }`;
  }

  if (row.row_label || row.seat_number) {
    return `Row ${row.row_label || "?"}, Seat ${row.seat_number || "?"}`;
  }

  return "General admission";
}

function activeMenuOptions(options: MenuOption[] | null | undefined) {
  return (options || [])
    .filter((option) => option.isActive ?? option.is_active ?? true)
    .map((option) => ({
      label: String(option.name || option.title || "").trim(),
      description: String(option.description || "").trim(),
    }))
    .filter((option) => option.label);
}

async function getGuestUpdate(token: string) {
  const tokenHash = hashToken(token);

  const rows = await query<GuestUpdateRow>(
    `
      select
        egut.id as token_id,
        e.id as event_id,
        e.title as event_title,
        e.location as event_location,
        e.starts_at as event_starts_at,
        e.menu_options,
        e.ask_dietary_requirements,
        e.ask_menu_choice,
        egut.customer_email,
        eo.customer_name as buyer_name,
        coalesce(eoi.guest_name, egut.guest_name, eo.customer_name) as guest_name,
        eoi.menu_choice,
        eoi.dietary_requirements,
        eoi.label as ticket_label,
        ett.name as ticket_type_name,
        es.table_number,
        es.row_label,
        es.seat_number,
        egut.expires_at,
        egut.submitted_at
      from event_guest_update_tokens egut
      inner join events e
        on e.id = egut.event_id
      inner join event_orders eo
        on eo.id = egut.event_order_id
      inner join event_order_items eoi
        on eoi.id = egut.event_order_item_id
       and eoi.order_id = eo.id
      left join event_seats es
        on es.id = eoi.seat_id
      left join event_ticket_types ett
        on ett.id = eoi.ticket_type_id
      where egut.token_hash = $1
        and egut.expires_at > now()
        and eo.status = 'paid'
        and e.tenant_slug = egut.tenant_slug
      limit 1
    `,
    [tokenHash],
  );

  return rows[0] || null;
}

export default async function GuestMenuUpdatePage({
  params,
  searchParams,
}: PageProps) {
  const token = String(params.token || "").trim();

  if (!token || token === "invalid") {
    return <InvalidTokenPage />;
  }

  const guestUpdate = await getGuestUpdate(token);

  if (!guestUpdate) {
    return <InvalidTokenPage />;
  }

  const menuOptions = activeMenuOptions(guestUpdate.menu_options);
  const saved = searchParams?.saved === "1";
  const hasSubmitted = Boolean(guestUpdate.submitted_at);

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.topBar}>
          <div style={styles.brandMark}>SO</div>
          <div>
            <div style={styles.eyebrow}>Secure guest update</div>
            <h1 style={styles.title}>Confirm your menu choice</h1>
          </div>
        </div>

        {saved ? (
          <div style={styles.successBox}>
            Thank you — your guest and catering details have been updated.
          </div>
        ) : null}

        {hasSubmitted && !saved ? (
          <div style={styles.infoBox}>
            This link has already been used, but you can still update the
            details again until it expires.
          </div>
        ) : null}

        <section style={styles.eventCard}>
          <h2 style={styles.eventTitle}>{guestUpdate.event_title}</h2>

          <div style={styles.detailGrid}>
            <InfoTile label="Event date" value={formatDate(guestUpdate.event_starts_at)} />
            <InfoTile
              label="Location"
              value={guestUpdate.event_location || "Not set"}
            />
            <InfoTile label="Ticket" value={ticketLabel(guestUpdate)} />
            <InfoTile label="Seat / table" value={seatLabel(guestUpdate)} />
            <InfoTile
              label="Link expires"
              value={formatDate(guestUpdate.expires_at)}
            />
            <InfoTile
              label="Email"
              value={guestUpdate.customer_email}
            />
          </div>
        </section>

        <form action={updateGuestMenuChoiceAction} style={styles.form}>
          <input type="hidden" name="token" value={token} />

          <Field label="Guest name">
            <input
              name="guest_name"
              defaultValue={guestUpdate.guest_name || ""}
              placeholder="Guest name"
              style={styles.input}
            />
          </Field>

          {guestUpdate.ask_menu_choice === false ? null : (
            <Field label="Menu choice">
              {menuOptions.length > 0 ? (
                <select
                  name="menu_choice"
                  defaultValue={guestUpdate.menu_choice || ""}
                  style={styles.input}
                >
                  <option value="">Please select</option>
                  {menuOptions.map((option, index) => (
                    <option key={`${option.label}-${index}`} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="menu_choice"
                  defaultValue={guestUpdate.menu_choice || ""}
                  placeholder="Menu choice"
                  style={styles.input}
                />
              )}

              {menuOptions.length > 0 ? (
                <div style={styles.menuHelp}>
                  {menuOptions.map((option, index) =>
                    option.description ? (
                      <p key={`${option.label}-help-${index}`} style={styles.menuHelpText}>
                        <strong>{option.label}:</strong> {option.description}
                      </p>
                    ) : null,
                  )}
                </div>
              ) : null}
            </Field>
          )}

          {guestUpdate.ask_dietary_requirements === false ? null : (
            <Field label="Dietary requirements">
              <textarea
                name="dietary_requirements"
                defaultValue={guestUpdate.dietary_requirements || ""}
                placeholder="None, vegetarian, vegan, gluten free, allergies..."
                rows={4}
                style={styles.textarea}
              />
            </Field>
          )}

          <button type="submit" style={styles.primaryButton}>
            Save guest details
          </button>
        </form>

        <p style={styles.smallPrint}>
          This secure link only updates guest, menu and dietary information. It
          does not alter the booking, payment, ticket price or event order.
        </p>
      </section>
    </main>
  );
}

function InvalidTokenPage() {
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.topBar}>
          <div style={styles.brandMark}>SO</div>
          <div>
            <div style={styles.eyebrow}>Secure guest update</div>
            <h1 style={styles.title}>This link is not available</h1>
          </div>
        </div>

        <div style={styles.errorBox}>
          This menu update link is invalid, expired, or no longer connected to a
          paid booking.
        </div>

        <p style={styles.smallPrint}>
          Please contact the event organiser if you need to update your menu
          choice or dietary requirements.
        </p>

        <Link href="/" style={styles.secondaryLink}>
          Return home
        </Link>
      </section>
    </main>
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

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.infoTile}>
      <span style={styles.infoTileLabel}>{label}</span>
      <strong style={styles.infoTileValue}>{value}</strong>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px 14px 56px",
    background:
      "radial-gradient(circle at top left, rgba(59,130,246,0.16), transparent 32%), linear-gradient(180deg, #eff6ff 0%, #f8fafc 44%, #ffffff 100%)",
    boxSizing: "border-box",
  },
  shell: {
    width: "100%",
    maxWidth: 760,
    margin: "0 auto",
    display: "grid",
    gap: 16,
    padding: "clamp(18px, 4vw, 26px)",
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 24px 60px rgba(15,23,42,0.12)",
    boxSizing: "border-box",
  },
  topBar: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },
  brandMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    flex: "0 0 auto",
    background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
    color: "#ffffff",
    fontWeight: 950,
    letterSpacing: "-0.08em",
    boxShadow: "0 12px 26px rgba(29,78,216,0.24)",
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  title: {
    margin: "4px 0 0",
    color: "#0f172a",
    fontSize: "clamp(30px, 8vw, 44px)",
    lineHeight: 1.04,
    letterSpacing: "-0.055em",
  },
  successBox: {
    padding: 14,
    borderRadius: 18,
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontWeight: 900,
    lineHeight: 1.45,
  },
  infoBox: {
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e40af",
    fontWeight: 850,
    lineHeight: 1.45,
  },
  errorBox: {
    padding: 14,
    borderRadius: 18,
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 900,
    lineHeight: 1.45,
  },
  eventCard: {
    padding: 16,
    borderRadius: 22,
    background:
      "linear-gradient(135deg, #f8fafc 0%, #ffffff 52%, #eff6ff 100%)",
    border: "1px solid #e2e8f0",
  },
  eventTitle: {
    margin: "0 0 14px",
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    overflowWrap: "anywhere",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
    gap: 10,
  },
  infoTile: {
    padding: 12,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },
  infoTileLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 5,
  },
  infoTileValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 13,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  form: {
    display: "grid",
    gap: 14,
  },
  field: {
    display: "grid",
    gap: 7,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 48,
    padding: "12px 13px",
    borderRadius: 15,
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    background: "#ffffff",
    fontSize: 16,
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "12px 13px",
    borderRadius: 15,
    border: "1px solid #cbd5e1",
    color: "#0f172a",
    background: "#ffffff",
    fontSize: 16,
    resize: "vertical",
    boxSizing: "border-box",
  },
  menuHelp: {
    display: "grid",
    gap: 6,
    padding: 12,
    borderRadius: 15,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  menuHelpText: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.45,
  },
  primaryButton: {
    minHeight: 50,
    padding: "14px 18px",
    borderRadius: 999,
    border: "none",
    background: "#1683f8",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(22,131,248,0.2)",
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    textDecoration: "none",
  },
  smallPrint: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },
};
