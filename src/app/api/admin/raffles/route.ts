import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "App Router admin raffles route is working.",
    items: [],
  });
}
