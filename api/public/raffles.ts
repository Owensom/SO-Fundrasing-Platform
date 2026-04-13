type JsonRecord = Record<string, unknown>;

type ColourOption = {
  name: string;
  hex: string;
};

type EntrySelectionInput = {
  colourName?: string | null;
  number?: number | null;
  autoColour?: boolean;
  autoNumber?: boolean;
};

const ALLOWED_CURRENCIES = new Set(["GBP", "USD", "EUR"]);
const ALLOWED_COLOUR_SELECTION_MODES = new Set(["manual", "automatic", "both"]);
const ALLOWED_NUMBER_SELECTION_MODES = new Set([
  "none",
  "manual",
  "automatic",
  "both",
]);

function setJson(res: any, status: number, body: unknown) {
  res.statusCode = status;
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.end(JSON.stringify(body));
}

function setAllowed(res: any, allowed: string[]) {
  if (typeof res.setHeader === "function") {
    res.setHeader("Allow", allowed.join(", "));
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown): string | null {
  const s = asTrimmedString(value);
  return s ? s : null;
}

function asInteger(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function getQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function parseJsonArrayField(value: any) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normaliseCurrencyCode(value: unknown): string {
  const code = asTrimmedString(value).toUpperCase();
  return ALLOWED_CURRENCIES.has(code) ? code : "GBP";
}

function normaliseColourSelectionMode(value: unknown): string {
  const mode = asTrimmedString(value).toLowerCase();
  return ALLOWED_COLOUR_SELECTION_MODES.has(mode) ? mode : "both";
}

function normaliseNumberSelectionMode(value: unknown): string {
  const mode = asTrimmedString(value).toLowerCase();
  return ALLOWED_NUMBER_SELECTION_MODES.has(mode) ? mode : "none";
}

function normaliseColours(input: unknown): ColourOption[] {
  const rows = parseJsonArrayField(input);

  return rows
    .map((item) => {
      const raw = (item ?? {}) as JsonRecord;
      const name = asTrimmedString(raw.name);
      const hex = asTrimmedString(raw.hex);
      if (!name || !hex) return null;
      return { name, hex };
    })
    .filter(Boolean) as ColourOption[];
}

async function readBody(req: any): Promise<any> {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks: Uint8Array[] = [];

  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("end", () => resolve());
    req.on("error", (err: unknown) => reject(err));
  });

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function getDb() {
  const mod: any = await import("../_lib/db.js");

  if (typeof mod.getDb === "function") return mod.getDb();
  if (typeof mod.default?.getDb === "function") return mod.default.getDb();
  if (mod.db && typeof mod.db.query === "function") return mod.db;
  if (mod.default && typeof mod.default.query === "function") return mod.default;

  if (typeof mod.query === "function") {
    return { query: mod.query.bind(mod) };
  }

  if (typeof mod.default?.query === "function") {
    return { query: mod.default.query.bind(mod.default) };
  }

  if (typeof mod.default === "function") {
    const instance = await mod.default();
    if (instance && typeof instance.query === "function") return instance;
  }

  if (mod.sql && typeof mod.sql === "function") {
    return {
      async query(text: string, params: any[] = []) {
        return mod.sql(text, params);
      },
    };
  }

  if (mod.default?.sql && typeof mod.default.sql === "function") {
    return {
      async query(text: string, params: any[] = []) {
        return mod.default.sql(text, params);
      },
    };
  }

  throw new Error("Unsupported db export shape");
}

function mapPublicRaffle(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    heroImageUrl: row.hero_image_url,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    raffleConfig: {
      campaignId: row.id,
      singleTicketPriceCents: row.single_ticket_price_cents,
      totalTickets: row.total_tickets,
      soldTickets: row.sold_tickets,
      backgroundImageUrl: row.background_image_url,
      currencyCode: normaliseCurrencyCode(row.currency_code),
      colourSelectionMode: normaliseColourSelectionMode(row.colour_selection_mode),
      numberSelectionMode: normaliseNumberSelectionMode(row.number_selection_mode),
      numberRangeStart: row.number_range_start,
      numberRangeEnd: row.number_range_end,
      colours: normaliseColours(row.colours),
    },
  };
}

