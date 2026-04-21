import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReservationRow = {
  ticket_number: number;
  colour: string | null;
  raffle_id: string;
};

type RaffleRow = {
  config_json: {
    colours?: Array<
      | string
      | {
          id?: string;
          value?: string;
          name?: string;
          label?: string;
          hex?: string;
        }
    >;
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

function normaliseColours(colours: unknown): NormalisedColour[] {
  if (!Array.isArray(colours)) return [];

  return colours
    .map((colour) => {
      if (typeof colour === "string") {
        const trimmed = colour.trim();
        if (!trimmed) return null;

        return {
          value: trimmed.toLowerCase(),
          label: looksLikeHexColour(trimmed)
            ? trimmed.toUpperCase()
            : titleCase(trimmed),
          hex: looksLikeHexColour(trimmed) ? trimmed.toLowerCase() : undefined,
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

      const value = String(rawValue).trim().toLowerCase();
      if (!value) return null;

      const labelSource =
        colour.name ||
        colour.label ||
        (looksLikeHexColour(value) ? value.toUpperCase() : titleCase(value));

      const hex =
        typeof colour.hex === "string" && looksLikeHexColour(colour.hex)
          ? colour.hex.toLowerCase()
          : looksLikeHexColour(value)
            ? value.toLowerCase()
            : undefined;

      return {
        value,
        label: String(labelSource).trim() || "Default",
        hex,
      };
    })
    .filter(Boolean) as NormalisedColour[];
}

function buildColourLookup(colours: NormalisedColour[]) {
  const lookup = new Map<string, string>();

  for (const colour of colours) {
    lookup.set(colour.value.toLowerCase(), colour.label);
    if (colour.hex) lookup.set(colour.hex.toLowerCase(), colour.label);
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

    const reservations = await query<ReservationRow>(
      `
      select
        ticket_number,
        colour,
        raffle_id
      from raffle_ticket_reservations
      where reservation_token = $1
      order by ticket_number asc
      `,
      [token],
    );

    if (!reservations.length) {
      return NextResponse.json({
        ok: true,
        tickets: [],
      });
    }

    const raffle = await query<RaffleRow>(
      `
      select config_json
      from raffles
      where id = $1
      limit 1
      `,
      [reservations[0].raffle_id],
    );

    const colourLookup = buildColourLookup(
      normaliseColours(raffle[0]?.config_json?.colours),
    );

    return NextResponse.json({
      ok: true,
      tickets: reservations.map((ticket) => {
        const rawColour = (ticket.colour || "default").toLowerCase();
        return {
          ticket_number: ticket.ticket_number,
          colour: colourLookup.get(rawColour) || ticket.colour || "Default",
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
