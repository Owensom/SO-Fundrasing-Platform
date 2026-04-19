import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import {
  getRaffleBySlug,
  listRaffles,
} from "../../../../../api/_lib/raffles-repo";

type RouteContext = {
  params: {
    slug: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantSlug = getTenantSlugFromRequest(request);
  const slug = context.params.slug;

  try {
    if (tenantSlug) {
      const raffle = await getRaffleBySlug(tenantSlug, slug);

      if (!raffle) {
        return NextResponse.json(
          { ok: false, error: "Raffle not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        ok: true,
        raffle,
      });
    }

    // Temporary fallback for root-domain testing only
    const allRaffles = await listRaffles();
    const raffle = allRaffles.find((item) => item.slug === slug) ?? null;

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      raffle,
    });
  } catch (error) {
    console.error("GET /api/raffles/[slug] failed", error);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