async function getRaffleBySlug(db: any, slug: string) {
  const result = await db.query(
    `
    select
      c.id,
      c.tenant_id,
      c.type,
      c.slug,
      c.title,
      c.description,
      c.hero_image_url,
      c.status,
      c.starts_at,
      c.ends_at,
      c.created_at,
      c.updated_at,
      rc.single_ticket_price_cents,
      rc.total_tickets,
      rc.sold_tickets,
      rc.background_image_url,
      rc.currency_code,
      rc.colour_selection_mode,
      rc.number_selection_mode,
      rc.number_range_start,
      rc.number_range_end,
      rc.colours
    from campaigns c
    left join raffle_configs rc
      on rc.campaign_id = c.id
    where c.slug = $1
      and c.type = 'raffle'
      and c.status = 'published'
    limit 1
    `,
    [slug]
  );

  return result.rows[0] ?? null;
}

function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

async function getUsedNumbers(db: any, campaignId: string): Promise<Set<number>> {
  const result = await db.query(
    `
    select selected_number
    from raffle_entries
    where campaign_id = $1
      and selected_number is not null
    `,
    [campaignId]
  );

  return new Set(
    result.rows
      .map((row: any) => row.selected_number)
      .filter((n: unknown) => Number.isInteger(n))
  );
}

