import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  return NextResponse.json({
    ok: true,
    message: "App Router admin raffle details route is working.",
    id: context.params.id,
  });
}
