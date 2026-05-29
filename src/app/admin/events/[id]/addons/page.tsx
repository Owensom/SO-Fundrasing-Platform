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
import HigherOrLowerRevealEditor from "@/components/admin/HigherOrLowerRevealEditor"; 
import {
  getEventById,
  updateEvent,
  type EventFundraisingAddOn,
  type EventFundraisingAddOnType,
  type EventPrizeRevealPrize,
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

type LegalQuestionFields = {
  legalQuestionEnabled?: boolean;
  legalQuestionText?: string;
  legalQuestionAnswer?: string;
  legalQuestionHelperText?: string;
};

type PrizeValueRangeFields = {
  prizeValueRangeEnabled?: boolean;
  prizeValueRangeMinCents?: number;
  prizeValueRangeMaxCents?: number;
  prizeValueRangeNote?: string;
};

type AdminEventFundraisingAddOn = EventFundraisingAddOn &
  LegalQuestionFields &
  PrizeValueRangeFields;

type EventFundraisingAddOnLike = Partial<AdminEventFundraisingAddOn> &
  Record<string, unknown>;

type ConfiguredAddOn = {
  definition: AddOnDefinition;
  addOn: AdminEventFundraisingAddOn;
  readinessItems: ReadinessItem[];
  readyForCheckout: boolean;
  warnings: number;
};

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

const MAX_PRIZE_REVEAL_PRIZES = 20;

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

function normalisePrizeRevealPrize(
  value: Record<string, unknown>,
  index: number,
): EventPrizeRevealPrize | null {
  const title = String(value.title || "").trim();

  if (!title) return null;

  const estimatedValueCents = Number(
    value.estimatedValueCents ??
      value.estimated_value_cents ??
      value.estimatedValue ??
      value.estimated_value ??
      0,
  );

  const revealOrder = Number(
    value.revealOrder ?? value.reveal_order ?? index + 1,
  );

  const isRevealed =
    value.isRevealed === true ||
    value.is_revealed === true ||
    value.isRevealed === "true" ||
    value.is_revealed === "true";

  return {
    id: String(value.id || `reveal-prize-${index + 1}`),
    title,
    description: String(value.description || "").trim(),
    imageUrl: String(value.imageUrl ?? value.image_url ?? "").trim(),
    sponsorName: String(value.sponsorName ?? value.sponsor_name ?? "").trim(),
    estimatedValueCents:
      Number.isFinite(estimatedValueCents) && estimatedValueCents > 0
        ? Math.round(estimatedValueCents)
        : 0,
    revealOrder:
      Number.isFinite(revealOrder) && revealOrder > 0
        ? Math.floor(revealOrder)
        : index + 1,
    isRevealed,
  };
}

function normalisePrizeRevealPrizes(value: unknown): EventPrizeRevealPrize[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      return normalisePrizeRevealPrize(item as Record<string, unknown>, index);
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        Number(a?.revealOrder || 0) - Number(b?.revealOrder || 0),
    ) as EventPrizeRevealPrize[];
}

function getPrizeRevealPrizes(addOn: EventFundraisingAddOnLike) {
  return normalisePrizeRevealPrizes(
    addOn.prizeRevealPrizes ?? addOn.prize_reveal_prizes,
  );
}

function buildPrizeRevealPrizesFromForm(formData: FormData) {
  const rawPrizeCount = Number(formData.get("prize_reveal_prize_count") || 0);
  const prizeCount = Math.min(
    MAX_PRIZE_REVEAL_PRIZES,
    Math.max(0, Number.isFinite(rawPrizeCount) ? Math.floor(rawPrizeCount) : 0),
  );

  const prizes: EventPrizeRevealPrize[] = [];

  for (let index = 0; index < prizeCount; index += 1) {
    const title = cleanText(formData.get(`prize_reveal_prize_${index}_title`));

    if (!title) {
      continue;
    }

    const existingId = cleanText(formData.get(`prize_reveal_prize_${index}_id`));
    const estimatedValueCents = poundsToCents(
      formData.get(`prize_reveal_prize_${index}_estimated_value`),
    );
    const revealOrder =
      positiveIntegerOrNull(
        formData.get(`prize_reveal_prize_${index}_reveal_order`),
      ) || index + 1;

    prizes.push({
      id: existingId || `reveal-prize-${Date.now()}-${index + 1}`,
      title,
      description: cleanOptionalText(
        formData.get(`prize_reveal_prize_${index}_description`),
      ),
      imageUrl: cleanOptionalText(
        formData.get(`prize_reveal_prize_${index}_image_url`),
      ),
      sponsorName: cleanOptionalText(
        formData.get(`prize_reveal_prize_${index}_sponsor_name`),
      ),
      estimatedValueCents,
      revealOrder,
      isRevealed:
        String(formData.get(`prize_reveal_prize_${index}_is_revealed`) || "") ===
        "true",
    });
  }

  return prizes.sort(
    (a, b) => Number(a.revealOrder || 0) - Number(b.revealOrder || 0),
  );
}

