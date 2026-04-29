import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, context: RouteContext) {
  return NextResponse.redirect(
    new URL(`/admin/squares/${context.params.id}`, request.url),
    { status: 303 },
  );
}
