import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  checkSubscriptionCapability,
  getEventFundraisingAddOnsUpgradeMessage,
  getMultipleEventFundraisingAddOnsUpgradeMessage,
  getTenantEventFundraisingAddOnLimits,
  normaliseSubscriptionTier,
} from "@/lib/subscription-capabilities";
import {
  getEventById,
  updateEvent,
  type EventFundraisingAddOn,
} from "../../../../../../api/_lib/events-repo";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    saved?: string;
    error?: string;
  };
};

type TenantSettingsLike = {
  subscription_tier?: string | null;
  subscription_status?: string | null;
  platform_owner_bypass?: boolean | null;
};

const HEADS_OR_TAILS_ID = "event-addon-heads-or-tails";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  return cleanText(value) || "";
}

function poundsToCents(value: FormDataEntryValue | null) {
  const number = Number(String(value || "0").replace(",", "."));

  if (!Number.isFinite(number) || number < 0) {
    return 0;
  }

  return Math.round(number * 100);
}

function moneyFromCents(cents: number | null | undefined) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function positiveIntegerOrNull(value: FormDataEntryValue | null) {
  const clean = cleanText(value);

  if (!clean) return null;

  const number = Number(clean);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return Math.floor(number);
}

function formatMoney(cents: number | null | undefined, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
    }).format(Number(cents || 0) / 100);
  } catch {
    return `${moneyFromCents(cents)} ${currency || "GBP"}`;
  }
}

function getHeadsOrTailsAddOn(addOns: EventFundraisingAddOn[]) {
  return (
    addOns.find((addOn) => addOn.type === "heads_or_tails") || {
      id: HEADS_OR_TAILS_ID,
      type: "heads_or_tails" as const,
      enabled: false,
      title: "Heads or Tails",
      description:
        "Join our Heads or Tails fundraiser on the night and keep playing until one winner remains.",
      instructions:
        "Choose heads or tails each round. Stay standing if you are correct. The last person standing wins.",
      prizeTitle: "",
      entryPriceCents: 0,
      collectAtCheckout: false,
      maxEntriesPerBooking: 1,
      sortOrder: 0,
    }
  );
}

function buildHeadsOrTailsAddOn(formData: FormData): EventFundraisingAddOn {
  return {
    id: HEADS_OR_TAILS_ID,
    type: "heads_or_tails",
    enabled: String(formData.get("enabled") || "") === "true",
    title: cleanText(formData.get("title")) || "Heads or Tails",
    description: cleanOptionalText(formData.get("description")),
    instructions: cleanOptionalText(formData.get("instructions")),
    prizeTitle: cleanOptionalText(formData.get("prize_title")),
    entryPriceCents: poundsToCents(formData.get("entry_price")),
    collectAtCheckout:
      String(formData.get("collect_at_checkout") || "") === "true",
    maxEntriesPerBooking: positiveIntegerOrNull(
      formData.get("max_entries_per_booking"),
    ),
    sortOrder: 0,
  };
}

async function requireEventAccess(eventId: string) {
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const event = await getEventById(eventId);

  if (!event) {
    notFound();
  }

  const tenantSlug = await getTenantSlugFromHeaders();

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (
    !tenantSlug ||
    event.tenant_slug !== tenantSlug ||
    !sessionTenantSlugs.includes(tenantSlug)
  ) {
    redirect("/admin/login?error=tenant_access_denied");
  }

  return event;
}