function normaliseAddOnForAdmin(
  addOn: EventFundraisingAddOnLike | null | undefined,
  definition: AddOnDefinition,
): AdminEventFundraisingAddOn {
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
      prizeRevealModeEnabled: false,
      prizeRevealRandomiseOrder: false,
      prizeRevealTitle: "",
      prizeRevealDescription: "",
      prizeRevealPrizes: [],
      legalQuestionEnabled: false,
      legalQuestionText: "",
      legalQuestionAnswer: "",
      legalQuestionHelperText: "",
      prizeValueRangeEnabled: false,
      prizeValueRangeMinCents: 0,
      prizeValueRangeMaxCents: 0,
      prizeValueRangeNote: "",
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
    prizeRevealModeEnabled: readBooleanField(
      addOn,
      ["prizeRevealModeEnabled", "prize_reveal_mode_enabled"],
      false,
    ),
    prizeRevealRandomiseOrder: readBooleanField(
      addOn,
      ["prizeRevealRandomiseOrder", "prize_reveal_randomise_order"],
      false,
    ),
    prizeRevealTitle: readStringField(
      addOn,
      ["prizeRevealTitle", "prize_reveal_title"],
      "",
    ),
    prizeRevealDescription: readStringField(
      addOn,
      ["prizeRevealDescription", "prize_reveal_description"],
      "",
    ),
    prizeRevealPrizes: getPrizeRevealPrizes(addOn),
    legalQuestionEnabled: readBooleanField(
      addOn,
      ["legalQuestionEnabled", "legal_question_enabled"],
      false,
    ),
    legalQuestionText: readStringField(
      addOn,
      ["legalQuestionText", "legal_question_text"],
      "",
    ),
    legalQuestionAnswer: readStringField(
      addOn,
      ["legalQuestionAnswer", "legal_question_answer"],
      "",
    ),
    legalQuestionHelperText: readStringField(
      addOn,
      ["legalQuestionHelperText", "legal_question_helper_text"],
      "",
    ),
    prizeValueRangeEnabled: readBooleanField(
      addOn,
      ["prizeValueRangeEnabled", "prize_value_range_enabled"],
      false,
    ),
    prizeValueRangeMinCents: readNumberField(
      addOn,
      ["prizeValueRangeMinCents", "prize_value_range_min_cents"],
      0,
    ),
    prizeValueRangeMaxCents: readNumberField(
      addOn,
      ["prizeValueRangeMaxCents", "prize_value_range_max_cents"],
      0,
    ),
    prizeValueRangeNote: readStringField(
      addOn,
      ["prizeValueRangeNote", "prize_value_range_note"],
      "",
    ),
  };
}

function getAddOn(
  addOns: EventFundraisingAddOn[],
  definition: AddOnDefinition,
): AdminEventFundraisingAddOn {
  const existing = addOns.find((addOn) => addOn.type === definition.type);

  return normaliseAddOnForAdmin(existing, definition);
}

