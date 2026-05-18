import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { query } from "@/lib/db";
import { getSquaresGameById } from "../../../../../../../api/_lib/squares-repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: {
    id: string;
  };
};

async function requireTenantAccess(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const tenantSlug = getTenantSlugFromRequest(request);

  const sessionTenantSlugs = Array.isArray(session.user.tenantSlugs)
    ? session.user.tenantSlugs.map((value) => String(value))
    : [];

  if (!tenantSlug || !sessionTenantSlugs.includes(tenantSlug)) {
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
    tenantSlug,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireTenantAccess(request);

  if (!access.ok) {
    return access.response;
  }

  const tenantSlug = access.tenantSlug;
  const id = context.params.id;

  try {
    const game = await getSquaresGameById(id);

    if (!game) {
      return NextResponse.redirect(new URL("/admin/squares", request.url), {
        status: 303,
      });
    }

    if (game.tenant_slug !== tenantSlug) {
      return NextResponse.json(
        { ok: false, error: "Tenant access denied" },
        { status: 403 },
      );
    }

    await query(
      `
        delete from squares_winners
        where tenant_slug = $1
          and game_id = $2
      `,
      [tenantSlug, id],
    );

    await query(
      `
        delete from squares_sales
        where tenant_slug = $1
          and game_id = $2
      `,
      [tenantSlug, id],
    );

    await query(
      `
        delete from squares_reservations
        where tenant_slug = $1
          and game_id = $2
      `,
      [tenantSlug, id],
    );

    await query(
      `
        delete from squares_games
        where id = $1
          and tenant_slug = $2
      `,
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
