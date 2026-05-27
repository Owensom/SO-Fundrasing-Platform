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
  type EventFundraisingAddOnType,
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

type AddOnDefinition = {
  id: string;
  type: EventFundraisingAddOnType;
  name: string;
  shortName: string;
  panelTitle: string;
  eyebrow: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultInstructions: string;
  defaultPrizePlaceholder: string;
  savedParam: string;
};

type EventFundraisingAddOnLike = Partial<EventFundraisingAddOn> &
  Record<string, unknown>;

const ADD_ON_DEFINITIONS: AddOnDefinition[] = [
  {
    id: "event-addon-heads-or-tails",
    type: "heads_or_tails",
    name: "Heads or Tails",
    shortName: "Heads or Tails",
    panelTitle: "Live event game settings",
    eyebrow: "Heads or Tails",
    defaultTitle: "Heads or Tails",
    defaultDescription:
      "Join our Heads or Tails fundraiser on the night and keep playing until one winner remains.",
    defaultInstructions:
      "Choose heads or tails each round. Stay standing if you are correct. The last person standing wins.",
    defaultPrizePlaceholder: "Cash prize, hamper, sponsored prize...",
    savedParam: "heads-or-tails",
  },
  {
    id: "event-addon-higher-or-lower",
    type: "higher_or_lower",
    name: "Higher or Lower",
    shortName: "Higher or Lower",
    panelTitle: "Live event game settings",
    eyebrow: "Higher or Lower",
    defaultTitle: "Higher or Lower",
    defaultDescription:
      "Join our Higher or Lower fundraiser on the night and see how long you can stay in the game.",
    defaultInstructions:
      "Guess whether the next card, number or total will be higher or lower. Keep playing while you are correct.",
    defaultPrizePlaceholder: "Cash prize, mystery prize, sponsored prize...",
    savedParam: "higher-or-lower",
  },
];

