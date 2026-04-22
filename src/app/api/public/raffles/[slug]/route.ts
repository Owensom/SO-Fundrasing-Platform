import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  return NextResponse.json({
    ok: true,
    slug: params.slug,
  });
}
