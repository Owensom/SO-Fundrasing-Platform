import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PrizePayload = {
  id: string;
  title: string;
  position: number;
};

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function truthy(value: FormDataEntryValue | null) {
  return String(value || "").trim().toLowerCase() === "yes";
}

async function getEligibleCandidates(
  eventId: string,
  drawScope: string,
  includeVip: boolean,
  includeComplimentary: boolean,
  includeStaff: boolean,
  includeSponsors: boolean,
  includeGuests: boolean,
) {
  const rows = await query<{
    id: string;
    customer_name: string | null;
    customer_email: string | null;
    guest_name: string | null;
    guest_email: string | null;
    table_number: string | null;
    row_label: string | null;
    seat_number: string | null;
    admin_label: string | null;
    seat_purpose: string | null;
    order_id: string | null;
    stripe_session_id: string | null;
    status: string | null;
  }>(
    `
      SELECT
        es.id,
        es.customer_name,
        es.customer_email,
        es.guest_name,
        es.guest_email,
        es.table_number,
        es.row_label,
        es.seat_number,
        es.admin_label,
        es.seat_purpose,
        es.order_id,
        es.stripe_session_id,
        es.status
      FROM event_seats es
      WHERE es.event_id = $1
        AND (
          es.status = 'sold'
          OR es.order_id IS NOT NULL
          OR es.stripe_session_id IS NOT NULL
        )
    `,
    [eventId],
  );

  const previousWinnerEmails =
    drawScope === "not_previous_winners"
      ? new Set(
          (
            await query<{
              winner_email: string | null;
            }>(
              `
                SELECT winner_email
                FROM event_winners
                WHERE event_id = $1
              `,
              [eventId],
            )
          )
            .map((row) => String(row.winner_email || "").trim().toLowerCase())
            .filter(Boolean),
        )
      : new Set<string>();

  return rows.filter((row) => {
    const adminLabel = String(row.admin_label || "")
      .trim()
      .toLowerCase();

    const purpose = String(row.seat_purpose || "")
      .trim()
      .toLowerCase();

    const email = String(
      row.customer_email || row.guest_email || "",
    ).trim();

    if (!email) {
      return false;
    }

    if (
      drawScope === "not_previous_winners" &&
      previousWinnerEmails.has(email.toLowerCase())
    ) {
      return false;
    }

    const isVip =
      adminLabel.includes("vip") || purpose.includes("vip");

    const isComplimentary =
      adminLabel.includes("complimentary") ||
      purpose.includes("complimentary");

    const isStaff =
      adminLabel.includes("staff") || purpose.includes("staff");

    const isSponsor =
      adminLabel.includes("sponsor") || purpose.includes("sponsor");

    const isGuest =
      adminLabel.includes("guest") || purpose.includes("guest");

    if (isVip && !includeVip) return false;
    if (isComplimentary && !includeComplimentary) return false;
    if (isStaff && !includeStaff) return false;
    if (isSponsor && !includeSponsors) return false;
    if (isGuest && !includeGuests) return false;

    return true;
  });
}

