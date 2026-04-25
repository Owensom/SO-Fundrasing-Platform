import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Prize = {
  position?: number;
  title?: string;
  description?: string;
  isPublic?: boolean;
  is_public?: boolean;
};

type Body = {
  prizes?: Prize[];
};

type RaffleRow = {
  id: string;
  config_json: Record<string, unknown> | null;
};

function normalisePrizes(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const row = item as Prize;

      const title = String(row.title || "").trim();
      if (!title) return null;

      return {
        position: Number.isFinite(Number(row.position))
          ? Math.max(1, Math.floor(Number(row.position)))
          : index + 1,
        title,
        description: String(row.description || "").trim(),
        isPublic: row.isPublic !== false && row.is_public !== false,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.position - b.position);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Body;
    const prizes = normalisePrizes(body.prizes);

    const raffle = await queryOne<RaffleRow>(
      `
      select id, config_json
      from raffles
      where id = $1
      limit 1
      `,
      [params.id]
    );

    if (!raffle) {
      return NextResponse.json(
        { ok: false, error: "Raffle not found" },
        { status: 404 }
      );
    }

    const existingConfig =
      raffle.config_json && typeof raffle.config_json === "object"
        ? raffle.config_json
        : {};

    const nextConfig = {
      ...existingConfig,
      prizes,
    };

    const updated = await queryOne<RaffleRow>(
      `
      update raffles
      set
        config_json = $2::jsonb,
        updated_at = now()
      where id = $1
      returning id, config_json
      `,
      [params.id, JSON.stringify(nextConfig)]
    );

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Failed to save prizes" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      prizes,
    });
  } catch (error: any) {
    console.error("save prize settings error", error);

    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save prize settings" },
      { status: 500 }
    );
  }
}