async function saveHeadsOrTailsAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));

  if (!eventId) {
    redirect("/admin/events?error=missing-event");
  }

  const event = await requireEventAccess(eventId);
  const tenantSettings = (await getTenantSettings(
    event.tenant_slug,
  )) as TenantSettingsLike | null;

  const addOnsCapability = checkSubscriptionCapability(
    tenantSettings,
    "event_fundraising_addons",
  );

  if (!addOnsCapability.allowed) {
    redirect(`/admin/events/${eventId}/addons?error=upgrade-required`);
  }

  const limits = getTenantEventFundraisingAddOnLimits(tenantSettings);

  if (!limits.allowedTypes.includes("heads_or_tails")) {
    redirect(`/admin/events/${eventId}/addons?error=addon-not-allowed`);
  }

  const currentAddOns = event.event_addons_json || [];
  const nonHeadsOrTailsAddOns = currentAddOns.filter(
    (addOn) => addOn.type !== "heads_or_tails",
  );

  const nextHeadsOrTailsAddOn = buildHeadsOrTailsAddOn(formData);

  const nextEnabledAddOnCount = [
    ...nonHeadsOrTailsAddOns,
    nextHeadsOrTailsAddOn,
  ].filter((addOn) => addOn.enabled).length;

  if (nextEnabledAddOnCount > limits.maxAddOnsPerEvent) {
    redirect(`/admin/events/${eventId}/addons?error=multiple-upgrade-required`);
  }

  await updateEvent(eventId, {
    eventAddOnsJson: [...nonHeadsOrTailsAddOns, nextHeadsOrTailsAddOn],
  });

  redirect(`/admin/events/${eventId}/addons?saved=heads-or-tails`);
}

