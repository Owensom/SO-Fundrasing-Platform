import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromHeaders } from "@/lib/tenant";
import {
  createEventWinner,
  getEligibleEventDrawCandidates,
  getEventById,
  listEventWinners,
  type EventDrawCandidate,
} from "../../../../../../../api/_lib/events-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ParsedPrizeSelection = {
  id: string;
  title: string;
  position: number | null;
};

function positiveInteger(value: FormDataEntryValue | null, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function parsePrizeSelection(
  value: FormDataEntryValue | null,
): ParsedPrizeSelection | null {
  try {
    const parsed = JSON.parse(String(value || ""));
    const id = String(parsed?.id || "").trim();
    const title = String(parsed?.title || "").trim();
    const positionNumber = Number(parsed?.position);

    if (!id || !title) return null;

    return {
      id,
      title,
      position:
        Number.isFinite(positionNumber) && positionNumber > 0
          ? Math.floor(positionNumber)
          : null,
    };
  } catch {
    return null;
  }
}

function chooseRandomCandidate(
  candidates: EventDrawCandidate[],
): EventDrawCandidate | null {
  if (candidates.length === 0) return null;
  return candidates[randomInt(candidates.length)] || null;
}

async function requireEventAccess(eventId: string) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Not authenticated" },
        { status: 401 },
      ),
    };
  }

  const event = await getEventById(eventId);

  if (!event) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Event not found" },
        { status: 404 },
      ),
    };
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
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    event,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: eventId } = await context.params;

  try {
    const access = await requireEventAccess(eventId);

    if (!access.ok) {
      return access.response;
    }

    const event = access.event;
    const formData = await request.formData();

    const checkOnly = String(formData.get("check_only") || "") === "yes";
    const drawMode = String(formData.get("draw_mode") || "single").trim();
    const selectedPrize = parsePrizeSelection(formData.get("prize_key"));
    const drawScope = String(formData.get("draw_scope") || "all").trim();

    const maxWinnersPerTableRaw = positiveInteger(
      formData.get("max_winners_per_table"),
      0,
    );

    const existingWinners = await listEventWinners(eventId);

    const drawnPrizeIds = new Set(
      existingWinners
        .filter((winner) => winner.status === "drawn")
        .map((winner) => String(winner.prize_id || "").trim())
        .filter(Boolean),
    );

    const eventPrizes: ParsedPrizeSelection[] = (event.prizes_json || [])
      .map((prize, index) => {
        const title = String(prize.title || prize.name || "").trim();
        if (!title) return null;

        const rawPosition = Number(prize.position);

        return {
          id: String(prize.id || `prize-${index + 1}`),
          title,
          position:
            Number.isFinite(rawPosition) && rawPosition > 0
              ? Math.floor(rawPosition)
              : index + 1,
        };
      })
      .filter(Boolean) as ParsedPrizeSelection[];

    const prizesToDraw =
      drawMode === "all_remaining"
        ? eventPrizes.filter((prize) => !drawnPrizeIds.has(prize.id))
        : selectedPrize
          ? [selectedPrize]
          : [];

    if (prizesToDraw.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No prize selected or no prizes remaining." },
        { status: 400 },
      );
    }

    if (drawMode !== "all_remaining" && selectedPrize) {
      if (drawnPrizeIds.has(selectedPrize.id)) {
        return NextResponse.json(
          { ok: false, error: "This prize has already been drawn." },
          { status: 409 },
        );
      }
    }

    const drawSettings = {
      eventType: event.event_type,
      includeVip: String(formData.get("include_vip") || "") === "yes",
      includeComplimentary:
        String(formData.get("include_complimentary") || "") === "yes",
      includeStaff: String(formData.get("include_staff") || "") === "yes",
      includeSponsors: String(formData.get("include_sponsors") || "") === "yes",
      includeGuests: String(formData.get("include_guests") || "") === "yes",
      excludeWinnerEmails: drawScope === "not_previous_winners",
      maxWinnersPerTable:
        event.event_type === "tables" && maxWinnersPerTableRaw > 0
          ? maxWinnersPerTableRaw
          : null,
    };

    if (checkOnly) {
      const candidates = await getEligibleEventDrawCandidates({
        eventId,
        includeVip: drawSettings.includeVip,
        includeComplimentary: drawSettings.includeComplimentary,
        includeStaff: drawSettings.includeStaff,
        includeSponsors: drawSettings.includeSponsors,
        includeGuests: drawSettings.includeGuests,
        excludeWinnerEmails: drawSettings.excludeWinnerEmails,
        maxWinnersPerTable: drawSettings.maxWinnersPerTable,
      });

      return NextResponse.json({
        ok: true,
        eligibleCount: candidates.length,
        prizeCount: prizesToDraw.length,
      });
    }

    const createdWinners = [];

    for (const prize of prizesToDraw) {
      const candidates = await getEligibleEventDrawCandidates({
        eventId,
        includeVip: drawSettings.includeVip,
        includeComplimentary: drawSettings.includeComplimentary,
        includeStaff: drawSettings.includeStaff,
        includeSponsors: drawSettings.includeSponsors,
        includeGuests: drawSettings.includeGuests,
        excludeWinnerEmails: drawSettings.excludeWinnerEmails,
        maxWinnersPerTable: drawSettings.maxWinnersPerTable,
      });

      const winner = chooseRandomCandidate(candidates);

      if (!winner) {
        if (drawMode === "all_remaining" && createdWinners.length > 0) break;

        return NextResponse.json(
          { ok: false, error: "No eligible winner found." },
          { status: 400 },
        );
      }

      await createEventWinner({
        tenantSlug: event.tenant_slug,
        eventId,
        prizeId: prize.id,
        prizeTitle: prize.title,
        prizePosition: prize.position,
        drawScope,
        drawSettings,
        eventOrderId: winner.event_order_id,
        eventOrderItemId: winner.event_order_item_id,
        eventSeatId: winner.event_seat_id,
        ticketTypeId: winner.ticket_type_id,
        tableNumber: winner.table_number,
        rowLabel: winner.row_label,
        seatNumber: winner.seat_number,
        winnerName: winner.winner_name,
        winnerEmail: winner.winner_email,
      });

      createdWinners.push({
        prize_id: prize.id,
        prize_title: prize.title,
        prize_position: prize.position,
        winner_name: winner.winner_name,
        winner_email: winner.winner_email,
        table_number: winner.table_number,
        row_label: winner.row_label,
        seat_number: winner.seat_number,
      });
    }

    if (createdWinners.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No eligible winner found." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      winner: createdWinners[0],
      winners: createdWinners,
    });
  } catch (error) {
    console.error("POST /api/admin/events/[id]/draw failed", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