function buildAddOnFromForm(
  formData: FormData,
  definition: AddOnDefinition,
): AdminEventFundraisingAddOn {
  const isHigherOrLower = definition.type === "higher_or_lower";

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

    prizeRevealModeEnabled: isHigherOrLower
      ? String(formData.get("prize_reveal_mode_enabled") || "") === "true"
      : false,
    prizeRevealRandomiseOrder: isHigherOrLower
      ? String(formData.get("prize_reveal_randomise_order") || "") === "true"
      : false,
    prizeRevealTitle: isHigherOrLower
      ? cleanOptionalText(formData.get("prize_reveal_title"))
      : "",
    prizeRevealDescription: isHigherOrLower
      ? cleanOptionalText(formData.get("prize_reveal_description"))
      : "",
    prizeRevealPrizes: isHigherOrLower
      ? buildPrizeRevealPrizesFromForm(formData)
      : [],

    legalQuestionEnabled: isHigherOrLower
      ? String(formData.get("legal_question_enabled") || "") === "true"
      : false,
    legalQuestionText: isHigherOrLower
      ? cleanOptionalText(formData.get("legal_question_text"))
      : "",
    legalQuestionAnswer: isHigherOrLower
      ? cleanOptionalText(formData.get("legal_question_answer"))
      : "",
    legalQuestionHelperText: isHigherOrLower
      ? cleanOptionalText(formData.get("legal_question_helper_text"))
      : "",

    prizeValueRangeEnabled: isHigherOrLower
      ? String(formData.get("prize_value_range_enabled") || "") === "true"
      : false,
    prizeValueRangeMinCents: isHigherOrLower
      ? poundsToCents(formData.get("prize_value_range_min"))
      : 0,
    prizeValueRangeMaxCents: isHigherOrLower
      ? poundsToCents(formData.get("prize_value_range_max"))
      : 0,
    prizeValueRangeNote: isHigherOrLower
      ? cleanOptionalText(formData.get("prize_value_range_note"))
      : "",
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
  addOn: AdminEventFundraisingAddOn;
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

  const baseItems: ReadinessItem[] = [
    {
      label: "Public display",
      value: enabled ? "Live-ready" : "Disabled",
      detail: enabled
        ? `The public event page can show the ${input.definition.shortName} panel for this event.`
        : "Enable the add-on before it appears on the public event page.",
      tone: enabled ? "good" : "neutral",
    },
    {
      label: "Checkout collection",
      value: collectAtCheckout ? "Enabled" : "Off",
      detail: collectAtCheckout
        ? "Supporters can add entries during event checkout when a valid entry price is saved."
        : "Entries can still be promoted publicly and collected by the organiser on the night.",
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
          ? "The public checkout selector caps entries at this amount."
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
      value: "Live",
      detail:
        "The orders dashboard separates add-on entries and revenue by add-on type.",
      tone: "good",
    },
  ];

  if (input.definition.type !== "higher_or_lower") {
    return baseItems;
  }

  const prizeRevealEnabled = Boolean(addOn.prizeRevealModeEnabled);
  const prizeRevealPrizes = addOn.prizeRevealPrizes || [];
  const prizeRevealPrizeCount = prizeRevealPrizes.length;
  const prizeRevealImages = prizeRevealPrizes.filter((prize) =>
    String(prize.imageUrl || "").trim(),
  ).length;
  const prizeRevealRevealed = prizeRevealPrizes.filter(
    (prize) => prize.isRevealed,
  ).length;
  const legalQuestionEnabled = Boolean(addOn.legalQuestionEnabled);
  const hasLegalQuestion = Boolean(String(addOn.legalQuestionText || "").trim());
  const hasLegalAnswer = Boolean(String(addOn.legalQuestionAnswer || "").trim());
  const valueRangeEnabled = Boolean(addOn.prizeValueRangeEnabled);
  const valueRangeMinCents = Number(addOn.prizeValueRangeMinCents || 0);
  const valueRangeMaxCents = Number(addOn.prizeValueRangeMaxCents || 0);
  const hasValidValueRange =
    valueRangeMinCents > 0 &&
    valueRangeMaxCents > 0 &&
    valueRangeMaxCents >= valueRangeMinCents;

  return [
    ...baseItems,
    {
      label: "Legal / skill question",
      value: legalQuestionEnabled ? "Enabled" : "Off",
      detail: legalQuestionEnabled
        ? hasLegalQuestion && hasLegalAnswer
          ? "A skill, knowledge or judgement question is saved for this add-on."
          : "Complete the question and answer before enforcing this at checkout."
        : "Optional safeguard for paid online Higher or Lower entries.",
      tone:
        legalQuestionEnabled && (!hasLegalQuestion || !hasLegalAnswer)
          ? "warning"
          : legalQuestionEnabled
            ? "good"
            : "neutral",
    },
    {
      label: "Prize value range",
      value: valueRangeEnabled ? "Enabled" : "Off",
      detail: valueRangeEnabled
        ? hasValidValueRange
          ? `Supporters can be shown that prize values range from ${formatMoney(
              valueRangeMinCents,
              input.currency,
            )} to ${formatMoney(valueRangeMaxCents, input.currency)}.`
          : "Complete a valid minimum and maximum value before showing the range publicly."
        : "Optional transparency helper to support judgement-based play.",
      tone:
        valueRangeEnabled && !hasValidValueRange
          ? "warning"
          : valueRangeEnabled
            ? "good"
            : "neutral",
    },
    {
      label: "Prize reveal mode",
      value: prizeRevealEnabled ? "Configured" : "Off",
      detail: prizeRevealEnabled
        ? "Prize reveal settings are saved and can be controlled by the live Higher or Lower game page."
        : "Optional premium mode for prize-by-prize Higher or Lower reveals.",
      tone: prizeRevealEnabled ? "good" : "neutral",
    },
    {
      label: "Game prizes",
      value:
        prizeRevealPrizeCount === 1
          ? "1 prize"
          : `${prizeRevealPrizeCount} prizes`,
      detail:
        prizeRevealPrizeCount > 0
          ? "Saved prize rows are used to create the Higher or Lower live game chain."
          : "Add prize rows before using prize reveal mode or live game mode.",
      tone:
        prizeRevealEnabled && prizeRevealPrizeCount < 2
          ? "warning"
          : prizeRevealPrizeCount >= 2
            ? "good"
            : "neutral",
    },
    {
      label: "Playable rounds",
      value:
        prizeRevealPrizeCount >= 2
          ? `${prizeRevealPrizeCount - 1} round${
              prizeRevealPrizeCount - 1 === 1 ? "" : "s"
            }`
          : "No rounds",
      detail:
        prizeRevealPrizeCount >= 2
          ? "Prize 1 is the starting value. Each later prize creates one Higher or Lower round."
          : "At least two prizes are required for one playable round.",
      tone: prizeRevealPrizeCount >= 2 ? "good" : "warning",
    },
    {
      label: "Prize images",
      value:
        prizeRevealImages === 1 ? "1 image" : `${prizeRevealImages} images`,
      detail:
        prizeRevealImages > 0
          ? "Uploaded prize image URLs are saved with the reveal prizes."
          : "Add image uploads for a stronger reveal experience.",
      tone: prizeRevealImages > 0 ? "good" : "neutral",
    },
    {
      label: "Public reveal control",
      value:
        prizeRevealPrizeCount > 0
          ? `${prizeRevealRevealed} / ${prizeRevealPrizeCount} revealed`
          : "No prizes",
      detail:
        prizeRevealPrizeCount > 0
          ? "This controls the public preview only. The live game fixes its own order when created."
          : "Add at least two prizes before using event-night reveal controls.",
      tone:
        prizeRevealEnabled && prizeRevealPrizeCount >= 2 ? "good" : "neutral",
    },
  ];
}