function cleanText(value: FormDataEntryValue | string | null | undefined) {
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

function readStringField(
  addOn: EventFundraisingAddOnLike,
  keys: string[],
  fallback = "",
) {
  for (const key of keys) {
    const value = addOn[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return fallback;
}

function readNumberField(
  addOn: EventFundraisingAddOnLike,
  keys: string[],
  fallback = 0,
) {
  for (const key of keys) {
    const value = addOn[key];

    if (value === null || value === undefined || value === "") {
      continue;
    }

    const number = Number(value);

    if (Number.isFinite(number) && number >= 0) {
      return Math.floor(number);
    }
  }

  return fallback;
}

function readNullablePositiveIntegerField(
  addOn: EventFundraisingAddOnLike,
  keys: string[],
  fallback: number | null = null,
) {
  for (const key of keys) {
    const value = addOn[key];

    if (value === null || value === undefined || value === "") {
      continue;
    }

    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return Math.floor(number);
    }
  }

  return fallback;
}

function readBooleanField(
  addOn: EventFundraisingAddOnLike,
  keys: string[],
  fallback = false,
) {
  for (const key of keys) {
    const value = addOn[key];

    if (value === true || value === "true" || value === 1 || value === "1") {
      return true;
    }

    if (
      value === false ||
      value === "false" ||
      value === 0 ||
      value === "0"
    ) {
      return false;
    }
  }

  return fallback;
}

function getAddOnDefinition(type: string | null | undefined) {
  return (
    ADD_ON_DEFINITIONS.find((definition) => definition.type === type) ||
    ADD_ON_DEFINITIONS[0]
  );
}

function normaliseAddOnForAdmin(
  addOn: EventFundraisingAddOnLike | null | undefined,
  definition: AddOnDefinition,
): EventFundraisingAddOn {
  if (!addOn) {
    return {
      id: definition.id,
      type: definition.type,
      enabled: false,
      title: definition.defaultTitle,
      description: definition.defaultDescription,
      instructions: definition.defaultInstructions,
      prizeTitle: "",
      entryPriceCents: 0,
      collectAtCheckout: false,
      maxEntriesPerBooking: 1,
      sortOrder: definition.type === "heads_or_tails" ? 0 : 1,
    };
  }

  return {
    id: readStringField(addOn, ["id"], definition.id),
    type: definition.type,
    enabled: readBooleanField(addOn, ["enabled"], false),
    title: readStringField(addOn, ["title"], definition.defaultTitle),
    description: readStringField(
      addOn,
      ["description"],
      definition.defaultDescription,
    ),
    instructions: readStringField(
      addOn,
      ["instructions"],
      definition.defaultInstructions,
    ),
    prizeTitle: readStringField(addOn, ["prizeTitle", "prize_title"], ""),
    entryPriceCents: readNumberField(
      addOn,
      ["entryPriceCents", "entry_price_cents", "entryPrice", "entry_price"],
      0,
    ),
    collectAtCheckout: readBooleanField(
      addOn,
      ["collectAtCheckout", "collect_at_checkout"],
      false,
    ),
    maxEntriesPerBooking: readNullablePositiveIntegerField(
      addOn,
      ["maxEntriesPerBooking", "max_entries_per_booking"],
      1,
    ),
    sortOrder: readNumberField(
      addOn,
      ["sortOrder", "sort_order"],
      definition.type === "heads_or_tails" ? 0 : 1,
    ),
  };
}

function getAddOn(
  addOns: EventFundraisingAddOn[],
  definition: AddOnDefinition,
): EventFundraisingAddOn {
  const existing = addOns.find((addOn) => addOn.type === definition.type);

  return normaliseAddOnForAdmin(existing, definition);
}

function buildAddOnFromForm(
  formData: FormData,
  definition: AddOnDefinition,
): EventFundraisingAddOn {
  return {
    id: definition.id,
    type: definition.type,
    enabled: String(formData.get("enabled") || "") === "true",
    title: cleanText(formData.get("title")) || definition.defaultTitle,
    description: cleanOptionalText(formData.get("description")),
    instructions: cleanOptionalText(formData.get("instructions")),
    prizeTitle: cleanOptionalText(formData.get("prize_title")),
    entryPriceCents: poundsToCents(formData.get("entry_price")),
    collectAtCheckout:
      String(formData.get("collect_at_checkout") || "") === "true",
    maxEntriesPerBooking: positiveIntegerOrNull(
      formData.get("max_entries_per_booking"),
    ),
    sortOrder: definition.type === "heads_or_tails" ? 0 : 1,
  };
}

function normaliseExistingAddOnsForSave(
  addOns: EventFundraisingAddOn[],
  replacingType: EventFundraisingAddOnType,
) {
  return addOns
    .filter((addOn) => addOn.type !== replacingType)
    .map((addOn) => {
      const definition = getAddOnDefinition(addOn.type);
      return normaliseAddOnForAdmin(addOn, definition);
    });
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

function buildAddOnReadiness(input: {
  addOn: EventFundraisingAddOn;
  currency: string;
  definition: AddOnDefinition;
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
        ? `The public event page can show the ${input.definition.shortName} panel once the public display phase is wired.`
        : "Enable the add-on before it appears on the public event page.",
      tone: enabled ? "good" : "neutral",
    },
    {
      label: "Checkout collection",
      value: collectAtCheckout ? "On" : "Off",
      detail: collectAtCheckout
        ? "Supporters will be able to add entries during event checkout once the checkout phase is wired."
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
          ? "The public checkout selector will cap entries at this amount once checkout support is wired."
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
      value: "Prepared",
      detail:
        "Reporting will be extended in a later phase so add-on entries and revenue can be separated clearly.",
      tone: "neutral",
    },
  ];
}

function addOnReadyForCheckout(addOn: EventFundraisingAddOn) {
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

async function saveEventAddOnAction(formData: FormData) {
  "use server";

  const eventId = cleanText(formData.get("event_id"));
  const addOnType = cleanText(
    formData.get("addon_type"),
  ) as EventFundraisingAddOnType;
  const definition = getAddOnDefinition(addOnType);

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

  const addOnTypeAllowed = limits.allowedTypes.some(
    (allowedType) => String(allowedType) === definition.type,
  );

  if (!addOnTypeAllowed) {
    redirect(`/admin/events/${eventId}/addons?error=addon-not-allowed`);
  }

  const currentAddOns = event.event_addons_json || [];
  const otherAddOns = normaliseExistingAddOnsForSave(
    currentAddOns,
    definition.type,
  );

  const nextAddOn = buildAddOnFromForm(formData, definition);

  const nextAddOns = [...otherAddOns, nextAddOn].sort(
    (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0),
  );

  const nextEnabledAddOnCount = nextAddOns.filter(
    (addOn) => addOn.enabled,
  ).length;

  if (nextEnabledAddOnCount > limits.maxAddOnsPerEvent) {
    redirect(`/admin/events/${eventId}/addons?error=multiple-upgrade-required`);
  }

  await updateEvent(eventId, {
    eventAddOnsJson: nextAddOns,
  });

  redirect(`/admin/events/${eventId}/addons?saved=${definition.savedParam}`);
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
  const addOns = event.event_addons_json || [];

  const configuredAddOns = ADD_ON_DEFINITIONS.map((definition) => {
    const addOn = getAddOn(addOns, definition);
    const readinessItems = buildAddOnReadiness({
      addOn,
      currency: event.currency || "GBP",
      definition,
    });
    const readyForCheckout = addOnReadyForCheckout(addOn);
    const warnings = readinessItems.filter((item) => item.tone === "warning")
      .length;

    return {
      definition,
      addOn,
      readinessItems,
      readyForCheckout,
      warnings,
    };
  });

  const enabledAddOns = configuredAddOns
    .map((item) => item.addOn)
    .filter((addOn) => addOn.enabled);

  const checkoutReadyAddOns = configuredAddOns.filter(
    (item) => item.readyForCheckout,
  );
  const firstEnabledAddOn = configuredAddOns.find((item) => item.addOn.enabled);

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
            Add live fundraising tools to this event. Heads or Tails and Higher
            or Lower are designed for ceilidhs, quiz nights, dinners, auctions
            and gala events, with public display, optional checkout collection
            and admin reporting phased in safely.
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
            {checkoutReadyAddOns.length > 0
              ? `${checkoutReadyAddOns.length} add-on${
                  checkoutReadyAddOns.length === 1 ? "" : "s"
                } checkout-ready`
              : firstEnabledAddOn
                ? `${firstEnabledAddOn.definition.shortName} is display-ready`
                : "No event add-ons enabled"}
          </strong>
          <span style={styles.heroPanelText}>
            {checkoutReadyAddOns.length > 0
              ? "Checkout-ready settings are saved for the enabled add-ons. Public checkout support for the next add-on will be wired in a later phase."
              : firstEnabledAddOn
                ? "At least one add-on can be prepared for public display. Checkout collection needs a valid price and checkout wiring."
                : "Enable an add-on to prepare event-night fundraising for this event."}
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

        <div className="topActionsRight" style={styles.topActionsRight}>
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
        </div>
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
          value="One add-on"
          detail="Use either Heads or Tails or Higher or Lower on an event."
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
              <h2 style={styles.readinessTitle}>Event add-ons checklist</h2>
              <p style={styles.readinessIntro}>
                A quick admin view of what is enabled, what is checkout-ready,
                and what would improve each public add-on experience.
              </p>
            </div>

            <span
              style={{
                ...styles.readinessStatusPill,
                ...(checkoutReadyAddOns.length > 0
                  ? styles.statusGood
                  : firstEnabledAddOn
                    ? styles.statusWarning
                    : styles.statusNeutral),
              }}
            >
              {checkoutReadyAddOns.length > 0
                ? "Checkout settings ready"
                : firstEnabledAddOn
                  ? "Display settings started"
                  : "Disabled"}
            </span>
          </div>

          <div
            className="readinessOverviewGrid"
            style={styles.readinessOverviewGrid}
          >
            {configuredAddOns.map((item) => (
              <article
                key={item.definition.type}
                style={styles.readinessOverviewCard}
              >
                <div style={styles.readinessOverviewHeader}>
                  <span style={styles.readinessOverviewLabel}>
                    {item.definition.shortName}
                  </span>
                  <span
                    style={{
                      ...styles.miniStatusPill,
                      ...(item.readyForCheckout
                        ? styles.statusGood
                        : item.addOn.enabled
                          ? styles.statusWarning
                          : styles.statusNeutral),
                    }}
                  >
                    {item.readyForCheckout
                      ? "Checkout-ready"
                      : item.addOn.enabled
                        ? `${item.warnings} warning${
                            item.warnings === 1 ? "" : "s"
                          }`
                        : "Disabled"}
                  </span>
                </div>

                <p style={styles.readinessOverviewText}>
                  {item.addOn.enabled
                    ? `${item.definition.shortName} is prepared for this event.`
                    : `${item.definition.shortName} is not currently enabled.`}
                </p>
              </article>
            ))}
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
          <h2 style={styles.panelTitle}>Upgrade to use event add-ons</h2>
          <p style={styles.sectionText}>
            {addOnsCapability.reason ||
              getEventFundraisingAddOnsUpgradeMessage()}
          </p>
          <Link href="/admin/settings/billing" style={styles.primaryLink}>
            View billing
          </Link>
        </section>
      ) : (
        <div style={styles.addOnPanels}>
          {configuredAddOns.map((item) => (
            <AddOnSettingsPanel
              key={item.definition.type}
              eventId={event.id}
              addOn={item.addOn}
              definition={item.definition}
              readinessItems={item.readinessItems}
              readyForCheckout={item.readyForCheckout}
              readinessWarnings={item.warnings}
              canUseMultipleAddOns={canUseMultipleAddOns}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function AddOnSettingsPanel({
  eventId,
  addOn,
  definition,
  readinessItems,
  readyForCheckout,
  readinessWarnings,
  canUseMultipleAddOns,
}: {
  eventId: string;
  addOn: EventFundraisingAddOn;
  definition: AddOnDefinition;
  readinessItems: ReadinessItem[];
  readyForCheckout: boolean;
  readinessWarnings: number;
  canUseMultipleAddOns: boolean;
}) {
  return (
    <section className="panel" style={styles.panel}>
      <div className="panelHeader" style={styles.panelHeader}>
        <div>
          <div style={styles.innerEyebrow}>{definition.eyebrow}</div>
          <h2 style={styles.panelTitle}>{definition.panelTitle}</h2>
          <p style={styles.sectionText}>
            Configure the public wording and whether entries should be collected
            during event checkout. Existing event tickets, seating, VIP access,
            menus, checkout, receipts and reporting are preserved.
          </p>
        </div>

        <span
          style={{
            ...styles.statusPill,
            ...(readyForCheckout
              ? styles.statusGood
              : addOn.enabled
                ? styles.statusWarning
                : styles.statusNeutral),
          }}
        >
          {readyForCheckout
            ? "Checkout-ready"
            : addOn.enabled
              ? "Enabled"
              : "Disabled"}
        </span>
      </div>

      <div className="readinessGrid" style={styles.readinessGridLight}>
        {readinessItems.map((item) => {
          const toneStyles = readinessToneStyle(item.tone);

          return (
            <article
              key={`${definition.type}-${item.label}`}
              style={{
                ...styles.readinessItemLight,
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
                <span style={styles.readinessLabelLight}>{item.label}</span>
                <strong style={styles.readinessValueLight}>{item.value}</strong>
                <p style={styles.readinessDetailLight}>{item.detail}</p>
              </div>
            </article>
          );
        })}
      </div>

      {addOn.enabled && readinessWarnings > 0 ? (
        <div style={styles.warningNotice}>
          <strong>
            {definition.shortName} has {readinessWarnings} warning
            {readinessWarnings === 1 ? "" : "s"}
          </strong>
          <span>
            The add-on can be saved, but completing the missing fields will make
            the public experience clearer.
          </span>
        </div>
      ) : null}

      <form action={saveEventAddOnAction} style={styles.form}>
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="addon_type" value={definition.type} />

        <div className="twoCol" style={styles.twoCol}>
          <Field label={`Enable ${definition.shortName}`}>
            <select
              name="enabled"
              defaultValue={addOn.enabled ? "true" : "false"}
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
              defaultValue={addOn.collectAtCheckout ? "true" : "false"}
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
            defaultValue={addOn.title || definition.defaultTitle}
            className="input"
            style={styles.input}
          />
        </Field>

        <Field label="Short description">
          <textarea
            name="description"
            rows={3}
            defaultValue={addOn.description || ""}
            placeholder={definition.defaultDescription}
            className="textarea"
            style={styles.textarea}
          />
        </Field>

        <Field label="How it works / instructions">
          <textarea
            name="instructions"
            rows={4}
            defaultValue={addOn.instructions || ""}
            placeholder={definition.defaultInstructions}
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
              defaultValue={moneyFromCents(addOn.entryPriceCents)}
              className="input"
              style={styles.input}
            />
          </Field>

          <Field label="Max entries per booking">
            <input
              name="max_entries_per_booking"
              type="number"
              min="1"
              defaultValue={addOn.maxEntriesPerBooking || 1}
              className="input"
              style={styles.input}
            />
          </Field>

          <Field label="Prize title / note">
            <input
              name="prize_title"
              defaultValue={addOn.prizeTitle || ""}
              placeholder={definition.defaultPrizePlaceholder}
              className="input"
              style={styles.input}
            />
          </Field>
        </div>

        {!canUseMultipleAddOns ? (
          <div style={styles.professionalNotice}>
            <strong>Professional add-on limit</strong>
            <span>
              This tenant can enable one event fundraising add-on per event.
              Save only one enabled add-on at a time, or upgrade to Foundation
              for multiple add-ons per event.
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
              Save {definition.shortName} settings
            </strong>
            <div style={styles.mutedSmall}>
              Updates this event only. Public display, checkout collection and
              admin reporting use these settings as each phase is wired.
            </div>
          </div>

          <button
            type="submit"
            className="primaryButton"
            style={styles.primaryButton}
          >
            Save {definition.shortName}
          </button>
        </section>
      </form>
    </section>
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
  .event-addons-page .readinessOverviewGrid,
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

  .event-addons-page .topActionsRight {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 10px !important;
    width: 100% !important;
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

  topActionsRight: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "flex-end",
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
    padding: "10px 15px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    textDecoration: "none",
    fontWeight: 950,
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
  },

  secondaryButtonDark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.2)",
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

  readinessPanel: {
    display: "grid",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.14), transparent 34%), linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #020617 100%)",
    color: "#ffffff",
    border: "1px solid rgba(250,204,21,0.26)",
    boxShadow: "0 18px 48px rgba(15,23,42,0.16)",
    marginBottom: 16,
    overflow: "hidden",
  },

  readinessHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  readinessEyebrow: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  readinessTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: "clamp(24px, 5vw, 32px)",
    lineHeight: 1.05,
    letterSpacing: "-0.045em",
  },

  readinessIntro: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.55,
    maxWidth: 780,
    fontWeight: 750,
  },

  readinessStatusPill: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  readinessOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  readinessOverviewCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  readinessOverviewHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  readinessOverviewLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  readinessOverviewText: {
    margin: "7px 0 0",
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  miniStatusPill: {
    display: "inline-flex",
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  readinessGridLight: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  readinessItemLight: {
    display: "grid",
    gridTemplateColumns: "14px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: 14,
    borderRadius: 18,
    border: "1px solid",
    minWidth: 0,
  },

  readinessItemGood: {
    background: "rgba(34,197,94,0.12)",
    borderColor: "rgba(187,247,208,0.34)",
  },

  readinessItemWarning: {
    background: "rgba(250,204,21,0.12)",
    borderColor: "rgba(250,204,21,0.34)",
  },

  readinessItemNeutral: {
    background: "rgba(255,255,255,0.76)",
    borderColor: "rgba(203,213,225,0.9)",
  },

  readinessToneDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    marginTop: 4,
  },

  readinessDotGood: {
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.14)",
  },

  readinessDotWarning: {
    background: "#facc15",
    boxShadow: "0 0 0 4px rgba(250,204,21,0.14)",
  },

  readinessDotNeutral: {
    background: "#94a3b8",
    boxShadow: "0 0 0 4px rgba(148,163,184,0.14)",
  },

  readinessContent: {
    minWidth: 0,
  },

  readinessLabelLight: {
    display: "block",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 4,
  },

  readinessValueLight: {
    display: "block",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  readinessDetailLight: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  readinessActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
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

  addOnPanels: {
    display: "grid",
    gap: 16,
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

  statusWarning: {
    background: "#fef3c7",
    color: "#92400e",
    borderColor: "#fde68a",
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

  warningNotice: {
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
