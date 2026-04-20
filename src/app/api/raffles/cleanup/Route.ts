import { NextResponse } from "next/server";
import { query } from "../../../../../api/_lib/db";

export const runtime = "nodejs";

export async function POST() {
  try {
    await query(
      `
      update raffle_ticket_reservations
      set status = 'expired'
      where status = 'reserved'
        and expires_at < now()
      `,
      [],
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("cleanup reservations error", error);

    return NextResponse.json(
      { ok: false, error: "Failed to clean up reservations" },
      { status: 500 },
    );
  }
}
