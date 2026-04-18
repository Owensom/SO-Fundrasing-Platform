import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");

  return NextResponse.json({
    ok: true,
    message: "App Router public raffles route is working.",
    slug,
  });
}
