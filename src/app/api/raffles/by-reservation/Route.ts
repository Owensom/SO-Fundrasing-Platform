import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  raffle_id: string;
};

type SaleRow = {
  ticket_number: number;
  colour: string | null;
  colour_id: string | null;
};

type RawColour =
  | string
  | {
      id?: string;
      value?: string;
      name?: string;
      label?: string;
      hex?: string;
    };

type RaffleConfigRow = {
  config_json: {
    colours?: RawColour[];
  } | null;
};

type NormalisedColour = {
  value: string;
  label: string;
  hex?: string;
};

function titleCase(input: string) {
  return input
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
    });
}

function looksLikeHexColour(value: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normaliseSingleColour(colour: RawColour): NormalisedColour | null {
  if (typeof colour === "string") {
    const trimmed = colour.trim();
    if (!trimmed) return null;

    if (looksLikeHexColour(trimmed)) {
      return {
        value: trimmed.toLowerCase(),
        label: trimmed.toUpperCase(),
        hex: trimmed.toLowerCase(),
      };
    }

    return {
      value: trimmed,
      label: titleCase(trimmed),
    };
  }

  if (!colour || typeof colour !== "object") return null;

  const rawValue =
    colour.value ||
    colour.id ||
    colour.name ||
    colour.label ||
    colour.hex ||
    "default";

  const value = String(rawValue).trim() || "default";

  const labelSource =
    colour.name ||
    colour.label ||
    (looksLikeHexColour(value) ? value.toUpperCase() : titleCase(value));

  const label = String(labelSource).trim() || "Default";

  const hex =
    typeof colour.hex === "string" && looksLikeHexColour(colour.hex.trim())
      ? colour.hex.trim().toLowerCase()
      : looksLikeHexColour(value)
        ? value.toLowerCase()
        : undefined;

  return {
    value,
    label,
    hex,
  };
}

function normaliseColours(colours: unknown): NormalisedColour[] {
  if (!Array.isArray(colours) || colours.length === 0) return [];

  const seen = new Set<string>();
  const result: NormalisedColour[] = [];

  for (const colour of colours as RawColour[]) {
    const normalised = normaliseSingleColour(colour);
    if (!normalised) continue;

    const keys = [
      normalised.value.toLowerCase(),
      normalised.hex?.toLowerCase(),
    ].filter(Boolean) as string[];

    const primaryKey = keys[0];
    if (!primaryKey || seen.has(primaryKey)) continue;

    keys.forEach((k) => seen.add(k));
    result.push(normalised);
  }

  return result;
}

function buildColourLookup(colours: NormalisedColour[]) {
  const lookup = new Map<string, string>();

  for (const colour of colours) {
    lookup.set(colour.value.toLowerCase(), colour.label);
    if (colour.hex) {
      lookup.set(colour.hex.toLowerCase(), colour.label);
    }
  }

  return lookup;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Missing token" },
        { status: 400 },
      );
    }

    const payment = await queryOne<PaymentRow>(
      `
      select id, raffle_id
      from raffle_payments
      where reservation_token = $1
      limit 1
      `,
      [token],
    );

    if (!payment) {
      return NextResponse.json({
        ok: true,
        tickets: [],
      });
    }

    const raffle = await queryOne<RaffleConfigRow>(
      `
      select config_json
      from raffles
      where id = $1
      limit 1
      `,
      [payment.raffle_id],
    );

    const normalisedColours = normaliseColours(raffle?.config_json?.colours);
    const colourLookup = buildColourLookup(normalisedColours);

    const sales = await query<SaleRow>(
      `
      select
        ticket_number,
        colour,
        colour_id
      from raffle_ticket_sales
      where payment_id = $1
      order by ticket_number asc
      `,
      [payment.id],
    );

    return NextResponse.json({
      ok: true,
      tickets: sales.map((ticket) => {
        const rawColour =
          ticket.colour || ticket.colour_id || "default";
        const label =
          colourLookup.get(String(rawColour).toLowerCase()) ||
          rawColour;

        return {
          ticket_number: ticket.ticket_number,
          colour: label,
        };
      }),
    });
  } catch (error) {
    console.error("by-reservation error", error);

    return NextResponse.json(
      { ok: false, error: "Failed to load tickets" },
      { status: 500 },
    );
  }
}