export default async function EventFundraisingAddOnsPage({
  params,
  searchParams,
}: PageProps) {
  const event = await requireEventAccess(params.id);
  const tenantSettings = (await getTenantSettings(
    event.tenant_slug,
  )) as TenantSettingsLike | null;

  const tier = normaliseSubscriptionTier(tenantSettings?.subscription_tier);
  const addOnsCapability = checkSubscriptionCapability(
    tenantSettings,
    "event_fundraising_addons",
  );
  const multipleAddOnsCapability = checkSubscriptionCapability(
    tenantSettings,
    "multiple_event_fundraising_addons",
  );
  const limits = getTenantEventFundraisingAddOnLimits(tenantSettings);

  const canManageAddOns = addOnsCapability.allowed;
  const canUseMultipleAddOns = multipleAddOnsCapability.allowed;
  const headsOrTailsAddOn = getHeadsOrTailsAddOn(event.event_addons_json || []);

  const enabledAddOns = (event.event_addons_json || []).filter(
    (addOn) => addOn.enabled,
  );

  const upgradeRequired = searchParams?.error === "upgrade-required";
  const multipleUpgradeRequired =
    searchParams?.error === "multiple-upgrade-required";
  const addOnNotAllowed = searchParams?.error === "addon-not-allowed";

  return (
    <main className="event-addons-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Events add-ons</div>

          <h1 className="so-brand-heading" style={styles.title}>
            Event Fundraising Add-ons
          </h1>

          <p style={styles.heroText}>
            Add live fundraising tools to this event. Heads or Tails is the
            first add-on in this section and is designed for ceilidhs, quiz
            nights, dinners, auctions and gala events.
          </p>

          <div style={styles.heroMetaGrid}>
            <HeroMetric label="Event" value={event.title} />
            <HeroMetric
              label="Plan"
              value={
                tier === "foundation"
                  ? "Foundation"
                  : tier === "professional"
                    ? "Professional"
                    : "Community"
              }
            />
            <HeroMetric
              label="Add-ons enabled"
              value={`${enabledAddOns.length} / ${
                Number.isFinite(limits.maxAddOnsPerEvent)
                  ? limits.maxAddOnsPerEvent
                  : "Unlimited"
              }`}
            />
          </div>
        </div>

        <div style={styles.heroPanel}>
          <div style={styles.heroPanelEyebrow}>Current status</div>
          <strong style={styles.heroPanelTitle}>
            {headsOrTailsAddOn.enabled
              ? "Heads or Tails is enabled"
              : "Heads or Tails is not enabled"}
          </strong>
          <span style={styles.heroPanelText}>
            {headsOrTailsAddOn.collectAtCheckout
              ? `Collecting ${formatMoney(
                  headsOrTailsAddOn.entryPriceCents,
                  event.currency,
                )} entries at checkout.`
              : "Checkout collection is currently off."}
          </span>
        </div>
      </section>

      <section style={styles.topActions}>
        <Link
          href={`/admin/events/${encodeURIComponent(event.id)}`}
          style={styles.secondaryButton}
        >
          ← Back to event editor
        </Link>

        <Link
          href="/admin/settings/billing"
          style={styles.secondaryButton}
        >
          Billing &amp; plan
        </Link>
      </section>

      {searchParams?.saved ? (
        <div style={styles.successBox}>Event add-on settings saved.</div>
      ) : null}

      {upgradeRequired ? (
        <UpgradeBanner
          title="Event fundraising add-ons are locked."
          text={getEventFundraisingAddOnsUpgradeMessage()}
        />
      ) : null}

      {multipleUpgradeRequired ? (
        <UpgradeBanner
          title="Multiple event add-ons are locked."
          text={getMultipleEventFundraisingAddOnsUpgradeMessage()}
        />
      ) : null}

      {addOnNotAllowed ? (
        <UpgradeBanner
          title="This add-on is not available."
          text="This event add-on is not available on the current tenant plan."
        />
      ) : null}

      <section style={styles.summaryGrid}>
        <SummaryCard
          label="Community"
          value="No add-ons"
          detail="Community keeps events simple and focused."
        />
        <SummaryCard
          label="Professional"
          value="Heads or Tails"
          detail="One event fundraising add-on per event."
        />
        <SummaryCard
          label="Foundation"
          value="Multiple add-ons"
          detail="Foundation can support several live fundraising add-ons per event."
        />
      </section>

      {!canManageAddOns ? (
        <section style={styles.lockedPanel}>
          <div style={styles.lockedEyebrow}>Professional feature</div>
          <h2 style={styles.panelTitle}>Upgrade to use Heads or Tails</h2>
          <p style={styles.sectionText}>
            {addOnsCapability.reason || getEventFundraisingAddOnsUpgradeMessage()}
          </p>
          <Link href="/admin/settings/billing" style={styles.primaryLink}>
            View billing
          </Link>
        </section>
      ) : (
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.innerEyebrow}>Heads or Tails</div>
              <h2 style={styles.panelTitle}>Live event game settings</h2>
              <p style={styles.sectionText}>
                Configure the public wording and whether entries should be
                collected during event checkout. This does not change the main
                event ticket, seating, VIP, menu or winner draw logic.
              </p>
            </div>

            <span
              style={{
                ...styles.statusPill,
                ...(headsOrTailsAddOn.enabled
                  ? styles.statusGood
                  : styles.statusNeutral),
              }}
            >
              {headsOrTailsAddOn.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <form action={saveHeadsOrTailsAction} style={styles.form}>
            <input type="hidden" name="event_id" value={event.id} />

            <div style={styles.twoCol}>
              <Field label="Enable Heads or Tails">
                <select
                  name="enabled"
                  defaultValue={headsOrTailsAddOn.enabled ? "true" : "false"}
                  style={styles.input}
                >
                  <option value="false">No, keep disabled</option>
                  <option value="true">Yes, enable for this event</option>
                </select>
              </Field>

              <Field label="Collect entries at checkout">
                <select
                  name="collect_at_checkout"
                  defaultValue={
                    headsOrTailsAddOn.collectAtCheckout ? "true" : "false"
                  }
                  style={styles.input}
                >
                  <option value="false">No, collect on the night</option>
                  <option value="true">Yes, collect during checkout</option>
                </select>
              </Field>
            </div>

            <Field label="Display title">
              <input
                name="title"
                defaultValue={headsOrTailsAddOn.title || "Heads or Tails"}
                style={styles.input}
              />
            </Field>

            <Field label="Short description">
              <textarea
                name="description"
                rows={3}
                defaultValue={headsOrTailsAddOn.description || ""}
                placeholder="Join our Heads or Tails fundraiser on the night and keep playing until one winner remains."
                style={styles.textarea}
              />
            </Field>

            <Field label="How it works / instructions">
              <textarea
                name="instructions"
                rows={4}
                defaultValue={headsOrTailsAddOn.instructions || ""}
                placeholder="Choose heads or tails each round. Stay standing if you are correct. The last person standing wins."
                style={styles.textarea}
              />
            </Field>

            <div style={styles.threeCol}>
              <Field label="Entry price">
                <input
                  name="entry_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={moneyFromCents(
                    headsOrTailsAddOn.entryPriceCents,
                  )}
                  style={styles.input}
                />
              </Field>

              <Field label="Max entries per booking">
                <input
                  name="max_entries_per_booking"
                  type="number"
                  min="1"
                  defaultValue={headsOrTailsAddOn.maxEntriesPerBooking || 1}
                  style={styles.input}
                />
              </Field>

              <Field label="Prize title / note">
                <input
                  name="prize_title"
                  defaultValue={headsOrTailsAddOn.prizeTitle || ""}
                  placeholder="Cash prize, hamper, sponsored prize..."
                  style={styles.input}
                />
              </Field>
            </div>

            {!canUseMultipleAddOns ? (
              <div style={styles.professionalNotice}>
                <strong>Professional add-on limit</strong>
                <span>
                  This tenant can use one event fundraising add-on per event.
                  Foundation unlocks multiple add-ons per event.
                </span>
              </div>
            ) : (
              <div style={styles.foundationNotice}>
                <strong>Foundation add-ons enabled</strong>
                <span>
                  This tenant can support multiple event fundraising add-ons per
                  event as more add-on types are introduced.
                </span>
              </div>
            )}

            <section style={styles.submitBar}>
              <div>
                <strong style={{ color: "#0f172a" }}>
                  Save Heads or Tails settings
                </strong>
                <div style={styles.mutedSmall}>
                  Saves to this event only. Checkout/public display wiring comes
                  in the next phase.
                </div>
              </div>

              <button type="submit" style={styles.primaryButton}>
                Save add-on settings
              </button>
            </section>
          </form>
        </section>
      )}
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

function HeroMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={styles.heroMetric}>
      <span style={styles.heroMetricLabel}>{label}</span>
      <strong style={styles.heroMetricValue}>{value}</strong>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <article style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
      <p style={styles.summaryDetail}>{detail}</p>
    </article>
  );
}

function UpgradeBanner({ title, text }: { title: string; text: string }) {
  return (
    <section style={styles.upgradeBanner}>
      <div style={styles.upgradeEyebrow}>Upgrade required</div>
      <h2 style={styles.upgradeTitle}>{title}</h2>
      <p style={styles.upgradeText}>{text}</p>
      <Link href="/admin/settings/billing" style={styles.primaryLink}>
        View billing
      </Link>
    </section>
  );
}

const responsiveStyles = `
@media (max-width: 900px) {
  .event-addons-page * {
    box-sizing: border-box !important;
  }

  .event-addons-page {
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }
}

@media (max-width: 760px) {
  .event-addons-page .heroMetaGrid,
  .event-addons-page .summaryGrid,
  .event-addons-page .twoCol,
  .event-addons-page .threeCol {
    grid-template-columns: 1fr !important;
  }

  .event-addons-page .hero,
  .event-addons-page .topActions,
  .event-addons-page .panelHeader,
  .event-addons-page .submitBar {
    display: grid !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  .event-addons-page .primaryButton,
  .event-addons-page .primaryLink,
  .event-addons-page .secondaryButton {
    width: 100% !important;
    justify-content: center !important;
    text-align: center !important;
  }
}

@media (max-width: 520px) {
  .event-addons-page {
    padding: 18px 12px 44px !important;
  }

  .event-addons-page .hero,
  .event-addons-page .panel,
  .event-addons-page .lockedPanel,
  .event-addons-page .upgradeBanner {
    border-radius: 22px !important;
    padding: 16px !important;
  }

  .event-addons-page .title {
    font-size: clamp(32px, 10vw, 42px) !important;
  }

  .event-addons-page .input,
  .event-addons-page .textarea {
    font-size: 16px !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "28px 16px 56px",
    background: "#f8fafc",
    minHeight: "100vh",
    overflowX: "hidden",
    boxSizing: "border-box",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(260px, 0.85fr)",
    gap: 18,
    alignItems: "stretch",
    padding: "clamp(20px, 4vw, 28px)",
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(245,158,11,0.24), transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 54%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 16,
    boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
    overflow: "hidden",
  },
  heroContent: {
    minWidth: 0,
  },
  eyebrow: {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 12,
  },
  title: {
    margin: 0,
    fontSize: "clamp(36px, 5vw, 54px)",
    lineHeight: 1.02,
    letterSpacing: "-0.06em",
    overflowWrap: "anywhere",
  },
  heroText: {
    margin: "14px 0 0",
    color: "#dbeafe",
    lineHeight: 1.65,
    maxWidth: 760,
    fontSize: 15,
  },
  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 22,
  },
  heroMetric: {
    padding: "13px 14px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.16)",
    minWidth: 0,
  },
  heroMetricLabel: {
    display: "block",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 4,
  },
  heroMetricValue: {
    display: "block",
    color: "#ffffff",
    fontSize: 17,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },
  heroPanel: {
    display: "grid",
    alignContent: "center",
    gap: 10,
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.18)",
  },
  heroPanelEyebrow: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  heroPanelTitle: {
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 1.1,
    letterSpacing: "-0.04em",
  },
  heroPanelText: {
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 800,
  },
  topActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "12px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "1px solid #1683f8",
    textDecoration: "none",
    fontWeight: 950,
    boxShadow: "0 10px 22px rgba(22,131,248,0.22)",
  },
  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
  },
  successBox: {
    padding: 13,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    borderRadius: 16,
    marginBottom: 16,
    fontWeight: 950,
  },
  upgradeBanner: {
    marginBottom: 16,
    padding: "clamp(18px, 4vw, 24px)",
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #fef3c7 0%, #ffffff 52%, #eff6ff 100%)",
    border: "1px solid #fde68a",
    boxShadow: "0 16px 38px rgba(15,23,42,0.08)",
  },
  upgradeEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  upgradeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(24px, 5vw, 32px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },
  upgradeText: {
    margin: "10px 0 16px",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 820,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    minWidth: 0,
  },
  summaryLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },
  summaryValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  summaryDetail: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },
  lockedPanel: {
    padding: 20,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 58%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 28px rgba(15,23,42,0.055)",
  },
  lockedEyebrow: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  panel: {
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    background:
      "linear-gradient(135deg, #ffffff 0%, #f8fafc 56%, #eff6ff 100%)",
    border: "1px solid #dbeafe",
    boxShadow: "0 8px 28px rgba(15,23,42,0.055)",
    minWidth: 0,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  innerEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },
  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: "clamp(23px, 5vw, 30px)",
    letterSpacing: "-0.045em",
    lineHeight: 1.05,
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.55,
    maxWidth: 820,
  },
  statusPill: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  statusGood: {
    background: "#dcfce7",
    color: "#166534",
    borderColor: "#bbf7d0",
  },
  statusNeutral: {
    background: "#f8fafc",
    color: "#64748b",
    borderColor: "#cbd5e1",
  },
  form: {
    display: "grid",
    gap: 13,
    minWidth: 0,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  threeCol: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  field: {
    display: "grid",
    gap: 6,
    minWidth: 0,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    boxSizing: "border-box",
    minWidth: 0,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 13,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    resize: "vertical",
    boxSizing: "border-box",
    minWidth: 0,
  },
  professionalNotice: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  foundationNotice: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  submitBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    padding: 16,
    borderRadius: 20,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },
  primaryButton: {
    width: "fit-content",
    minHeight: 44,
    padding: "13px 18px",
    border: "none",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 20px rgba(22,131,248,0.18)",
  },
  mutedSmall: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 3,
  },
};