function addOnReadyForCheckout(addOn: AdminEventFundraisingAddOn) {
  return (
    Boolean(addOn.enabled) &&
    Boolean(addOn.collectAtCheckout) &&
    Number(addOn.entryPriceCents || 0) > 0
  );
}

function getVisibleConfiguredAddOnsForTier(
  configuredAddOns: ConfiguredAddOn[],
  tier: string,
) {
  if (tier === "foundation") {
    return configuredAddOns;
  }

  if (tier === "professional") {
    const enabled = configuredAddOns
      .filter((item) => item.addOn.enabled)
      .sort(
        (a, b) =>
          Number(a.addOn.sortOrder || 0) - Number(b.addOn.sortOrder || 0),
      );

    if (enabled.length > 0) {
      return [enabled[0]];
    }

    return [configuredAddOns[0]].filter(Boolean);
  }

  return [];
}

function getAddOnPanelDefaultOpen(input: {
  savedParam?: string;
  definition: AddOnDefinition;
  addOn: AdminEventFundraisingAddOn;
  warnings: number;
}) {
  if (input.savedParam === input.definition.savedParam) {
    return true;
  }

  if (input.addOn.enabled && input.warnings > 0) {
    return true;
  }

  return false;
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
  const customImagesCapability = checkSubscriptionCapability(
    tenantSettings,
    "custom_campaign_images",
  );
  const limits = getTenantEventFundraisingAddOnLimits(tenantSettings);

  const canManageAddOns = addOnsCapability.allowed;
  const canUseMultipleAddOns =
    tier === "foundation" && multipleAddOnsCapability.allowed;
  const addOns = event.event_addons_json || [];

  const configuredAddOns: ConfiguredAddOn[] = ADD_ON_DEFINITIONS.map(
    (definition) => {
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
    },
  );

  const visibleConfiguredAddOns = canManageAddOns
    ? getVisibleConfiguredAddOnsForTier(configuredAddOns, tier)
    : [];

  const enabledAddOns = visibleConfiguredAddOns
    .map((item) => item.addOn)
    .filter((addOn) => addOn.enabled);

  const checkoutReadyAddOns = visibleConfiguredAddOns.filter(
    (item) => item.readyForCheckout,
  );
  const firstEnabledAddOn = visibleConfiguredAddOns.find(
    (item) => item.addOn.enabled,
  );

  const savedEnabledAddOns = configuredAddOns
    .map((item) => item.addOn)
    .filter((addOn) => addOn.enabled);

  const hiddenByTierCount =
    canManageAddOns && tier !== "foundation"
      ? Math.max(0, configuredAddOns.length - visibleConfiguredAddOns.length)
      : 0;

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
            or Lower can be shown publicly, collected during checkout and
            reported clearly in event orders, with the editor matching the
            tenant’s current plan.
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
                : canManageAddOns
                  ? "No event add-ons enabled"
                  : "Event add-ons locked"}
          </strong>
          <span style={styles.heroPanelText}>
            {tier === "foundation"
              ? "Foundation can manage multiple event add-ons on the same event."
              : tier === "professional"
                ? "Professional can manage one event add-on per event. Upgrade to Foundation for multiple add-ons together."
                : "Event fundraising add-ons are available on Professional and Foundation plans."}
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

        <div className="topActionGroup" style={styles.topActionGroup}>
          <Link
            href={`/e/${encodeURIComponent(event.slug)}`}
            target="_blank"
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            View public event page
          </Link>

          <Link
            href={`/admin/events/${encodeURIComponent(event.id)}/higher-or-lower`}
            className="primaryActionButton"
            style={styles.primaryActionButton}
          >
            Higher or Lower live game
          </Link>

          <Link
            href={`/admin/events/${encodeURIComponent(event.id)}/orders`}
            className="secondaryButton"
            style={styles.secondaryButton}
          >
            View orders & reporting
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

      {tier === "professional" && savedEnabledAddOns.length > 1 ? (
        <section className="upgradeBanner" style={styles.upgradeBanner}>
          <div style={styles.upgradeEyebrow}>Professional limit applied</div>
          <h2 style={styles.upgradeTitle}>One add-on is active for this event</h2>
          <p style={styles.upgradeText}>
            This event still has multiple saved add-ons from a previous plan,
            but Professional shows and uses only the first enabled add-on.
            Upgrade to Foundation to manage multiple add-ons together again.
          </p>
          <Link href="/admin/settings/billing" style={styles.primaryLink}>
            View billing
          </Link>
        </section>
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
          detail="Use one live fundraising add-on on an event."
        />
        <SummaryCard
          label="Foundation"
          value="Multiple add-ons"
          detail="Foundation can sell and report several live fundraising add-ons on the same event."
        />
      </section>
            {canManageAddOns ? (
        <section className="readinessPanel" style={styles.readinessPanel}>
          <div style={styles.readinessHeader}>
            <div>
              <div style={styles.readinessEyebrow}>Readiness</div>
              <h2 style={styles.readinessTitle}>Event add-ons checklist</h2>
              <p style={styles.readinessIntro}>
                A quick admin view of what is enabled, what is public-ready,
                what is checkout-ready and what is reporting in event orders for
                this tenant’s current plan.
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
                ? "Checkout-ready"
                : firstEnabledAddOn
                  ? "Display-ready"
                  : "Disabled"}
            </span>
          </div>

          <div
            className="readinessOverviewGrid"
            style={styles.readinessOverviewGrid}
          >
            {visibleConfiguredAddOns.map((item) => (
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
                  {item.readyForCheckout
                    ? `${item.definition.shortName} can be sold during checkout and tracked in orders.`
                    : item.addOn.enabled
                      ? `${item.definition.shortName} can be displayed publicly, but needs the warning items completed for best results.`
                      : `${item.definition.shortName} is not currently enabled.`}
                </p>
              </article>
            ))}
          </div>

          {hiddenByTierCount > 0 ? (
            <div style={styles.professionalNoticeDark}>
              <strong>{hiddenByTierCount} add-on option hidden on this plan</strong>
              <span>
                Professional shows one add-on editor for this event. Foundation
                unlocks multiple add-on editors and multiple public add-ons
                together.
              </span>
            </div>
          ) : null}

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
          {visibleConfiguredAddOns.map((item) => (
            <AddOnSettingsPanel
              key={item.definition.type}
              eventId={event.id}
              addOn={item.addOn}
              definition={item.definition}
              readinessItems={item.readinessItems}
              readyForCheckout={item.readyForCheckout}
              readinessWarnings={item.warnings}
              canUseMultipleAddOns={canUseMultipleAddOns}
              subscriptionTier={tier}
              customImagesAllowed={customImagesCapability.allowed}
              currency={event.currency || "GBP"}
              defaultOpen={getAddOnPanelDefaultOpen({
                savedParam: searchParams?.saved,
                definition: item.definition,
                addOn: item.addOn,
                warnings: item.warnings,
              })}
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
  subscriptionTier,
  customImagesAllowed,
  currency,
  defaultOpen,
}: {
  eventId: string;
  addOn: AdminEventFundraisingAddOn;
  definition: AddOnDefinition;
  readinessItems: ReadinessItem[];
  readyForCheckout: boolean;
  readinessWarnings: number;
  canUseMultipleAddOns: boolean;
  subscriptionTier: string;
  customImagesAllowed: boolean;
  currency: string;
  defaultOpen: boolean;
}) {
  const isHigherOrLower = definition.type === "higher_or_lower";
  const prizeRevealPrizes = (addOn.prizeRevealPrizes || []).slice(
    0,
    MAX_PRIZE_REVEAL_PRIZES,
  );
  const legalQuestionDefaultOpen =
    Boolean(addOn.legalQuestionEnabled) ||
    Boolean(String(addOn.legalQuestionText || "").trim()) ||
    Boolean(addOn.prizeValueRangeEnabled);
  const valueRangeMinCents = Number(addOn.prizeValueRangeMinCents || 0);
  const valueRangeMaxCents = Number(addOn.prizeValueRangeMaxCents || 0);
  const hasValidValueRange =
    valueRangeMinCents > 0 &&
    valueRangeMaxCents > 0 &&
    valueRangeMaxCents >= valueRangeMinCents;

  return (
    <details
      open={defaultOpen}
      className="addOnAccordion"
      style={styles.addOnAccordion}
    >
      <summary className="addOnAccordionSummary" style={styles.addOnAccordionSummary}>
        <div style={styles.addOnSummaryMain}>
          <div style={styles.innerEyebrow}>{definition.eyebrow}</div>

          <h2 style={styles.panelTitle}>{definition.shortName}</h2>

          <p style={styles.sectionText}>
            {addOn.enabled
              ? readyForCheckout
                ? "Enabled and ready for checkout collection."
                : "Enabled for public display. Review any warning items before using checkout collection."
              : "Currently disabled for this event."}
          </p>
        </div>

        <div style={styles.addOnSummaryMeta}>
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
                ? "Display-ready"
                : "Disabled"}
          </span>

          <span
            style={{
              ...styles.warningCountPill,
              ...(readinessWarnings > 0
                ? styles.warningCountPillActive
                : styles.warningCountPillQuiet),
            }}
          >
            {readinessWarnings > 0
              ? `${readinessWarnings} warning${
                  readinessWarnings === 1 ? "" : "s"
                }`
              : "No warnings"}
          </span>

          <span style={styles.prizeRevealToggle}>Open / close</span>
        </div>
      </summary>

      <div style={styles.addOnAccordionBody}>
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
              the public page and checkout experience clearer.
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

          {isHigherOrLower ? (
            <HigherOrLowerRevealEditor
              prizeRevealModeEnabled={Boolean(addOn.prizeRevealModeEnabled)}
              prizeRevealRandomiseOrder={Boolean(
                addOn.prizeRevealRandomiseOrder,
              )}
              prizeRevealTitle={addOn.prizeRevealTitle || ""}
              prizeRevealDescription={addOn.prizeRevealDescription || ""}
              prizeRevealPrizes={prizeRevealPrizes}
              maxPrizes={MAX_PRIZE_REVEAL_PRIZES}
              subscriptionTier={subscriptionTier}
              customImagesAllowed={customImagesAllowed}
            />
          ) : null}

          {isHigherOrLower ? (
            <details
              open={legalQuestionDefaultOpen}
              className="legalPanel"
              style={styles.legalPanel}
            >
              <summary className="legalSummary" style={styles.legalSummary}>
                <div>
                  <div style={styles.legalEyebrow}>
                    Higher or Lower compliance helpers
                  </div>

                  <h3 style={styles.legalTitle}>
                    Legal question and prize value range
                  </h3>

                  <p style={styles.legalText}>
                    Optional safeguards for paid Higher or Lower checkout
                    entries. These settings preserve the current checkout flow
                    while letting the organiser add a skill, knowledge or
                    judgement question and clear value range wording.
                  </p>
                </div>

                <span style={styles.prizeRevealToggle}>Open / close</span>
              </summary>

              <div style={styles.legalBody}>
                <div className="twoCol" style={styles.twoCol}>
                  <Field label="Enable checkout question">
                    <select
                      name="legal_question_enabled"
                      defaultValue={
                        addOn.legalQuestionEnabled ? "true" : "false"
                      }
                      className="input"
                      style={styles.input}
                    >
                      <option value="false">No, do not ask a question</option>
                      <option value="true">
                        Yes, require an answer at checkout
                      </option>
                    </select>
                  </Field>

                  <Field label="Correct answer">
                    <input
                      name="legal_question_answer"
                      defaultValue={addOn.legalQuestionAnswer || ""}
                      placeholder="Correct answer"
                      className="input"
                      style={styles.input}
                    />
                  </Field>
                </div>

                <Field label="Question text">
                  <input
                    name="legal_question_text"
                    defaultValue={addOn.legalQuestionText || ""}
                    placeholder="Example: What comes after A in the alphabet?"
                    className="input"
                    style={styles.input}
                  />
                </Field>

                <Field label="Helper text">
                  <textarea
                    name="legal_question_helper_text"
                    rows={2}
                    defaultValue={addOn.legalQuestionHelperText || ""}
                    placeholder="Optional helper text shown near the question."
                    className="textarea"
                    style={styles.textarea}
                  />
                </Field>

                <div style={styles.valueRangePanel}>
                  <div>
                    <div style={styles.legalEyebrow}>Prize value range</div>
                    <h4 style={styles.valueRangeTitle}>
                      Optional prize range wording
                    </h4>
                    <p style={styles.legalText}>
                      Use this to make the Higher or Lower judgement clearer for
                      supporters before checkout.
                    </p>
                  </div>

                  <div className="threeCol" style={styles.threeCol}>
                    <Field label="Enable value range">
                      <select
                        name="prize_value_range_enabled"
                        defaultValue={
                          addOn.prizeValueRangeEnabled ? "true" : "false"
                        }
                        className="input"
                        style={styles.input}
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </Field>

                    <Field label="Minimum value">
                      <input
                        name="prize_value_range_min"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={moneyFromCents(valueRangeMinCents)}
                        className="input"
                        style={styles.input}
                      />
                    </Field>

                    <Field label="Maximum value">
                      <input
                        name="prize_value_range_max"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={moneyFromCents(valueRangeMaxCents)}
                        className="input"
                        style={styles.input}
                      />
                    </Field>
                  </div>

                  <Field label="Value range note">
                    <textarea
                      name="prize_value_range_note"
                      rows={2}
                      defaultValue={addOn.prizeValueRangeNote || ""}
                      placeholder="Example: Prizes in this game range from £10 to £100."
                      className="textarea"
                      style={styles.textarea}
                    />
                  </Field>

                  {addOn.prizeValueRangeEnabled && !hasValidValueRange ? (
                    <div style={styles.warningNotice}>
                      <strong>Prize value range needs attention</strong>
                      <span>
                        Add a valid minimum and maximum value before relying on
                        this wording publicly.
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </details>
          ) : null}

          {subscriptionTier === "professional" && !canUseMultipleAddOns ? (
            <div style={styles.professionalNoticeLight}>
              <strong>Professional plan limit</strong>
              <span>
                Professional can use one event fundraising add-on per event.
                Foundation unlocks multiple add-ons together.
              </span>
            </div>
          ) : null}

          <div style={styles.submitRow}>
            <button type="submit" style={styles.primaryButton}>
              Save {definition.shortName}
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
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
.event-addons-page,
.event-addons-page * {
  box-sizing: border-box;
}

.event-addons-page {
  overflow-x: hidden;
}

.event-addons-page section,
.event-addons-page article,
.event-addons-page div,
.event-addons-page form,
.event-addons-page input,
.event-addons-page textarea,
.event-addons-page select,
.event-addons-page button,
.event-addons-page a {
  min-width: 0;
  max-width: 100%;
}

.event-addons-page summary::-webkit-details-marker {
  display: none;
}

@media (max-width: 980px) {
  .hero {
    grid-template-columns: 1fr !important;
  }

  .heroMetaGrid,
  .summaryGrid,
  .readinessOverviewGrid,
  .readinessGrid,
  .twoCol,
  .threeCol {
    grid-template-columns: 1fr !important;
  }

  .topActions {
    grid-template-columns: 1fr !important;
  }

  .topActionGroup {
    justify-content: stretch !important;
    grid-template-columns: 1fr !important;
  }

  .topActionGroup a,
  .topActions > a {
    width: 100% !important;
  }
}

@media (max-width: 720px) {
  .event-addons-page {
    padding: 18px 12px 44px !important;
  }

  .hero,
  .readinessPanel,
  .lockedPanel,
  .addOnAccordion,
  .upgradeBanner {
    padding: 20px !important;
    border-radius: 26px !important;
  }

  .title {
    font-size: clamp(38px, 12vw, 54px) !important;
    line-height: 0.98 !important;
  }

  .addOnAccordionSummary,
  .legalSummary,
  .higher-lower-reveal-summary {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }

  .higher-lower-reveal-two-col {
    grid-template-columns: 1fr !important;
  }

  .higher-lower-reveal-row-summary {
    display: grid !important;
    grid-template-columns: 1fr !important;
  }
}
`;

const styles: Record<string, CSSProperties> = {
  page: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "28px 16px 56px",
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(22,131,248,0.08), transparent 32%), radial-gradient(circle at top right, rgba(250,204,21,0.12), transparent 34%), #f8fafc",
    overflowX: "hidden",
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 0.36fr)",
    gap: 18,
    alignItems: "stretch",
    padding: 28,
    borderRadius: 32,
    background:
      "radial-gradient(circle at bottom right, rgba(250,204,21,0.18), transparent 38%), linear-gradient(135deg, #020617 0%, #0f172a 55%, #172554 100%)",
    color: "#ffffff",
    marginBottom: 18,
    boxShadow: "0 28px 70px rgba(15,23,42,0.22)",
    border: "1px solid rgba(250,204,21,0.24)",
  },

  heroContent: {
    minWidth: 0,
  },

  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(15,23,42,0.24)",
    color: "#facc15",
    border: "1px solid rgba(250,204,21,0.76)",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: "clamp(48px, 7vw, 76px)",
    lineHeight: 0.94,
    letterSpacing: "-0.075em",
    color: "#ffffff",
    overflowWrap: "anywhere",
  },

  heroText: {
    margin: "16px 0 0",
    maxWidth: 800,
    color: "#dbeafe",
    fontSize: 17,
    lineHeight: 1.6,
    fontWeight: 750,
  },

  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 18,
  },

  heroMetric: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
  },

  heroMetricLabel: {
    display: "block",
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },

  heroMetricValue: {
    display: "block",
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 1.25,
    fontWeight: 950,
    overflowWrap: "anywhere",
  },

  heroPanel: {
    display: "grid",
    alignContent: "center",
    gap: 8,
    padding: 18,
    borderRadius: 24,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(250,204,21,0.28)",
  },

  heroPanelEyebrow: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  heroPanelTitle: {
    color: "#ffffff",
    fontSize: 24,
    lineHeight: 1.08,
    letterSpacing: "-0.04em",
  },

  heroPanelText: {
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 750,
  },

  topActions: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 12,
    alignItems: "center",
    marginBottom: 18,
    padding: 12,
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
  },

  topActionGroup: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, auto))",
    gap: 10,
    justifyContent: "end",
    alignItems: "center",
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
    fontWeight: 900,
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
    whiteSpace: "nowrap",
  },

  primaryActionButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "10px 15px",
    borderRadius: 999,
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid #0f172a",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    boxShadow: "0 12px 24px rgba(15,23,42,0.14)",
    whiteSpace: "nowrap",
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
    border: "1px solid rgba(148,163,184,0.52)",
    textDecoration: "none",
    fontWeight: 900,
    textAlign: "center",
  },

  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    minHeight: 44,
    padding: "10px 16px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    textDecoration: "none",
    fontWeight: 950,
    textAlign: "center",
    boxShadow: "0 12px 22px rgba(22,131,248,0.2)",
  },

  successBox: {
    padding: 14,
    borderRadius: 18,
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #bbf7d0",
    fontWeight: 900,
    marginBottom: 18,
  },
  upgradeBanner: {
    display: "grid",
    gap: 10,
    padding: 22,
    borderRadius: 26,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    marginBottom: 18,
  },

  upgradeEyebrow: {
    color: "#92400e",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  upgradeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
  },

  upgradeText: {
    margin: 0,
    color: "#92400e",
    lineHeight: 1.55,
    fontWeight: 800,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 18,
  },

  summaryCard: {
    padding: 16,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderTop: "4px solid #1683f8",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  summaryLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 6,
  },

  summaryValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 24,
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
    padding: 22,
    borderRadius: 28,
    background:
      "radial-gradient(circle at top left, rgba(250,204,21,0.16), transparent 34%), linear-gradient(135deg, #0f172a 0%, #1e293b 58%, #020617 100%)",
    color: "#ffffff",
    border: "1px solid rgba(250,204,21,0.26)",
    boxShadow: "0 18px 48px rgba(15,23,42,0.16)",
    marginBottom: 18,
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
    marginBottom: 6,
  },

  readinessTitle: {
    margin: 0,
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
  },

  readinessIntro: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    lineHeight: 1.55,
    fontWeight: 750,
    maxWidth: 780,
  },

  readinessStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 13,
    fontWeight: 950,
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
    color: "#475569",
    borderColor: "#e2e8f0",
  },

  readinessOverviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  readinessOverviewCard: {
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
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
  },

  miniStatusPill: {
    display: "inline-flex",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
  },

  readinessOverviewText: {
    margin: "8px 0 0",
    color: "#cbd5e1",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 750,
  },

  professionalNoticeDark: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "rgba(250,204,21,0.12)",
    color: "#fef3c7",
    border: "1px solid rgba(250,204,21,0.28)",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 800,
  },

  professionalNoticeLight: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#eff6ff",
    color: "#1e3a8a",
    border: "1px solid #bfdbfe",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 850,
  },

  readinessActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  lockedPanel: {
    display: "grid",
    gap: 12,
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
  },

  lockedEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  addOnPanels: {
    display: "grid",
    gap: 16,
  },

  addOnAccordion: {
    display: "grid",
    gap: 0,
    padding: 22,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 2px 12px rgba(15,23,42,0.04)",
    overflow: "hidden",
  },

  addOnAccordionSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    cursor: "pointer",
    listStyle: "none",
  },

  addOnSummaryMain: {
    minWidth: 0,
  },

  innerEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  },

  panelTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    overflowWrap: "anywhere",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 750,
  },

  addOnSummaryMeta: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  warningCountPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  warningCountPillActive: {
    background: "#fef3c7",
    color: "#92400e",
    borderColor: "#fde68a",
  },

  warningCountPillQuiet: {
    background: "#f8fafc",
    color: "#64748b",
    borderColor: "#e2e8f0",
  },

  prizeRevealToggle: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
  },

  addOnAccordionBody: {
    display: "grid",
    gap: 16,
    marginTop: 18,
  },

  readinessGridLight: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },

  readinessItemLight: {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    gap: 10,
    padding: 13,
    borderRadius: 16,
    border: "1px solid",
  },

  readinessItemGood: {
    background: "#f0fdf4",
    borderColor: "#bbf7d0",
  },

  readinessItemWarning: {
    background: "#fffbeb",
    borderColor: "#fde68a",
  },

  readinessItemNeutral: {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
  },

  readinessToneDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    marginTop: 4,
  },

  readinessDotGood: {
    background: "#22c55e",
  },

  readinessDotWarning: {
    background: "#f59e0b",
  },

  readinessDotNeutral: {
    background: "#94a3b8",
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
    letterSpacing: "0.06em",
    marginBottom: 4,
  },

  readinessValueLight: {
    display: "block",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
  },

  readinessDetailLight: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
    fontWeight: 750,
  },

  warningNotice: {
    display: "grid",
    gap: 4,
    padding: 14,
    borderRadius: 18,
    background: "#fffbeb",
    color: "#92400e",
    border: "1px solid #fde68a",
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 850,
  },

  form: {
    display: "grid",
    gap: 14,
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
    fontFamily: "inherit",
  },

  legalPanel: {
    display: "grid",
    gap: 0,
    padding: 16,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  },

  legalSummary: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
    cursor: "pointer",
    listStyle: "none",
  },

  legalBody: {
    display: "grid",
    gap: 14,
    marginTop: 16,
  },

  legalEyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 5,
  },

  legalTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1.05,
    letterSpacing: "-0.04em",
  },

  legalText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 750,
    maxWidth: 760,
  },

  valueRangePanel: {
    display: "grid",
    gap: 14,
    padding: 14,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
  },

  valueRangeTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    lineHeight: 1.1,
    letterSpacing: "-0.035em",
  },

  submitRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 46,
    padding: "12px 18px",
    borderRadius: 999,
    background: "#1683f8",
    color: "#ffffff",
    border: "none",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 22px rgba(22,131,248,0.2)",
  },
};
