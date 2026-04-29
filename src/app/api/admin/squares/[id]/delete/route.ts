import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { query } from "@/lib/db";
import { getSquaresGameById } from "../../../../../../../api/_lib/squares-repo";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const id = context.params.id;

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  try {
    const game = await getSquaresGameById(id);

    if (!game) {
      return NextResponse.redirect(new URL("/admin/squares", request.url), {
        status: 303,
      });
    }

    if (game.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    await query(`delete from squares_winners where game_id = $1`, [id]);
    await query(`delete from squares_sales where game_id = $1`, [id]);
    await query(
      `delete from squares_games where id = $1 and tenant_slug = $2`,
      [id, tenantSlug],
    );

    return NextResponse.redirect(new URL("/admin/squares", request.url), {
      status: 303,
    });
  } catch (error) {
    console.error("Delete squares game failed:", error);

    return NextResponse.json(
      { ok: false, error: "Delete failed" },
      { status: 500 },
    );
  }
}