async function saveWinner(
  eventId: string,
  prize: PrizePayload,
  winner: any,
  drawScope: string,
) {
  return queryOne(
    `
      INSERT INTO event_winners (
        event_id,
        prize_id,
        prize_title,
        prize_position,
        draw_scope,
        table_number,
        row_label,
        seat_number,
        winner_name,
        winner_email,
        status,
        drawn_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        'drawn',
        NOW()
      )
      RETURNING *
    `,
    [
      eventId,
      prize.id,
      prize.title,
      prize.position,
      drawScope,
      winner.table_number || null,
      winner.row_label || null,
      winner.seat_number || null,
      winner.customer_name ||
        winner.guest_name ||
        "Winner",
      winner.customer_email ||
        winner.guest_email ||
        null,
    ],
  );
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: eventId } = await context.params;

    const formData = await request.formData();

    const drawMode = String(
      formData.get("draw_mode") || "single",
    );

    const drawScope = String(
      formData.get("draw_scope") || "not_previous_winners",
    );

    const includeVip = truthy(formData.get("include_vip"));
    const includeComplimentary = truthy(
      formData.get("include_complimentary"),
    );
        const includeStaff = truthy(
      formData.get("include_staff"),
    );

    const includeSponsors = truthy(
      formData.get("include_sponsors"),
    );

    const includeGuests = truthy(
      formData.get("include_guests"),
    );

    const candidates = await getEligibleCandidates(
      eventId,
      drawScope,
      includeVip,
      includeComplimentary,
      includeStaff,
      includeSponsors,
      includeGuests,
    );

    if (!candidates.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No eligible winners found.",
        },
        { status: 400 },
      );
    }

    if (drawMode === "all_remaining") {
      const existingPrizeIds = new Set(
        (
          await query<{
            prize_id: string | null;
          }>(
            `
              SELECT prize_id
              FROM event_winners
              WHERE event_id = $1
            `,
            [eventId],
          )
        )
          .map((row) => String(row.prize_id || "").trim())
          .filter(Boolean),
      );

      const prizesRaw = String(
        formData.get("all_prizes") || "[]",
      );

      let parsedPrizes: PrizePayload[] = [];

      try {
        parsedPrizes = JSON.parse(prizesRaw);
      } catch {
        parsedPrizes = [];
      }

      const remainingPrizes = parsedPrizes.filter(
        (prize) =>
          prize?.id &&
          !existingPrizeIds.has(String(prize.id)),
      );

      if (!remainingPrizes.length) {
        return NextResponse.json(
          {
            ok: false,
            error: "No remaining prizes available.",
          },
          { status: 400 },
        );
      }

      const savedWinners = [];

      const availableCandidates = [...candidates];

      for (const prize of remainingPrizes) {
        if (!availableCandidates.length) {
          break;
        }

        const winner = randomItem(availableCandidates);

        const winnerIndex = availableCandidates.findIndex(
          (candidate) => candidate.id === winner.id,
        );

        if (winnerIndex >= 0) {
          availableCandidates.splice(winnerIndex, 1);
        }

        const savedWinner = await saveWinner(
          eventId,
          prize,
          winner,
          drawScope,
        );

        savedWinners.push(savedWinner);
      }

      return NextResponse.json({
        ok: true,
        winners: savedWinners,
      });
    }

    const prizeKey = String(
      formData.get("prize_key") || "",
    ).trim();

    if (!prizeKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Prize is required.",
        },
        { status: 400 },
      );
    }

    let parsedPrize: PrizePayload;

    try {
      parsedPrize = JSON.parse(prizeKey);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid prize payload.",
        },
        { status: 400 },
      );
    }

    const existingWinner = await queryOne<{
      id: string;
    }>(
      `
        SELECT id
        FROM event_winners
        WHERE event_id = $1
          AND prize_id = $2
        LIMIT 1
      `,
      [eventId, parsedPrize.id],
    );

    if (existingWinner) {
      return NextResponse.json(
        {
          ok: false,
          error: "Prize already drawn.",
        },
        { status: 400 },
      );
    }

    const selectedWinner = randomItem(candidates);

    const savedWinner = await saveWinner(
      eventId,
      parsedPrize,
      selectedWinner,
      drawScope,
    );

    return NextResponse.json({
      ok: true,
      winner: savedWinner,
    });
  } catch (error) {
    console.error(
      "POST /api/admin/events/[id]/draw failed",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: eventId } = await context.params;

    const winnerId = request.nextUrl.searchParams.get(
      "winner_id",
    );

    if (!winnerId) {
      await query(
        `
          DELETE FROM event_winners
          WHERE event_id = $1
        `,
        [eventId],
      );

      return NextResponse.json({
        ok: true,
      });
    }

    await query(
      `
        DELETE FROM event_winners
        WHERE id = $1
          AND event_id = $2
      `,
      [winnerId, eventId],
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "DELETE /api/admin/events/[id]/draw failed",
      error,
    );

    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error.",
      },
      { status: 500 },
    );
  }
}