function buildAllowedNumbers(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function chooseAutoNumber(
  usedNumbers: Set<number>,
  numberRangeStart: number,
  numberRangeEnd: number
): number | null {
  const available = buildAllowedNumbers(numberRangeStart, numberRangeEnd).filter(
    (n) => !usedNumbers.has(n)
  );

  return pickRandom(available);
}

function findColourByName(colours: ColourOption[], name: string | null | undefined) {
  const target = asTrimmedString(name).toLowerCase();
  return colours.find((c) => c.name.trim().toLowerCase() === target) ?? null;
}

function validateEntrySelectionsCount(
  selections: EntrySelectionInput[],
  quantity: number
): boolean {
  return Array.isArray(selections) && selections.length === quantity;
}

async function getOfferPriceCents(db: any, campaignId: string): Promise<number> {
  const result = await db.query(
    `
    select single_ticket_price_cents
    from raffle_configs
    where campaign_id = $1
    limit 1
    `,
    [campaignId]
  );

  return asInteger(result.rows[0]?.single_ticket_price_cents, 0);
}

async function createPendingPurchase(
  db: any,
  payload: {
    campaignId: string;
    tenantId: string;
    fullName: string;
    email: string;
    quantity: number;
    amountTotalCents: number;
    currencyCode: string;
  }
) {
  const purchaseId = `purchase_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db.query(
    `
    insert into purchases (
      id,
      tenant_id,
      campaign_id,
      raffle_config_id,
      full_name,
      email,
      quantity,
      amount_total_cents,
      currency,
      status,
      created_at,
      updated_at
    )
    values ($1, $2, $3, $3, $4, $5, $6, $7, $8, 'pending', now(), now())
    `,
    [
      purchaseId,
      payload.tenantId,
      payload.campaignId,
      payload.fullName,
      payload.email,
      payload.quantity,
      payload.amountTotalCents,
      payload.currencyCode,
    ]
  );

  return purchaseId;
}

async function insertEntry(
  db: any,
  payload: {
    purchaseId: string;
    campaignId: string;
    tenantId: string;
    selectedColourName: string | null;
    selectedColourHex: string | null;
    selectedNumber: number | null;
    selectionSource: "manual" | "automatic";
  }
) {
  const entryId = `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db.query(
    `
    insert into raffle_entries (
      id,
      purchase_id,
      campaign_id,
      tenant_id,
      selected_colour_name,
      selected_colour_hex,
      selected_number,
      selection_source,
      payment_status,
      created_at,
      updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now(), now())
    `,
    [
      entryId,
      payload.purchaseId,
      payload.campaignId,
      payload.tenantId,
      payload.selectedColourName,
      payload.selectedColourHex,
      payload.selectedNumber,
      payload.selectionSource,
    ]
  );

  return entryId;
}

async function handleGet(req: any, res: any) {
  try {
    const slug = asTrimmedString(getQueryValue(req.query?.slug));

    if (!slug) {
      return setJson(res, 400, {
        ok: false,
        error: "Missing slug",
      });
    }

    const db = await getDb();
    const row = await getRaffleBySlug(db, slug);

    if (!row) {
      return setJson(res, 404, {
        ok: false,
        error: "Raffle not found",
      });
    }

    return setJson(res, 200, {
      ok: true,
      raffle: mapPublicRaffle(row),
    });
  } catch (error: any) {
    console.error("GET /api/public/raffles error", error);
    return setJson(res, 500, {
      ok: false,
      error: error?.message || "Failed to load raffle",
      detail: error?.detail || null,
      code: error?.code || null,
    });
  }
}

async function handlePost(req: any, res: any) {
  try {
    const body = await readBody(req);

    const slug = asTrimmedString(body.slug);
    const fullName = asTrimmedString(body.fullName ?? body.name);
    const email = asTrimmedString(body.email);
    const quantity = asInteger(body.quantity, 0);
    const entrySelections = Array.isArray(body.entrySelections)
      ? (body.entrySelections as EntrySelectionInput[])
      : [];

    if (!slug) {
      return setJson(res, 400, { ok: false, error: "Missing slug" });
    }

    if (!fullName) {
      return setJson(res, 400, { ok: false, error: "Name is required" });
    }

    if (!email) {
      return setJson(res, 400, { ok: false, error: "Email is required" });
    }

    if (quantity <= 0) {
      return setJson(res, 400, { ok: false, error: "Quantity must be greater than 0" });
    }

    if (!validateEntrySelectionsCount(entrySelections, quantity)) {
      return setJson(res, 400, {
        ok: false,
        error: "entrySelections length must match quantity",
      });
    }

    const db = await getDb();
    const raffleRow = await getRaffleBySlug(db, slug);

    if (!raffleRow) {
      return setJson(res, 404, { ok: false, error: "Raffle not found" });
    }

    const raffle = mapPublicRaffle(raffleRow);
    const config = raffle.raffleConfig;

    const unitPriceCents = await getOfferPriceCents(db, raffle.id);
    if (unitPriceCents <= 0) {
      return setJson(res, 400, {
        ok: false,
        error: "Raffle ticket price is not configured",
      });
    }

    const colours = config.colours || [];
    const colourMode = config.colourSelectionMode;
    const numberMode = config.numberSelectionMode;
    const numberRangeStart = asInteger(config.numberRangeStart, 0);
    const numberRangeEnd = asInteger(config.numberRangeEnd, 0);

    const amountTotalCents = unitPriceCents * quantity;

    await db.query("begin");

    try {
      const usedNumbers = numberMode === "none"
        ? new Set<number>()
        : await getUsedNumbers(db, raffle.id);

      const purchaseId = await createPendingPurchase(db, {
        campaignId: raffle.id,
        tenantId: raffleRow.tenant_id,
        fullName,
        email,
        quantity,
        amountTotalCents,
        currencyCode: config.currencyCode,
      });

      const createdEntries: any[] = [];

      for (let i = 0; i < quantity; i++) {
        const selection = entrySelections[i] || {};
        let selectedColourName: string | null = null;
        let selectedColourHex: string | null = null;
        let selectedNumber: number | null = null;
        let selectionSource: "manual" | "automatic" = "manual";

        // Colour logic
        if (colourMode === "manual") {
          const chosen = findColourByName(colours, selection.colourName);
          if (!chosen) {
            await db.query("rollback");
            return setJson(res, 400, {
              ok: false,
              error: `Entry ${i + 1}: valid colour is required`,
            });
          }
          selectedColourName = chosen.name;
          selectedColourHex = chosen.hex;
          selectionSource = "manual";
        } else if (colourMode === "automatic") {
          const autoColour = pickRandom(colours);
          if (!autoColour && colours.length > 0) {
            await db.query("rollback");
            return setJson(res, 400, {
              ok: false,
              error: `Entry ${i + 1}: could not auto-assign colour`,
            });
          }
          selectedColourName = autoColour?.name ?? null;
          selectedColourHex = autoColour?.hex ?? null;
          selectionSource = "automatic";
        } else if (colourMode === "both") {
          const wantsAuto = Boolean(selection.autoColour);
          if (wantsAuto) {
            const autoColour = pickRandom(colours);
            if (!autoColour && colours.length > 0) {
              await db.query("rollback");
              return setJson(res, 400, {
                ok: false,
                error: `Entry ${i + 1}: could not auto-assign colour`,
              });
            }
            selectedColourName = autoColour?.name ?? null;
            selectedColourHex = autoColour?.hex ?? null;
            selectionSource = "automatic";
          } else {
            const chosen = findColourByName(colours, selection.colourName);
            if (!chosen) {
              await db.query("rollback");
              return setJson(res, 400, {
                ok: false,
                error: `Entry ${i + 1}: valid colour is required`,
              });
            }
            selectedColourName = chosen.name;
            selectedColourHex = chosen.hex;
            selectionSource = "manual";
          }
        }

        // Number logic
        if (numberMode === "none") {
          selectedNumber = null;
        } else if (numberMode === "manual") {
          const chosenNumber = asInteger(selection.number, 0);

          if (
            chosenNumber < numberRangeStart ||
            chosenNumber > numberRangeEnd
          ) {
            await db.query("rollback");
            return setJson(res, 400, {
              ok: false,
              error: `Entry ${i + 1}: number must be between ${numberRangeStart} and ${numberRangeEnd}`,
            });
          }

          if (usedNumbers.has(chosenNumber)) {
            await db.query("rollback");
            return setJson(res, 400, {
              ok: false,
              error: `Entry ${i + 1}: number ${chosenNumber} is already taken`,
            });
          }

          selectedNumber = chosenNumber;
          usedNumbers.add(chosenNumber);
        } else if (numberMode === "automatic") {
          const autoNumber = chooseAutoNumber(
            usedNumbers,
            numberRangeStart,
            numberRangeEnd
          );

          if (autoNumber == null) {
            await db.query("rollback");
            return setJson(res, 400, {
              ok: false,
              error: `Entry ${i + 1}: no numbers available`,
            });
          }

          selectedNumber = autoNumber;
          usedNumbers.add(autoNumber);
          selectionSource = "automatic";
        } else if (numberMode === "both") {
          const wantsAuto = Boolean(selection.autoNumber);

          if (wantsAuto) {
            const autoNumber = chooseAutoNumber(
              usedNumbers,
              numberRangeStart,
              numberRangeEnd
            );

            if (autoNumber == null) {
              await db.query("rollback");
              return setJson(res, 400, {
                ok: false,
                error: `Entry ${i + 1}: no numbers available`,
              });
            }

            selectedNumber = autoNumber;
            usedNumbers.add(autoNumber);
            selectionSource = "automatic";
          } else {
            const chosenNumber = asInteger(selection.number, 0);

            if (
              chosenNumber < numberRangeStart ||
              chosenNumber > numberRangeEnd
            ) {
              await db.query("rollback");
              return setJson(res, 400, {
                ok: false,
                error: `Entry ${i + 1}: number must be between ${numberRangeStart} and ${numberRangeEnd}`,
              });
            }

            if (usedNumbers.has(chosenNumber)) {
              await db.query("rollback");
              return setJson(res, 400, {
                ok: false,
                error: `Entry ${i + 1}: number ${chosenNumber} is already taken`,
              });
            }

            selectedNumber = chosenNumber;
            usedNumbers.add(chosenNumber);
          }
        }

        const entryId = await insertEntry(db, {
          purchaseId,
          campaignId: raffle.id,
          tenantId: raffleRow.tenant_id,
          selectedColourName,
          selectedColourHex,
          selectedNumber,
          selectionSource,
        });

        createdEntries.push({
          id: entryId,
          selectedColourName,
          selectedColourHex,
          selectedNumber,
          selectionSource,
        });
      }

      await db.query("commit");

      return setJson(res, 201, {
        ok: true,
        purchaseId,
        amountTotalCents,
        currencyCode: config.currencyCode,
        entries: createdEntries,
      });
    } catch (innerError) {
      await db.query("rollback");
      throw innerError;
    }
  } catch (error: any) {
    console.error("POST /api/public/raffles error", error);
    return setJson(res, 500, {
      ok: false,
      error: error?.message || "Failed to create purchase",
      detail: error?.detail || null,
      code: error?.code || null,
    });
  }
}

export default async function handler(req: any, res: any) {
  const method = String(req.method || "").toUpperCase();

  if (method === "GET") return handleGet(req, res);
  if (method === "POST") return handlePost(req, res);

  setAllowed(res, ["GET", "POST"]);
  return setJson(res, 405, {
    ok: false,
    error: "Method not allowed",
  });
}
