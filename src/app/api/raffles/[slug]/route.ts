import { NextRequest, NextResponse } from "next/server";
import { getTenantSlugFromRequest } from "@/lib/tenant";
import { sql } from "@vercel/postgres"; // or your DB client

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const tenantSlug = getTenantSlugFromRequest(request);

  if (!tenantSlug) {
    return NextResponse.json(
      { ok: false, error: "Tenant not found" },
      { status: 404 },
    );
  }

  const slug = params.slug;

  try {
    const result = await sql`
      SELECT *
      FROM raffles
      WHERE slug = ${slug}
      AND tenant_slug = ${tenantSlug}
      LIMIT 1
    `;

    const raffle = result.rows[0];

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
  } catch (err) {
    console.error("raffle fetch error", err);

    return NextResponse.json(
      { ok: false, error: "Internal error" },
      { status: 500 },
    );
  }
}
