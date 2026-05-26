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

type ReadinessItem = {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warning" | "neutral";
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

function readinessToneStyle(tone: ReadinessItem["tone"]) {
  if (tone === "good") {
    return {
      dot: styles.readinessDotGood,
      card: styles.readinessItemGood,
    };
  }

  if (tone === "warning") {
    return {
      dot: styles.readinessDotWarning,
      card: styles.readinessItemWarning,
    };
  }

  return {
    dot: styles.readinessDotNeutral,
    card: styles.readinessItemNeutral,
  };
}

function buildHeadsOrTailsReadiness(input: {
  addOn: EventFundraisingAddOn;
  currency: string;
}): ReadinessItem[] {
  const addOn = input.addOn;
  const enabled = Boolean(addOn.enabled);
  const collectAtCheckout = Boolean(addOn.collectAtCheckout);
  const entryPriceCents = Number(addOn.entryPriceCents || 0);
  const hasPrice = entryPriceCents > 0;
  const hasDescription = Boolean(String(addOn.description || "").trim());
  const hasInstructions = Boolean(String(addOn.instructions || "").trim());
  const hasPrize = Boolean(String(addOn.prizeTitle || "").trim());
  const maxEntries = Number(addOn.maxEntriesPerBooking || 0);

  return [
    {
      label: "Public display",
      value: enabled ? "Ready" : "Disabled",
      detail: enabled
        ? "The public event page can show the Heads or Tails panel."
        : "Enable the add-on before it appears on the public event page.",
      tone: enabled ? "good" : "neutral",
    },
    {
      label: "Checkout collection",
      value: collectAtCheckout ? "On" : "Off",
      detail: collectAtCheckout
        ? "Supporters can add entries during event checkout."
        : "Entries are shown publicly but collected by the organiser on the night.",
      tone: collectAtCheckout ? "good" : "neutral",
    },
    {
      label: "Entry price",
      value: hasPrice
        ? formatMoney(entryPriceCents, input.currency)
        : "Missing",
      detail: hasPrice
        ? "The checkout add-on has a valid entry price."
        : "Set an entry price before using checkout collection.",
      tone: hasPrice ? "good" : collectAtCheckout ? "warning" : "neutral",
    },
    {
      label: "Booking limit",
      value: maxEntries > 0 ? `${maxEntries} per booking` : "Unlimited",
      detail:
        maxEntries > 0
          ? "The public checkout selector will cap entries at this amount."
          : "No per-booking limit is currently set.",
      tone: maxEntries > 0 ? "good" : "neutral",
    },
    {
      label: "Instructions",
      value: hasInstructions ? "Added" : "Missing",
      detail: hasInstructions
        ? "Supporters can see how the game works."
        : "Add short instructions so supporters understand the game.",
      tone: hasInstructions ? "good" : "warning",
    },
    {
      label: "Prize note",
      value: hasPrize ? "Added" : "Optional",
      detail: hasPrize
        ? "The public panel can show the prize or prize note."
        : "A prize note is optional but helps make the add-on clearer.",
      tone: hasPrize ? "good" : "neutral",
    },
    {
      label: "Description",
      value: hasDescription ? "Added" : "Missing",
      detail: hasDescription
        ? "The public panel has supporting copy."
        : "Add a short public description for a more polished display.",
      tone: hasDescription ? "good" : "warning",
    },
    {
      label: "Admin reporting",
      value: "Ready",
      detail: "Orders reporting can show add-on entries and revenue.",
      tone: "good",
    },
  ];
}

function headsOrTailsReadyForCheckout(addOn: EventFundraisingAddOn) {
  return (
    Boolean(addOn.enabled) &&
    Boolean(addOn.collectAtCheckout) &&
    Number(addOn.entryPriceCents || 0) > 0
  );
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
  const readinessItems = buildHeadsOrTailsReadiness({
    addOn: headsOrTailsAddOn,
    currency: event.currency || "GBP",
  });

  const enabledAddOns = (event.event_addons_json || []).filter(
    (addOn) => addOn.enabled,
  );

  const readyForCheckout = headsOrTailsReadyForCheckout(headsOrTailsAddOn);
  const readinessWarnings = readinessItems.filter(
    (item) => item.tone === "warning",
  ).length;

  const upgradeRequired = searchParams?.error === "upgrade-required";
  const multipleUpgradeRequired =
    searchParams?.error === "multiple-upgrade-required";
  const addOnNotAllowed = searchParams?.error === "addon-not-allowed";

  return (
    <main className="event-addons-page" style={styles.page}>
      <style>{responsiveStyles}</style>

      <section className="hero" style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.eyebrow}>Events add-ons</div>

          <h1 className="so-brand-heading title" style={styles.title}>
            Event Fundraising Add-ons
          </h1>

          <p style={styles.heroText}>
            Add live fundraising tools to this event. Heads or Tails is designed
            for ceilidhs, quiz nights, dinners, auctions and gala events, with
            public display, optional checkout collection and admin reporting.
          </p>

          <div className="heroMetaGrid" style={styles.heroMetaGrid}>
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
              ? readyForCheckout
                ? "Heads or Tails is checkout-ready"
                : "Heads or Tails is display-ready"
              : "Heads or Tails is not enabled"}
          </strong>
          <span style={styles.heroPanelText}>
            {readyForCheckout
              ? `Collecting ${formatMoney(
                  headsOrTailsAddOn.entryPriceCents,
                  event.currency,
                )} entries during checkout.`
              : headsOrTailsAddOn.enabled
                ? "The public panel can display, but checkout collection needs to be enabled with a valid price."
                : "Enable the add-on to show it on the public event page."}
          </span>
        </div>
      </section>

      <section className="topActions" style={styles.topActions}>
        <Link
          href={`/admin/events/${encodeURIComponent(event.id)}`}
          className="secondaryButton"
          style={styles.secondaryButton}
        >
          ← Back to event editor
        </Link>

        <Link
          href={`/admin/events/${encodeURIComponent(event.id)}/orders`}
          className="secondaryButton"
          style={styles.secondaryButton}
        >
          View orders & add-on reporting
        </Link>

        <Link
          href="/admin/settings/billing"
          className="secondaryButton"
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

      <section className="summaryGrid" style={styles.summaryGrid}>
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

      {canManageAddOns ? (
        <section className="readinessPanel" style={styles.readinessPanel}>
          <div style={styles.readinessHeader}>
            <div>
              <div style={styles.readinessEyebrow}>Readiness</div>
              <h2 style={styles.readinessTitle}>Heads or Tails checklist</h2>
              <p style={styles.readinessIntro}>
                A quick admin view of what is live, what is checkout-ready, and
                what would improve the public add-on experience.
              </p>
            </div>

            <span
              style={{
                ...styles.readinessStatusPill,
                ...(readyForCheckout
                  ? styles.statusGood
                  : headsOrTailsAddOn.enabled
                    ? styles.statusWarning
                    : styles.statusNeutral),
              }}
            >
              {readyForCheckout
                ? "Checkout ready"
                : headsOrTailsAddOn.enabled
                  ? `${readinessWarnings} warning${
                      readinessWarnings === 1 ? "" : "s"
                    }`
                  : "Disabled"}
            </span>
          </div>

          <div className="readinessGrid" style={styles.readinessGrid}>
            {readinessItems.map((item) => {
              const toneStyles = readinessToneStyle(item.tone);

              return (
                <article
                  key={item.label}
                  style={{
                    ...styles.readinessItem,
                    ...toneStyles.card,
                  }}
                >
                  <span
                    style={{
                      ...styles.readinessToneDot,
                      ...toneStyles.dot,
                    }}
                  />
                  <div style={styles.readinessContent}>
                    <span style={styles.readinessLabel}>{item.label}</span>
                    <strong style={styles.readinessValue}>{item.value}</strong>
                    <p style={styles.readinessDetail}>{item.detail}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={styles.readinessActions}>
            <Link
              href={`/e/${encodeURIComponent(event.slug)}`}
              target="_blank"
              style={styles.primaryLink}
            >
              View public event page
            </Link>

            <Link
              href={`/admin/events/${encodeURIComponent(event.id)}/orders`}
              style={styles.secondaryButtonDark}
            >
              View add-on reporting
            </Link>
          </div>
        </section>
      ) : null}

      {!canManageAddOns ? (
        <section className="lockedPanel" style={styles.lockedPanel}>
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
        <section className="panel" style={styles.panel}>
          <div className="panelHeader" style={styles.panelHeader}>
            <div>
              <div style={styles.innerEyebrow}>Heads or Tails</div>
              <h2 style={styles.panelTitle}>Live event game settings</h2>
              <p style={styles.sectionText}>
                Configure the public wording and whether entries should be
                collected during event checkout. Existing event tickets, seating,
                VIP access, menus, checkout, receipts and reporting are
                preserved.
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

            <div className="twoCol" style={styles.twoCol}>
              <Field label="Enable Heads or Tails">
                <select
                  name="enabled"
                  defaultValue={headsOrTailsAddOn.enabled ? "true" : "false"}
                  className="input"
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
                  className="input"
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
                className="input"
                style={styles.input}
              />
            </Field>

            <Field label="Short description">
              <textarea
                name="description"
                rows={3}
                defaultValue={headsOrTailsAddOn.description || ""}
                placeholder="Join our Heads or Tails fundraiser on the night and keep playing until one winner remains."
                className="textarea"
                style={styles.textarea}
              />
            </Field>

            <Field label="How it works / instructions">
              <textarea
                name="instructions"
                rows={4}
                defaultValue={headsOrTailsAddOn.instructions || ""}
                placeholder="Choose heads or tails each round. Stay standing if you are correct. The last person standing wins."
                className="textarea"
                style={styles.textarea}
              />
            </Field>

            <div className="threeCol" style={styles.threeCol}>
              <Field label="Entry price">
                <input
                  name="entry_price"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={moneyFromCents(
                    headsOrTailsAddOn.entryPriceCents,
                  )}
                  className="input"
                  style={styles.input}
                />
              </Field>

              <Field label="Max entries per booking">
                <input
                  name="max_entries_per_booking"
                  type="number"
                  min="1"
                  defaultValue={headsOrTailsAddOn.maxEntriesPerBooking || 1}
                  className="input"
                  style={styles.input}
                />
              </Field>

              <Field label="Prize title / note">
                <input
                  name="prize_title"
                  defaultValue={headsOrTailsAddOn.prizeTitle || ""}
                  placeholder="Cash prize, hamper, sponsored prize..."
                  className="input"
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

            <section className="submitBar" style={styles.submitBar}>
              <div>
                <strong style={{ color: "#0f172a" }}>
                  Save Heads or Tails settings
                </strong>
                <div style={styles.mutedSmall}>
                  Updates this event only. Public display, checkout collection
                  and admin reporting use these settings automatically.
                </div>
              </div>

              <button type="submit" className="primaryButton" style={styles.primaryButton}>
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
    <section className="upgradeBanner" style={styles.upgradeBanner}>
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
  .event-addons-page .readinessGrid,
  .event-addons-page .twoCol,
  .event-addons-page .threeCol {
    grid-template-columns: 1fr !important;
  }

  .event-addons-page .hero,
  .event-addons-page .topActions,
  .event-addons-page .panelHeader,
  .event-addons-page .submitBar,
  .event-addons-page .readinessHeader,
  .event-addons-page .readinessActions {
    display: grid !important;
    grid-template-columns: 1fr !important;
    align-items: stretch !important;
  }

  .event-addons-page .primaryButton,
  .event-addons-page .primaryLink,
  .event-addons-page .secondaryButton,
  .event-addons-page .secondaryButtonDark {
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
  .event-addons-page .upgradeBanner,
  .event-addons-page .readinessPanel {
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
