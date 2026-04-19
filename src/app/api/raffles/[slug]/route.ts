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
    const allRaffles = await listRaffles();

    const tenantMatches = tenantSlug
      ? allRaffles.filter((item) => item.tenant_slug === tenantSlug)
      : [];

    const slugMatches = allRaffles.filter((item) => item.slug === slug);

    const tenantScopedRaffle = tenantSlug
      ? await getRaffleBySlug(tenantSlug, slug)
      : null;

    return NextResponse.json({
      ok: true,
      debug: {
        requestedSlug: slug,
        detectedTenantSlug: tenantSlug || "",
        totalRaffles: allRaffles.length,
        allRaffles: allRaffles.map((item) => ({
          id: item.id,
          tenant_slug: item.tenant_slug,
          slug: item.slug,
          title: item.title,
          status: item.status,
        })),
        tenantMatches: tenantMatches.map((item) => ({
          id: item.id,
          tenant_slug: item.tenant_slug,
          slug: item.slug,
          title: item.title,
          status: item.status,
        })),
        slugMatches: slugMatches.map((item) => ({
          id: item.id,
          tenant_slug: item.tenant_slug,
          slug: item.slug,
          title: item.title,
          status: item.status,
        })),
        tenantScopedRaffle,
      },
    });
  } catch (error) {
    console.error("GET /api/raffles/[slug] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Internal error",
      },
      { status: 500 },
    );
  }
}
