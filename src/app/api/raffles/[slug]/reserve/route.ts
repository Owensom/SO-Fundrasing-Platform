import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  return NextResponse.json(
    {
      ok: false,
      error: `RESERVE TEST ROUTE ACTIVE | slug=${params.slug}`,
    },
    { status: 418 }
  );
}
